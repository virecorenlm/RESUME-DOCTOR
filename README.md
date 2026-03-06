# ⚕️ Resume Doctor

A fully local resume analyzer powered by Ollama. Drop in your resume as a PDF, DOCX, or plain text and get back a scored, structured report covering ATS compatibility, missing keywords, rewrite suggestions, quick wins, and alternate role matches — all running on your own machine.

**No cloud. No subscriptions. No data leaving your machine.**

---

## How It Works

```
Your Resume (PDF · DOCX · TXT)
         │
         ▼
 FastAPI + pdfplumber     ←  extracts clean text from your file
         │
         ▼
   Ollama (local LLM)     ←  scores resume across 8 categories, returns JSON
         │
         ▼
    React Frontend        ←  renders your full report with tabs, scores, and diffs
```

---

## What You Get

| Tab | What's Inside |
|-----|---------------|
| 📊 **Scores** | 8 scored categories — click any to expand findings and recommendations |
| 🔑 **Keywords** | Missing terms ranked by importance with example bullet points |
| ✏️ **Rewrites** | Side-by-side before/after diffs for weak resume lines |
| ⚡ **Quick Wins** | Fixes you can make in under 5 minutes |
| 🎯 **Alt Roles** | Other job titles your experience qualifies for |

**Scored categories:** ATS Compatibility · Keyword Coverage · Quantifiable Results · Layout & Readability · Language & Professionalism · Experience & Achievements · Remote Work Signals · Domain Expertise

---

## Project Structure

```
RESUME-DOCTOR/
├── backend/
│   ├── server.py               # FastAPI app — handles file upload and text extraction
│   └── requirements.txt        # Python dependencies
├── frontend/
│   ├── resume-doctor.jsx       # Original React app (single file)
│   └── resume-doctor-v2.jsx    # v2 with drag-and-drop and backend integration
├── resume-doctor-app/          # Standalone React app (npm start)
│   ├── src/
│   │   ├── App.js
│   │   ├── ResumeDoctorApp.js
│   │   └── index.js
│   ├── public/index.html
│   └── package.json
├── start.sh                    # One-command backend launcher (Linux/macOS)
└── README.md
```

---

## Requirements

- **Python 3.10+**
- **[Ollama](https://ollama.com)** — installed and running locally
- **Node.js 18+** — only needed if running `resume-doctor-app` locally

---

## Setup & Installation

You need two things running at the same time: Ollama and the FastAPI backend. Open two terminal windows.

---

### Terminal 1 — Start Ollama

```bash
ollama serve
```

Pull a model if you haven't already:

```bash
ollama pull llama3        # recommended — fast and reliable
```

---

### Terminal 2 — Start the Backend

**Linux / macOS:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8765 --reload
```

Or use the launcher script which handles all of that automatically:
```bash
chmod +x start.sh
./start.sh
```

**Windows (PowerShell):**

> First time only — allow scripts to run:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8765 --reload
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8765 (Press CTRL+C to quit)
```

Keep this window open — closing it stops the backend.

---

### Verify Both Services Are Up

**Linux / macOS:**
```bash
curl http://localhost:8765/health
curl http://localhost:11434/api/tags
```

**Windows:**
```powershell
curl http://localhost:8765/health -UseBasicParsing
curl http://localhost:11434/api/tags -UseBasicParsing
```

Both should return JSON. If the health check fails, the backend isn't running yet.

---

## Running the Frontend

You have two options:

### Option A — Claude.ai Artifact (easiest, no install)
Load `frontend/resume-doctor-v2.jsx` directly as a React artifact in claude.ai. Both status dots in the header will turn green once Ollama and the backend are up.

### Option B — Local React App
```bash
cd resume-doctor-app
npm install
npm start
```
Opens at `http://localhost:3000`.

---

## Using Resume Doctor

1. Both status dots in the header should be **green** before you start
2. **Drag your resume** onto the drop zone — PDF, DOCX, and TXT are all supported
3. Or switch to **Paste Text** mode and paste your resume content directly
4. **Pick your model** from the dropdown (llama3 is a solid default)
5. Click **Run Full Analysis** and watch it stream in real time
6. Click through the tabs to explore your full report

---

## Configuration

The backend port and Ollama URL are set at the top of the `.jsx` file:

```js
const OLLAMA_BASE = "http://localhost:11434";
const API_BASE    = "http://localhost:8765";
```

Change these if your services run on different hosts or ports.

The scoring logic lives in the `SYSTEM_PROMPT` constant in the frontend. It's tuned for Linux/DevOps/SRE roles by default — edit it to target different industries or job titles.

---

## Recommended Models

| Model | Speed | Quality | Notes |
|-------|-------|---------|-------|
| `llama3` | ⚡ Fast | Good | Best starting point |
| `mistral` | ⚡ Fast | Good | Strong JSON adherence |
| `qwen2.5:14b` | 🔶 Medium | Great | Recommended for best results |
| `deepseek-r1:14b` | 🐢 Slow | Best | Most thorough analysis |

> Models under 7B parameters sometimes fail to return valid JSON. If you see a parse error, switch to a larger model.

---

## API Reference

### `GET /health`
Check that the backend is running and see which libraries are available.

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
Upload a resume file, get back extracted plain text.

```bash
# Linux/macOS
curl -X POST http://localhost:8765/extract -F "file=@resume.pdf" | jq .

# Windows PowerShell
curl -Uri http://localhost:8765/extract -Method Post -Form @{file=Get-Item .\resume.pdf} -UseBasicParsing
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

Accepted file types: `.pdf` · `.docx` · `.txt` — max 10MB

---

## Optional: OCR for Scanned PDFs

If your PDF is image-based (no selectable text), the extractor will warn you. Fix it by installing OCR support:

**Linux:**
```bash
sudo apt install tesseract-ocr poppler-utils
pip install pytesseract pdf2image
```

**macOS:**
```bash
brew install tesseract poppler
pip install pytesseract pdf2image
```

**Windows:**
Install [Tesseract for Windows](https://github.com/UB-Mannheim/tesseract/wiki), then:
```powershell
pip install pytesseract pdf2image
```

Once installed, `/health` will report `"pytesseract": true` and the backend will automatically fall back to OCR when pdfplumber can't extract enough text.

---

## Troubleshooting

**"API offline" in the frontend**
→ The backend isn't running. Start it with `uvicorn server:app --host 0.0.0.0 --port 8765 --reload` from inside the `backend/` folder.

**"Ollama not found"**
→ Run `ollama serve` in a separate terminal and keep it open.

**`pip install` fails or `.venv\Scripts\activate` errors on Windows**
→ Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` first, then try again.

**`Cannot find module "server"` error**
→ Make sure you're running uvicorn from inside the `backend/` folder, not the project root.

**PDF extracted with very few words**
→ Your PDF is image-based. Use the OCR setup above, or switch to Paste Text mode and copy-paste from your PDF reader.

**JSON parse error from model**
→ Switch to a larger model (7B+). Smaller models don't reliably follow structured output format.

**PowerShell `curl` asks about script execution**
→ Always add `-UseBasicParsing` to your curl commands in PowerShell.

---

## License

MIT
