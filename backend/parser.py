import fitz  # PyMuPDF

def extract_text_from_pdf(pdf_stream):
    """
    Reads a PDF file from an in-memory byte stream and extracts text.
    """
    text = ""
    try:
        # Open the PDF from the memory stream
        doc = fitz.open(stream=pdf_stream, filetype="pdf")
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text += page.get_text()
        return text
    except Exception as e:
        print(f"PDF parsing error: {e}")
        raise ValueError("Failed to parse PDF document.")