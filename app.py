from flask import Flask, request, jsonify
from backend.parser import extract_text_from_pdf
from backend.analyzer import analyze_resume
from backend.tts_engine import generate_base64_audio
import io

app = Flask(__name__)

@app.route('/api/analyze', methods=['POST'])
def analyze_endpoint():
    # 1. Error Handling: Check if files are present in the request
    if 'resume' not in request.files or 'job_description' not in request.form:
        return jsonify({"error": "Missing resume file or job description."}), 400
    
    file = request.files['resume']
    job_description = request.form['job_description']

    if file.filename == '':
        return jsonify({"error": "No file selected."}), 400

    try:
        # 2. File Handling: Read file into memory (io.BytesIO) safely
        file_bytes = file.read()
        pdf_stream = io.BytesIO(file_bytes)
        
        # 3. Parsing: Extract text from the PDF stream
        resume_text = extract_text_from_pdf(pdf_stream)
        if not resume_text.strip():
            return jsonify({"error": "Could not extract text from the PDF. It might be corrupted or an image."}), 400

        # 4. The Brain: Send to Gemini 3.1 Pro 
        analysis_results = analyze_resume(resume_text, job_description)
        
        # 5. Audio Streaming: Generate base64 audio for the voice summary
        voice_summary_text = analysis_results.get("voice_summary_text", "Analysis complete.")
        audio_base64 = generate_base64_audio(voice_summary_text)
        
        # Attach the audio string to the final payload
        analysis_results["audio_base64"] = audio_base64

        # 6. Response: Return the strict JSON payload instantly
        return jsonify(analysis_results), 200

    except Exception as e:
        # Catch unexpected errors and return a clean 400 Bad Request
        print(f"Error during analysis: {e}")
        return jsonify({"error": "Could not process the file. Please try another."}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)