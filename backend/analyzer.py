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
    # Use the recommended model
    model = genai.GenerativeModel('gemini-1.5-pro-latest') # Update to 3.1 Pro model string when available in the SDK

    prompt = f"""
    You are an expert ATS (Applicant Tracking System) and senior technical recruiter. 
    Analyze the following resume against the provided job description.
    
    You MUST return your response as a strict JSON object with EXACTLY the following keys:
    - "ATS Score": an integer out of 100 representing the resume's strength.
    - "Match %": an integer out of 100 representing alignment with the job description.
    - "Missing Skills": a list of strings detailing key skills missing from the resume.
    - "Interview Questions": a list of 3 specific interview questions to ask the candidate based on gaps or claims.
    - "Voice Summary Text": A short, 2-sentence conversational summary of the candidate's fit, meant to be spoken aloud.

    Job Description:
    {job_description}

    Resume Text:
    {resume_text}
    """

    try:
        # Enforcing JSON output via the Gemini API
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json"
            )
        )
        
        # Parse the string response into a Python dictionary
        result_json = json.loads(response.text)
        return result_json
        
    except Exception as e:
        print(f"Gemini API error: {e}")
        raise RuntimeError("Failed to generate analysis from AI.")