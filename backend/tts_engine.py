from gtts import gTTS
import io
import base64

def generate_base64_audio(text):
    """
    Converts text to speech and returns it as a base64 encoded string.
    """
    try:
        # Generate speech
        tts = gTTS(text=text, lang='en', slow=False)
        
        # Save to an in-memory file
        audio_stream = io.BytesIO()
        tts.write_to_fp(audio_stream)
        
        # Reset stream position and encode
        audio_stream.seek(0)
        audio_base64 = base64.b64encode(audio_stream.read()).decode('utf-8')
        
        return audio_base64
    except Exception as e:
        print(f"TTS Generation error: {e}")
        return ""