import { useState, useCallback, useRef, useEffect } from "react";

const OLLAMA_BASE = "http://localhost:11434";
const API_BASE = "http://localhost:8765";

const SYSTEM_PROMPT = `You are an elite resume analyst and career coach specializing in ATS optimization and remote tech roles. You have deep expertise in Linux systems administration, DevOps, cloud infrastructure, and technical hiring.

Analyze the provided resume and return ONLY a valid JSON object — no markdown, no explanation, no preamble. The JSON must match this exact structure:

{
  "overall_score": <number 0-100>,
  "target_role": "<detected or inferred job title>",
  "summary": "<2-3 sentence executive summary of the resume's strengths and main gaps>",
  "categories": [
    {
      "name": "ATS Compatibility",
      "score": <0-100>,
      "weight": "high",
      "findings": ["<specific finding>"],
      "recommendations": ["<actionable fix>"]
    },
    {
      "name": "Keyword Coverage",
      "score": <0-100>,
      "weight": "high",
      "findings": ["<specific finding>"],
      "recommendations": ["<actionable fix with example>"]
    },
    {
      "name": "Quantifiable Results",
      "score": <0-100>,
      "weight": "high",
      "findings": ["<specific finding>"],
      "recommendations": ["<specific metric example>"]
    },
    {
      "name": "Layout & Readability",
      "score": <0-100>,
      "weight": "medium",
      "findings": ["<specific finding>"],
      "recommendations": ["<actionable fix>"]
    },
    {
      "name": "Language & Professionalism",
      "score": <0-100>,
      "weight": "medium",
      "findings": ["<specific finding>"],
      "recommendations": ["<rewrite example>"]
    },
    {
      "name": "Experience & Achievements",
      "score": <0-100>,
      "weight": "high",
      "findings": ["<specific finding>"],
      "recommendations": ["<actionable fix>"]
    },
    {
      "name": "Remote Work Signals",
      "score": <0-100>,
      "weight": "medium",
      "findings": ["<specific finding>"],
      "recommendations": ["<actionable fix>"]
    },
    {
      "name": "Domain Expertise",
      "score": <0-100>,
      "weight": "high",
      "findings": ["<specific finding>"],
      "recommendations": ["<actionable fix>"]
    }
  ],
  "missing_keywords": [
    { "keyword": "<keyword>", "importance": <1-10>, "example_usage": "<example bullet point>" }
  ],
  "alternate_roles": [
    { "title": "<role title>", "match_reason": "<why they qualify>", "fit_score": <0-100> }
  ],
  "quick_wins": ["<immediate actionable change that takes under 5 minutes>"],
  "rewrite_suggestions": [
    { "original": "<original text from resume>", "improved": "<rewritten version with metrics/impact>" }
  ]
}

Be brutally honest. Score 0-100 accurately. For tech resumes targeting Linux/DevOps/SRE roles, emphasize:
- Shell scripting, SSH, rsync, file system management, server maintenance keywords
- Quantified uptime, server counts, automation percentages
- ATS-safe formatting (no graphics/boxes for skills, plain bullet lists)
- Certifications (RHCSA, CompTIA Linux+, AWS, CKA)
- Formal professional tone (no rhetorical statements)
- 5-10 bullets per role, current role especially`;

const USER_PROMPT = (resumeText) => `Analyze this resume and return ONLY the JSON object as specified:

---RESUME START---
${resumeText}
---RESUME END---`;

// ─── Utilities ────────────────────────────────────────────────────────────────

const weightColor = (w) => w === "high" ? "#ef4444" : w === "medium" ? "#f59e0b" : "#6b7280";

const scoreColor = (s) => s >= 80 ? "#22c55e" : s >= 60 ? "#f59e0b" : "#ef4444";

// ─── Score Ring ───────────────────────────────────────────────────────────────

const ScoreRing = ({ score, size = 120, stroke = 10 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
      />
      <text x={size/2} y={size/2 + 6} textAnchor="middle" fill="white"
        fontSize={size * 0.22} fontWeight="700"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}>
        {score}%
      </text>
    </svg>
  );
};

// ─── Category Card ────────────────────────────────────────────────────────────

