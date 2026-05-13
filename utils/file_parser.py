import pdfplumber
import docx

def extract_text(filepath):
    """Extract text from PDF or DOCX."""
    text = ""
    ext = filepath.rsplit('.', 1)[1].lower()
    
    if ext == 'pdf':
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    elif ext == 'docx':
        doc = docx.Document(filepath)
        for para in doc.paragraphs:
            text += para.text + "\n"
            
    return text.strip()