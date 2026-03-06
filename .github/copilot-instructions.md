---
name: resume-doctor-instructions
description: Coding guidelines and best practices for Resume-Doctor project. Ensures consistency across React components, API integration, error handling, and LLM prompt management. Use when developing new features, refactoring components, or implementing backend services.
---

# Resume-Doctor Development Guidelines

Resume-Doctor is a **local-first resume analyzer** combining React frontend with FastAPI backend and Ollama LLM. These instructions ensure consistency, maintainability, and alignment with the project's privacy-first, modular architecture.

## Project Architecture

```
Resume-Doctor
├── Frontend: React (resume-doctor-v2.jsx)
├── Backend: FastAPI (server.py - extract text from resumes)
├── LLM: Ollama (local inference on port 11434)
└── Services
    ├── PDF extraction: pdfplumber
    ├── DOCX extraction: python-docx
    └── OCR fallback: pytesseract
```

---

## 1. Frontend React Guidelines

### 1.1 Component Organization

**Current State:** Single 1100-line `resume-doctor-v2.jsx` file contains 6+ components.

**Best Practice:** Split into separate component files for maintainability:
```
frontend/
├── components/
│   ├── ScoreRing.jsx         # Circular progress SVG
│   ├── CategoryCard.jsx       # Expandable category display
│   ├── DropZone.jsx           # File upload area
│   ├── Tab.jsx                # Tab selector
│   ├── StatusDot.jsx          # Service health indicator
│   └── ResultTabs.jsx         # Tab content wrapper
├── hooks/
│   ├── useResumeAnalysis.js   # Orchestrates API + Ollama calls
│   └── useHealthCheck.js      # Service availability polling
├── constants/
│   ├── colors.js              # Color palette
│   ├── endpoints.js           # API/Ollama URIs
│   └── prompts.js             # System & user prompts
└── App.jsx                    # Main container
```

**Why:** 
- Reduces cognitive load per file
- Enables parallel component testing
- Facilitates code reuse and sharing between tools

### 1.2 Styling Standards

All components use **inline styles** with our dark theme color palette:

```javascript
// Use semantic color names, not hex literals
const COLORS = {
  bg: "#020817",           // Deep navy background
  surface: "#0a0f1e",      // Card surface
  border: "#1e293b",       // Border/divider
  text: "#e2e8f0",         // Light text
  textMuted: "#94a3b8",    // Secondary text
  accent: {
    cyan: "#38bdf8",       // Primary accent
    indigo: "#6366f1",     // Secondary
    green: "#22c55e",      // Success
    amber: "#f59e0b",      // Warning
    red: "#ef4444",        // Danger
  }
};

// ✓ GOOD: Semantic color usage
<div style={{ background: COLORS.surface, color: COLORS.text }}>
  
// ✗ AVOID: Hardcoded hex colors scattered throughout
<div style={{ background: "#0f172a", color: "#e2e8f0" }}>
```

**Standards:**
- Extract hardcoded colors to a centralized `constants/colors.js`
- Use Flexbox for layout (no CSS Grid for simplicity in local tools)
- Support dark theme only (no light mode variants)

### 1.3 State Management

Recommended pattern for complex components (11+ useState):

```javascript
// Instead of multiple useState calls:
// ✗ AVOID
const [result, setResult] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const [tab, setTab] = useState(0);
// ... 8 more useState calls

// ✓ PREFER: useReducer for related state
const [state, dispatch] = useReducer(appReducer, initialState);

const appReducer = (state, action) => {
  switch (action.type) {
    case "SET_RESULT": return { ...state, result: action.payload };
    case "SET_LOADING": return { ...state, loading: action.payload };
    case "SET_ERROR": return { ...state, error: action.payload };
    case "SET_TAB": return { ...state, tab: action.payload };
    default: return state;
  }
};
```

**When to use:**
- 5+ interdependent state variables → `useReducer`
- Single, independent values → `useState`
- Cross-component state → Context API (only if necessary)

### 1.4 API Integration Pattern

All API calls follow this consistent error handling + retry pattern:

```javascript
// ✓ GOOD: Error handling with user feedback
const callApi = useCallback(async (endpoint, options = {}) => {
  try {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", ...options.headers },
      body: options.body ? JSON.stringify(options.body) : null,
    });
    
    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }
    
    return await res.json();
  } catch (err) {
    dispatch({ type: "SET_ERROR", payload: err.message });
    console.error("API call failed:", err);
    throw err;
  } finally {
    dispatch({ type: "SET_LOADING", payload: false });
  }
}, []);
```