const CategoryCard = ({ cat }) => {
  const [open, setOpen] = useState(false);
  const color = scoreColor(cat.score);
  return (
    <div onClick={() => setOpen(!open)} style={{
      background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12,
      padding: "16px 20px", cursor: "pointer", borderLeft: `3px solid ${color}`,
      transition: "border-color 0.2s, background 0.2s"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 15 }}>{cat.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <div style={{ background: "#1e293b", borderRadius: 4, height: 6, width: 160, overflow: "hidden" }}>
              <div style={{ background: color, height: "100%", width: `${cat.score}%`, transition: "width 1s ease", borderRadius: 4 }} />
            </div>
            <span style={{ color, fontWeight: 700, fontSize: 13 }}>{cat.score}%</span>
            <span style={{ background: weightColor(cat.weight), color: "white", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>
              {cat.weight}
            </span>
          </div>
        </div>
        <span style={{ color: "#475569", fontSize: 20, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </div>
      {open && (
        <div style={{ marginTop: 16, borderTop: "1px solid #1e293b", paddingTop: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Findings</div>
            {(cat.findings || []).map((f, i) => (
              <div key={i} style={{ color: "#cbd5e1", fontSize: 13, marginBottom: 6, paddingLeft: 12, borderLeft: "2px solid #334155" }}>{f}</div>
            ))}
          </div>
          <div>
            <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Recommendations</div>
            {(cat.recommendations || []).map((r, i) => (
              <div key={i} style={{ color: "#4ade80", fontSize: 13, marginBottom: 6, paddingLeft: 12, borderLeft: "2px solid #166534" }}>↗ {r}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Tab Button ───────────────────────────────────────────────────────────────

const Tab = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    background: active ? "#0f172a" : "transparent",
    color: active ? "#38bdf8" : "#64748b",
    border: active ? "1px solid #1e293b" : "1px solid transparent",
    borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600,
    cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit"
  }}>{label}</button>
);

// ─── Status Dot ───────────────────────────────────────────────────────────────

const StatusDot = ({ ok, label }) => (
  <span style={{ color: ok ? "#22c55e" : ok === false ? "#ef4444" : "#64748b", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
    <span style={{ width: 8, height: 8, background: ok ? "#22c55e" : ok === false ? "#ef4444" : "#475569", borderRadius: "50%", display: "inline-block", animation: ok ? "pulse 2s infinite" : "none" }} />
    {label}
  </span>
);

// ─── Drop Zone ────────────────────────────────────────────────────────────────

const DropZone = ({ onFile, apiOk }) => {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef();

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (file) { setFileName(file.name); onFile(file); }
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current.click()}
      style={{
        border: `2px dashed ${dragging ? "#38bdf8" : apiOk ? "#334155" : "#1e293b"}`,
        borderRadius: 14, padding: "36px 24px", textAlign: "center", cursor: "pointer",
        background: dragging ? "#0c1628" : "#0a0f1e",
        transition: "all 0.2s", position: "relative"
      }}
    >
      <input ref={inputRef} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }} onChange={handleDrop} />
      <div style={{ fontSize: 32, marginBottom: 10 }}>
        {fileName ? "📄" : dragging ? "📂" : "⬆"}
      </div>
      {fileName ? (
        <div style={{ color: "#38bdf8", fontWeight: 600 }}>{fileName}</div>
      ) : (
        <>
          <div style={{ color: "#94a3b8", fontWeight: 600, marginBottom: 6 }}>
            {apiOk ? "Drop your resume here" : "API server offline"}
          </div>
          <div style={{ color: "#475569", fontSize: 12 }}>
            {apiOk ? "PDF · DOCX · TXT — or click to browse" : "Start the backend: uvicorn server:app --port 8765"}
          </div>
        </>
      )}
      {!apiOk && (
        <div style={{ marginTop: 10, background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: "8px 14px", display: "inline-block" }}>
          <code style={{ color: "#fca5a5", fontSize: 11 }}>uvicorn server:app --host 0.0.0.0 --port 8765 --reload</code>
        </div>
      )}
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function ResumeDoctorApp() {
  const [resumeText, setResumeText] = useState("");
  const [model, setModel] = useState("llama3");
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("score");
  const [ollamaOk, setOllamaOk] = useState(null);
  const [apiOk, setApiOk] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [inputMode, setInputMode] = useState("drop"); // "drop" | "paste"

  // Check both services on load
  useEffect(() => {
    const checkOllama = async () => {
      try {
        const r = await fetch(`${OLLAMA_BASE}/api/tags`);
        const d = await r.json();
        const ms = (d.models || []).map(m => m.name);
        setModels(ms);
        if (ms.length > 0) setModel(ms[0]);
        setOllamaOk(true);
      } catch { setOllamaOk(false); }
    };

    const checkApi = async () => {
      try {
        const r = await fetch(`${API_BASE}/health`);
        if (r.ok) setApiOk(true); else setApiOk(false);
      } catch { setApiOk(false); }
    };

    checkOllama();
    checkApi();
    const id = setInterval(() => { checkOllama(); checkApi(); }, 10000);
    return () => clearInterval(id);
  }, []);

  // Handle file upload to backend
  const handleFile = useCallback(async (file) => {
    if (!apiOk) {
      setError("Backend API is offline. Start it with: uvicorn server:app --host 0.0.0.0 --port 8765");
      return;
    }
    setUploadLoading(true);
    setError("");
    setFileInfo(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API_BASE}/extract`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `Server error ${res.status}`);
      }

      const data = await res.json();
      setResumeText(data.text);
      setFileInfo({ name: data.filename, words: data.word_count, pages: data.page_count, method: data.extraction_method, warnings: data.warnings });

      if (data.warnings?.length > 0) {
        setError(data.warnings.join(" | "));
      }
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setUploadLoading(false);
    }
  }, [apiOk]);

  // Run LLM analysis
  const analyze = async () => {
    if (!resumeText.trim()) { setError("Load a resume first."); return; }
    setLoading(true); setError(""); setResult(null); setStreaming("");

    try {
      const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          system: SYSTEM_PROMPT,
          prompt: USER_PROMPT(resumeText),
          stream: true,
          options: { temperature: 0.3, num_predict: 4096 }
        })
      });

      let fullText = "";
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.response) { fullText += obj.response; setStreaming(fullText); }
          } catch {}
        }
      }

      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Model didn't return valid JSON. Try a larger model.");
      const parsed = JSON.parse(jsonMatch[0]);
      setResult(parsed);
      setTab("score");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false); setStreaming("");
    }
  };

  const reset = () => { setResult(null); setResumeText(""); setFileInfo(null); setError(""); };

  return (
    <div style={{ minHeight: "100vh", background: "#020817", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
        textarea:focus, input:focus, select:focus { outline: none; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        .fade { animation: fadeIn 0.4s ease forwards; }
        .glow { box-shadow: 0 0 24px rgba(56,189,248,0.12); }
      `}</style>

      {/* ── Header ── */}
      <div style={{ borderBottom: "1px solid #1e293b", padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0f1e", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)", borderRadius: 10, padding: "8px 12px", fontSize: 18 }}>⚕</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#f1f5f9", letterSpacing: "-0.02em" }}>Resume Doctor</div>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase" }}>Ollama · Local · Private</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <StatusDot ok={apiOk} label={apiOk ? "API :8765" : apiOk === false ? "API offline" : "API checking..."} />
          <StatusDot ok={ollamaOk} label={ollamaOk ? "Ollama :11434" : ollamaOk === false ? "Ollama offline" : "checking..."} />
          {models.length > 0 && (
            <select value={model} onChange={e => setModel(e.target.value)} style={{
              background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0",
              borderRadius: 8, padding: "6px 12px", fontSize: 12, fontFamily: "inherit", cursor: "pointer"
            }}>
              {models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {/* ── Input Panel ── */}
        {!result && (
          <div className="fade" style={{ background: "#0a0f1e", border: "1px solid #1e293b", borderRadius: 16, padding: 28, marginBottom: 24 }}>

            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["drop", "paste"].map(mode => (
                <button key={mode} onClick={() => setInputMode(mode)} style={{
                  background: inputMode === mode ? "#1e293b" : "transparent",
                  color: inputMode === mode ? "#38bdf8" : "#475569",
                  border: `1px solid ${inputMode === mode ? "#334155" : "transparent"}`,
                  borderRadius: 8, padding: "6px 16px", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.05em"
                }}>
                  {mode === "drop" ? "📎 Upload File" : "📋 Paste Text"}
                </button>
              ))}
            </div>

            {inputMode === "drop" ? (
              <>
                {uploadLoading ? (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ width: 32, height: 32, border: "3px solid #1e293b", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
                    <div style={{ color: "#64748b", fontSize: 13 }}>Extracting text from PDF...</div>
                  </div>
                ) : (
                  <DropZone onFile={handleFile} apiOk={apiOk} />
                )}
              </>
            ) : (
              <textarea
                value={resumeText}
                onChange={e => setResumeText(e.target.value)}
                placeholder="Paste the full plain text of your resume here..."
                style={{
                  width: "100%", minHeight: 240, background: "#020817", border: "1px solid #1e293b",
                  borderRadius: 10, color: "#cbd5e1", fontSize: 13, lineHeight: 1.7,
                  padding: "16px", resize: "vertical", fontFamily: "inherit"
                }}
              />
            )}

            {/* File info badge */}
            {fileInfo && (
              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { label: "File", val: fileInfo.name },
                  { label: "Words", val: fileInfo.words?.toLocaleString() },
                  fileInfo.pages && { label: "Pages", val: fileInfo.pages },
                  { label: "Parser", val: fileInfo.method },
                ].filter(Boolean).map((item, i) => (
                  <span key={i} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "#94a3b8" }}>
                    <span style={{ color: "#475569" }}>{item.label}: </span>{item.val}
                  </span>
                ))}
              </div>
            )}

            {error && <div style={{ color: "#f87171", fontSize: 12, marginTop: 12, background: "#1a0909", border: "1px solid #7f1d1d", borderRadius: 8, padding: "8px 14px" }}>⚠ {error}</div>}

            <div style={{ marginTop: 18, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button
                onClick={analyze}
                disabled={loading || !resumeText.trim() || uploadLoading}
                style={{
                  background: loading ? "#1e293b" : "linear-gradient(135deg, #0ea5e9, #6366f1)",
                  color: "white", border: "none", borderRadius: 10, padding: "12px 28px",
                  fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "inherit", opacity: !resumeText.trim() ? 0.4 : 1, transition: "opacity 0.2s"
                }}
              >
                {loading ? "Analyzing..." : "Run Full Analysis →"}
              </button>
              {resumeText.trim() && (
                <span style={{ color: "#475569", fontSize: 12 }}>
                  {resumeText.split(/\s+/).filter(Boolean).length.toLocaleString()} words ready
                </span>
              )}
            </div>

            {streaming && (
              <div style={{ marginTop: 16, background: "#020817", border: "1px solid #1e293b", borderRadius: 8, padding: 14, maxHeight: 110, overflow: "hidden", position: "relative" }}>
                <div style={{ color: "#22c55e", fontSize: 11, marginBottom: 4, animation: "pulse 1s infinite" }}>● THINKING...</div>
                <div style={{ color: "#334155", fontSize: 11 }}>{streaming.slice(-400)}</div>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 28, background: "linear-gradient(transparent, #020817)" }} />
              </div>
            )}
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <div className="fade">
            {/* Score banner */}
            <div style={{
              background: "linear-gradient(135deg, #0a0f1e, #0f172a)",
              border: `1px solid ${scoreColor(result.overall_score)}33`,
              borderRadius: 16, padding: "28px 32px", marginBottom: 24,
              display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap"
            }} className="glow">
              <ScoreRing score={result.overall_score} size={110} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Analysis Complete</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>{result.target_role || "Resume Score"}</div>
                <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, maxWidth: 580 }}>{result.summary}</div>
              </div>
              <button onClick={reset} style={{
                background: "#1e293b", border: "1px solid #334155", color: "#94a3b8",
                borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontFamily: "inherit"
              }}>← New Analysis</button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                ["score", "📊 Scores"],
                ["keywords", "🔑 Keywords"],
                ["rewrites", "✏️ Rewrites"],
                ["quick_wins", "⚡ Quick Wins"],
                ["roles", "🎯 Alt Roles"]
              ].map(([t, label]) => <Tab key={t} label={label} active={tab === t} onClick={() => setTab(t)} />)}
            </div>

            {/* Score breakdown */}
            {tab === "score" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))", gap: 12 }}>
                {(result.categories || []).map((cat, i) => <CategoryCard key={i} cat={cat} />)}
              </div>
            )}

            {/* Keywords */}
            {tab === "keywords" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
                {(result.missing_keywords || []).map((kw, i) => (
                  <div key={i} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ color: "#38bdf8", fontWeight: 700, fontSize: 14 }}>{kw.keyword}</span>
                      <span style={{ background: kw.importance >= 9 ? "#ef4444" : kw.importance >= 7 ? "#f59e0b" : "#22c55e", color: "white", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
                        {kw.importance}/10
                      </span>
                    </div>
                    <div style={{ color: "#64748b", fontSize: 12, fontStyle: "italic", lineHeight: 1.5 }}>"{kw.example_usage}"</div>
                  </div>
                ))}
              </div>
            )}

            {/* Rewrites */}
            {tab === "rewrites" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {(result.rewrite_suggestions || []).map((rw, i) => (
                  <div key={i} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 20 }}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Original</div>
                      <div style={{ color: "#ef4444", background: "#1f0a0a", borderRadius: 6, padding: "10px 14px", fontSize: 13, lineHeight: 1.6 }}>— {rw.original}</div>
                    </div>
                    <div>
                      <div style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Improved</div>
                      <div style={{ color: "#4ade80", background: "#0a1f0a", borderRadius: 6, padding: "10px 14px", fontSize: 13, lineHeight: 1.6 }}>↗ {rw.improved}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick wins */}
            {tab === "quick_wins" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(result.quick_wins || []).map((win, i) => (
                  <div key={i} style={{ background: "#0f172a", border: "1px solid #1e293b", borderLeft: "3px solid #22c55e", borderRadius: 12, padding: "14px 20px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ color: "#22c55e", fontWeight: 700, minWidth: 20 }}>⚡</span>
                    <span style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>{win}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Alternate roles */}
            {tab === "roles" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                {(result.alternate_roles || []).map((role, i) => (
                  <div key={i} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "18px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>{role.title}</div>
                      <span style={{ background: scoreColor(role.fit_score), color: "white", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>{role.fit_score}%</span>
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>{role.match_reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 48, textAlign: "center", color: "#1e293b", fontSize: 10 }}>
          resume doctor · 100% local · zero data sent anywhere · ollama + fastapi
        </div>
      </div>
    </div>
  );
}
