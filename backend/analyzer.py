import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

# Load API key from .env
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def analyze_resume(resume_text, job_description):
    """
    Sends the parsed resume and job description to Gemini and requests a structured JSON response.
    """
    model = genai.GenerativeModel('gemini-1.5-pro-latest') 

    prompt = f"""
    You are an expert ATS (Applicant Tracking System) and senior technical recruiter. 
    Analyze the following resume against the provided job description.
    
    You MUST return your response as a strict JSON object with EXACTLY the following keys:
    - "ats_score": an integer out of 100 representing the resume's strength.
    - "match_percentage": an integer out of 100 representing alignment with the job description.
    - "missing_skills": a list of strings detailing key skills missing from the resume.
    - "matched_skills": a list of strings detailing key skills the candidate possesses that match the job.
    - "suggestions": a list of strings with actionable advice to improve the resume.
    - "interview_questions": a list of specific interview questions to ask the candidate based on gaps or claims.
    - "voice_summary_text": A short, 2-sentence conversational summary of the candidate's fit, meant to be spoken aloud.

    Job Description:
    {job_description}

    Resume Text:
    {resume_text}
    """

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json"
            )
        )
        
        result_json = json.loads(response.text)
        return result_json
        
    except Exception as e:
        print(f"Gemini API error: {e}")
        raise RuntimeError("Failed to generate analysis from AI.")