### 1.5 LLM Streaming Display

Resume analysis results stream from Ollama. Display output **chunk-by-chunk** to provide real-time feedback:

```javascript
// ✓ GOOD: Stream handler with incremental display
const handleStreamResponse = useCallback(async (response) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    
    // Parse complete JSON objects from buffer
    const lines = buffer.split("\n");
    for (const line of lines.slice(0, -1)) {
      if (line.trim()) {
        try {
          const chunk = JSON.parse(line);
          dispatch({ type: "APPEND_RESULT", payload: chunk });
        } catch (e) {
          // Incomplete JSON, accumulate more data
        }
      }
    }
    buffer = lines[lines.length - 1];
  }
}, []);
```

---

## 2. Backend API Guidelines

**Required File:** `server.py` (currently missing)

### 2.1 Endpoint Specifications

```python
# FastAPI endpoint contract
from fastapi import FastAPI, File, UploadFile, HTTPException
from pydantic import BaseModel
from typing import Literal
import pdfplumber
from docx import Document
import pytesseract

app = FastAPI()
ALLOWED_FORMATS = {"pdf", "docx", "txt"}

class ExtractionResponse(BaseModel):
    text: str                        # Plain extracted text
    word_count: int                  # Token count for display
    page_count: int                  # Pages (PDF only)
    extraction_method: str           # "pdfplumber" | "docx" | "ocr"
    filename: str                    # Original filename
    size_kb: float                   # File size
    warnings: list[str]              # Extraction issues

class HealthResponse(BaseModel):
    api_healthy: bool
    ollama_healthy: bool
    available_extractors: dict       # { "pdf": True, "docx": True, "ocr": True }
```

### 2.2 Endpoints

#### `GET /health`
Returns availability of API and extraction libraries. Called every 10 seconds by frontend.

```python
@app.get("/health")
async def health_check():
    return HealthResponse(
        api_healthy=True,
        ollama_healthy=await check_ollama(),
        available_extractors={
            "pdf": HAS_PDFPLUMBER,
            "docx": HAS_PYTHON_DOCX,
            "ocr": HAS_PYTESSERACT,
        }
    )
```

#### `POST /extract`
Receives uploaded file, extracts plain text, returns structured metadata.

```python
@app.post("/extract", response_model=ExtractionResponse)
async def extract_resume(file: UploadFile = File(...)):
    """
    Extract text from resume (PDF, DOCX, or TXT).
    
    Supported formats:
    - PDF: uses pdfplumber (falls back to OCR if malformed)
    - DOCX: uses python-docx
    - TXT: returns as-is
    
    Returns: Extracted text + metadata
    Raises: 422 if unsupported format
    """
    if not file.filename:
        raise HTTPException(400, "No file provided")
    
    ext = file.filename.split(".")[-1].lower()
    if ext not in ALLOWED_FORMATS:
        raise HTTPException(422, f"Unsupported format: .{ext}")
    
    content = await file.read()
    
    try:
        if ext == "pdf":
            text = extract_pdf(content)
            method = "pdfplumber"
        elif ext == "docx":
            text = extract_docx(content)
            method = "docx"
        else:  # txt
            text = content.decode("utf-8")
            method = "text"
        
        return ExtractionResponse(
            text=text,
            word_count=len(text.split()),
            page_count=estimate_pages(text),
            extraction_method=method,
            filename=file.filename,
            size_kb=len(content) / 1024,
            warnings=[]
        )
    except Exception as e:
        raise HTTPException(500, f"Extraction failed: {str(e)}")
```

### 2.3 Error Handling

All errors return structured JSON with `error` field:

```python
# ✓ GOOD: Structured error responses
from fastapi.exceptions import HTTPException

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "timestamp": datetime.now().isoformat(),
            "path": str(request.url),
        }
    )
```

### 2.4 Configuration

Use environment variables for service URLs:

```python
import os

OLLAMA_BASE = os.getenv("OLLAMA_BASE", "http://localhost:11434")
API_BASE = os.getenv("API_BASE", "http://localhost:8765")

# Load from .env file
from dotenv import load_dotenv
load_dotenv()
```

---

## 3. LLM Prompt Management

### 3.1 Prompt Architecture

The embedded system and user prompts should be extracted to separate files:

