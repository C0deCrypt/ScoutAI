import os
import uuid
from flask import Flask, request, jsonify, render_template, send_from_directory, session
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Import utilities
from utils.file_parser import extract_text
from utils.skill_extractor import extract_skills
from utils.ats_scorer import calculate_ats_score
from utils.job_matcher import match_job
from utils.interview_questions import generate_questions
from utils.voice_feedback import generate_voice_feedback

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "fallback_secret")
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024 # 5MB limit
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['AUDIO_FOLDER'] = 'audio'
ALLOWED_EXTENSIONS = {'pdf', 'docx'}

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['AUDIO_FOLDER'], exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    if 'resume' not in request.files:
        return jsonify({'error': 'No resume file provided'}), 400
    
    file = request.files['resume']
    job_desc = request.form.get('job_description', '')
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(filepath)
        
        try:
            # 1. Parse File
            text = extract_text(filepath)
            if not text.strip():
                raise ValueError("Could not extract text from file.")
                
            # 2. Extract Skills
            extracted_skills = extract_skills(text)
            
            # 3. Calculate ATS Score
            ats_score, ats_feedback = calculate_ats_score(text, extracted_skills)
            
            # 4. Job Matching
            match_percent, missing_skills = match_job(extracted_skills, job_desc)
            
            # 5. Generate Voice Feedback
            feedback_text = f"Your resume scores an estimated {ats_score} out of 100. "
            if match_percent > 0:
                feedback_text += f"You have a {match_percent} percent match for this role. "
            if missing_skills:
                feedback_text += "Consider adding skills like " + ", ".join(missing_skills[:3]) + " to improve your chances."
                
            audio_filename = f"feedback_{uuid.uuid4()}.mp3"
            audio_filepath = os.path.join(app.config['AUDIO_FOLDER'], audio_filename)
            generate_voice_feedback(feedback_text, audio_filepath)
            
            # Cleanup resume file
            os.remove(filepath)
            
            # Store missing skills in session for the questions endpoint
            session['missing_skills'] = missing_skills
            
            return jsonify({
                'success': True,
                'skills': extracted_skills,
                'ats_score': ats_score,
                'ats_feedback': ats_feedback,
                'match_percent': match_percent,
                'missing_skills': missing_skills,
                'audio_url': f"/audio/{audio_filename}"
            })
            
        except Exception as e:
            if os.path.exists(filepath):
                os.remove(filepath)
            return jsonify({'error': str(e)}), 500
            
    return jsonify({'error': 'Invalid file type. Only PDF and DOCX are allowed.'}), 400

@app.route('/generate-questions', methods=['POST'])
def get_questions():
    missing_skills = session.get('missing_skills', [])
    if not missing_skills:
        return jsonify({'questions': ["Can you walk me through your resume?", "What are your greatest strengths?"]})
    
    questions = generate_questions(missing_skills)
    return jsonify({'questions': questions})

@app.route('/audio/<filename>')
def serve_audio(filename):
    return send_from_directory(app.config['AUDIO_FOLDER'], filename)

@app.route('/test', methods=['GET'])
def test_mode():
    """Mock route for safe demo if API fails"""
    return jsonify({
        'success': True,
        'skills': ['Python', 'Flask', 'SQL', 'Git'],
        'ats_score': 75,
        'ats_feedback': ['Good length', 'Missing contact info format'],
        'match_percent': 60,
        'missing_skills': ['React', 'AWS'],
        'audio_url': ""
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)