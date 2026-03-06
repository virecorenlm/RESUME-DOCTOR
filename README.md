Resume Doctor v2

Structure:

resume-doctor/
├── backend/server.py
├── backend/requirements.txt
├── frontend/resume-doctor.jsx
├── start.sh
└── README.md

Run:

Terminal 1:
ollama serve

Terminal 2:
./start.sh

Backend:
http://localhost:8000

Health:
http://localhost:8000/health

Supported:
- PDF (pdfplumber)
- DOCX (python-docx)
- TXT

Optional OCR:
pip install pytesseract pdf2image