```
prompts/
├── system.md        # Role definition, scoring rubric, output format
└── user.md          # Template with {resume_text} placeholder
```

**Why:** 
- Easier to iterate and test prompts independently
- Version control across models (llama3, mistral, etc.)
- Swap prompts without redeploying frontend

### 3.2 System Prompt Guidelines

The **system prompt** defines the AI's role, expertise, scoring rubric, and rigid output format:

```markdown
# System Prompt: Resume Analyst

You are an elite resume analyst specializing in ATS optimization and remote tech roles.

## Output Format (CRITICAL)
Return ONLY a valid JSON object — no markdown, code blocks, or explanation:

{
  "overall_score": <0-100>,
  "target_role": "<detected job title>",
  ...
}

## Scoring Categories
1. **ATS Compatibility** (weight: high)
   - Assess: Graphics, headers, special characters, parsing safety
   - Recommendations: Plain lists, avoid tables/boxes

2. **Keyword Coverage** (weight: high)
   - Assess: Job-relevant technical keywords
   - Recommendations: Add missing skills from job description

... (repeat for 8 categories total)

## Special Handling
- For Linux/DevOps/SRE: Emphasize shell scripting, infrastructure keywords
- For remote roles: Look for async communication, timezone flexibility signals
```

### 3.3 Prompt Versioning

Track prompt versions with model compatibility:

```javascript
const PROMPTS = {
  v1: {
    model: ["llama3", "mistral"],
    systemPrompt: "...",  // Current production prompt
    created: "2025-01-15",
    description: "8-category scoring with focus on ATS + keywords"
  },
  v2: {
    model: ["llama3:70b"],
    systemPrompt: "...",  // Experimental for larger models
    created: "2025-02-15",
    description: "Extended rubric + interview readiness"
  }
};

const ACTIVE_PROMPT = PROMPTS.v1;
```

---

## 4. Testing & Validation

### 4.1 Backend Tests

Create `tests/test_extract.py`:

```python
import pytest
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["api_healthy"] is True

def test_extract_pdf_valid():
    with open("tests/fixtures/sample.pdf", "rb") as f:
        response = client.post("/extract", files={"file": f})
    assert response.status_code == 200
    assert "text" in response.json()
    assert response.json()["extraction_method"] == "pdfplumber"

def test_extract_unsupported_format():
    # Attempt to extract .exe → 422
    response = client.post("/extract", files={"file": ("test.exe", b"binary")})
    assert response.status_code == 422
```

**Run tests:**
```bash
pytest tests/ -v
```

### 4.2 Frontend Integration Tests

For React components, verify:
- File uploads trigger API calls ✓
- Results render correctly ✓
- Error states display messages ✓
- Health checks update status dots ✓

---

## 5. Configuration & Constants

### 5.1 Move Hardcoded Values to Configuration

Create `frontend/constants/config.js`:

```javascript
// Services
export const SERVICES = {
  API: {
    base: process.env.REACT_APP_API_BASE || "http://localhost:8765",
    endpoints: {
      health: "/health",
      extract: "/extract",
    }
  },
  OLLAMA: {
    base: process.env.REACT_APP_OLLAMA_BASE || "http://localhost:11434",
    endpoints: {
      generate: "/api/generate",
      tags: "/api/tags",
    }
  }
};

// UI
export const TIMEOUTS = {
  healthCheck: 10000,        // ms between health checks
  ollama: 300000,            // ms max wait for LLM response
  upload: 60000,             // ms max wait for file upload
};

export const MODELS = [
  { id: "llama3", label: "Llama 3 (fast)" },
  { id: "mistral", label: "Mistral (balanced)" },
  { id: "qwen2.5", label: "Qwen 2.5 (accurate)" },
];
```

### 5.2 Environment Variables

Create `.env.example`:

```bash
# Frontend (next to package.json)
REACT_APP_API_BASE=http://localhost:8765
REACT_APP_OLLAMA_BASE=http://localhost:11434

# Backend (.env in server.py directory)
OLLAMA_BASE=http://localhost:11434
API_HOST=0.0.0.0
API_PORT=8765
LOG_LEVEL=INFO
```

---

## 6. Documentation Standards

### 6.1 Code Comments

Add comments for:
- **Non-obvious logic:** Why are we doing this?
- **Complex algorithms:** What problem does this solve?
- **Integration points:** How does this connect to other services?

