# ⚕️ Resume Doctor

A fully local, private resume analyzer powered by Ollama. Upload your resume as a PDF, DOCX, or plain text and get back a structured, scored report with ATS compatibility analysis, missing keywords, rewrite suggestions, and quick wins — all running on your own hardware.

No cloud. No subscriptions. No data leaving your machine.

---

## How It Works

```
Resume (PDF / DOCX / TXT)
    │
    ▼
FastAPI + pdfplumber    ← extracts clean plain text from uploaded file
    │
    ▼
Ollama (local LLM)     ← analyzes resume against scoring rubric, returns structured JSON
    │
    ▼
React Frontend         ← renders scored report with tabs, category cards, rewrite diffs
```

---

## Features

- **Drag-and-drop upload** — PDF, DOCX, and TXT all supported
- **pdfplumber extraction** — layout-aware parsing handles multi-column resume formats
- **8-category scoring** — ATS Compatibility, Keyword Coverage, Quantifiable Results, Layout, Language, Experience, Remote Work Signals, Domain Expertise
- **Missing keywords** — ranked by importance with example bullet points showing how to use them
- **Rewrite suggestions** — side-by-side before/after diffs for weak resume lines
- **Quick wins** — immediate fixes that take under 5 minutes
- **Alternate role matches** — LLM identifies other roles your experience qualifies for
- **Live streaming** — watch the model think in real time
- **Model selector** — switch between any locally installed Ollama model
- **Dual status indicators** — live health checks for both Ollama and the API backend
- **Paste fallback** — works without the backend if you paste text directly

---

## Stack

| Layer | Tech | Port |
|-------|------|------|
| Frontend | React (single `.jsx` file) | — |
| PDF API | FastAPI + pdfplumber | 8765 |
| LLM | Ollama | 11434 |

---

## Requirements

- Python 3.10+
- [Ollama](https://ollama.com) installed and running
- Node.js or a React environment to run the frontend (or load the `.jsx` directly as a claude.ai artifact)

---

## Installation

### 1. Start Ollama

```bash
ollama serve

# Pull a model if you haven't already
ollama pull llama3          # fast, decent quality
ollama pull mistral         # good balance
ollama pull qwen2.5:14b     # better quality, slower
```

### 2. Set up the backend

```bash
cd backend

# Create and activate a virtual environment
python3 -m venv .venv

# Linux/macOS
source .venv/bin/activate
# Windows
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn server:app --host 0.0.0.0 --port 8765 --reload
```

Or use the included launcher script which handles the venv and install automatically:

```bash
chmod +x start.sh
./start.sh
```

### 3. Load the frontend

Load `frontend/resume-doctor.jsx` as a React artifact in claude.ai, or drop it into any Vite/CRA project.

---

## Usage

1. Make sure both `ollama serve` and the FastAPI backend are running
2. Open the frontend — both status indicators in the header should show green
3. Drag your resume PDF onto the drop zone (or switch to paste mode for plain text)
4. Select your Ollama model from the dropdown
5. Click **Run Full Analysis**
6. Navigate the results across five tabs:
   - **Scores** — expandable category cards with findings and recommendations
   - **Keywords** — missing terms ranked by importance with example usage
   - **Rewrites** — before/after suggestions for weak lines
   - **Quick Wins** — immediate fixes
   - **Alt Roles** — other job titles your experience fits

---

## API Reference

### `GET /health`

Returns service status and available extraction libraries.

```bash
curl http://localhost:8765/health
```

```json
{
  "status": "ok",
  "version": "1.0.0",
  "libs": {
    "pdfplumber": true,
    "docx": true,
    "pytesseract": false
  }
}
```

### `POST /extract`

Upload a resume file and receive extracted plain text.

```bash
curl -X POST http://localhost:8765/extract \
  -F "file=@your-resume.pdf" | jq .
```

```json
{
  "text": "Ryan Shorette\nLinux Systems Administrator...",
  "word_count": 847,
  "page_count": 2,
  "extraction_method": "pdfplumber",
  "warnings": [],
  "filename": "resume.pdf",
  "size_kb": 142.3
}
```

Supported file types: `.pdf`, `.docx`, `.txt`  
Max file size: 10MB

---

## Project Structure

```
resume-doctor/
├── backend/
│   ├── server.py          # FastAPI app — /health and /extract endpoints
│   └── requirements.txt
├── frontend/
│   └── resume-doctor.jsx  # Full React app — single file, no build step needed
├── start.sh               # One-command backend launcher (handles venv + pip)
└── README.md
```

---

## Configuration

The backend runs on port `8765` and Ollama on `11434` by default. Both are set at the top of `resume-doctor.jsx`:

```js
const OLLAMA_BASE = "http://localhost:11434";
const API_BASE    = "http://localhost:8765";
```

Change these if your services run on different hosts or ports.

The LLM scoring rubric is embedded in the `SYSTEM_PROMPT` constant in the frontend. It covers the full scoring criteria — ATS formatting rules, Linux/DevOps keyword expectations, certification gaps, tone and language standards, and quantifiable result requirements. Edit it to tune the analysis for different industries or roles.

---

## Optional: OCR for Scanned PDFs

If your PDF is image-based (no selectable text — common with scanned resumes), install OCR support:

```bash
# Ubuntu/Debian
sudo apt install tesseract-ocr poppler-utils

# macOS
brew install tesseract poppler

# Python packages
pip install pytesseract pdf2image
```

The `/health` endpoint will report `"pytesseract": true` once it's installed, and the backend will automatically fall back to OCR when pdfplumber extracts fewer than 50 words.

---

## Recommended Models

| Model | Speed | Quality | Notes |
|-------|-------|---------|-------|
| `llama3` | Fast | Good | Best for quick iteration |
| `mistral` | Fast | Good | Solid JSON adherence |
| `qwen2.5:14b` | Medium | Great | Recommended for production use |
| `deepseek-r1:14b` | Slow | Best | Most thorough analysis |

Smaller models (under 7B) sometimes fail to return valid JSON. If you see a parse error, switch to a larger model.

---

## Troubleshooting

**"API offline" in the frontend**
→ Verify the backend is running: `curl http://localhost:8765/health`

**"Ollama not found"**
→ Run `ollama serve` in a separate terminal before starting the frontend

**PDF extracts very little or no text**
→ Your PDF is image-based. Install OCR support (see above)

**JSON parse error from model**
→ Switch to a 7B+ model. Small models don't reliably follow structured output instructions

**CORS error in browser console**
→ The backend allows all origins by default. If you've locked it down, add your frontend origin to the `allow_origins` list in `server.py`

---

## License

MIT