```javascript
// ✓ GOOD: Explains the "why"
useEffect(() => {
  // Poll health every 10s to detect Ollama drops
  // (user may have stopped Ollama without restarting browser)
  const interval = setInterval(checkHealth, 10000);
  return () => clearInterval(interval);
}, []);

// ✗ AVOID: Obvious comments
// Set loading to true
setLoading(true);
```

### 6.2 Component JSDoc

Document props, behavior, and dependencies:

```javascript
/**
 * CategoryCard - Displays a single scoring category with findings and recommendations
 * 
 * @component
 * @param {Object} cat - Category data from analysis result
 * @param {number} cat.score - Score 0-100
 * @param {string} cat.name - Category name (e.g., "ATS Compatibility")
 * @param {string[]} cat.findings - List of findings
 * @param {string[]} cat.recommendations - List of improvement recommendations
 * @param {("high"|"medium"|"low")} cat.weight - Priority weight
 * 
 * @returns {JSX.Element} Expandable card with findings/recommendations
 * 
 * @example
 * <CategoryCard cat={{ score: 85, name: "ATS Compatibility", ... }} />
 */
export const CategoryCard = ({ cat }) => { ... };
```

### 6.3 API Documentation

Document endpoint contracts in `docs/api.md`:

```markdown
## POST /extract

Extract text and metadata from resume file.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: `file` (FormData field with file)

**Response (200):**
```json
{
  "text": "string (extracted resume text)",
  "word_count": "integer",
  "page_count": "integer (PDF) or null",
  "extraction_method": "pdfplumber|docx|text",
  "filename": "string",
  "size_kb": "float",
  "warnings": ["optional warning messages"]
}
```

**Errors:**
- 400: No file provided
- 422: Unsupported format (.exe, etc.)
- 500: Extraction failed
```

---

## 7. Code Quality Checklist

Before committing changes:

- [ ] **Components** are <300 lines; consider splitting
- [ ] **Colors** use `COLORS` constant, not hardcoded hex
- [ ] **API calls** include error handling + user feedback
- [ ] **State** uses `useReducer` if 5+ variables
- [ ] **Prompts** are versioned in config, not hardcoded
- [ ] **Environment-specific** values use `.env`, not literals
- [ ] **Comments** explain "why", not "what"
- [ ] **Tests** cover happy path + error cases
- [ ] **Accessibility**: ARIA labels on interactive elements
- [ ] **Performance**: No infinite loops; useCallback on handlers

---

## 8. Common Patterns & Solutions

### Pattern: File Upload with Streaming Response

```javascript
// Frontend
const handleUpload = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/extract`, {
    method: "POST",
    body: formData,
  });

  // Streaming JSON objects
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value);
    
    // Parse and display chunks...
  }
};
```

### Pattern: Service Health Polling

```javascript
const [services, setServices] = useState({ api: false, ollama: false });

useEffect(() => {
  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`, { timeout: 2000 });
      const data = await res.json();
      setServices({ api: res.ok, ollama: data.ollama_healthy });
    } catch {
      setServices({ api: false, ollama: false });
    }
  };

  checkHealth();
  const interval = setInterval(checkHealth, 10000);
  return () => clearInterval(interval);
}, []);

// Render status dot
<StatusDot healthy={services.api && services.ollama} />
```

---

## 9. Known Limitations & Workarounds

| Issue | Status | Workaround |
|-------|--------|-----------|
| OCR fails on scanned resumes | 🟡 Partial | Use Tesseract's high-res preprocessing |
| Ollama drops on long analysis | 🟡 Partial | Increase timeout; reduce prompt length |
| Context window limit (4K tokens) | 🟡 Known | Truncate resume to first 2K tokens |

For blocking issues, file in GitHub Issues with: model used, resume preview (first 100 chars), error message, system specs.

---

## 10. Getting Help & Contributing

**Before asking for help:**
1. Check [RESUME-DOCTOR-README.md](../RESUME-DOCTOR-README.md) for setup/troubleshooting
2. Verify both services running:
   - API: `curl http://localhost:8765/health`
   - Ollama: `curl http://localhost:11434/api/tags`
3. Check browser console for frontend errors

**Contributing new features:**
1. Create feature branch: `git checkout -b feat/feature-name`
2. Follow guidelines above (structure, error handling, tests)
3. Add tests for new endpoints/components
4. Update README if behavior changes
5. Open PR with description of changes

---

Last Updated: 2025-02-05  
Version: 1.0
