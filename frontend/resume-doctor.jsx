import React, { useState, useEffect } from "react";

export default function ResumeDoctor() {
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Checking API...");
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("http://localhost:8000/health");
        if (res.ok) setStatus("API Online");
      } catch {
        setStatus("API Offline");
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDrop = async (e) => {
    e.preventDefault();
    const uploadedFile = e.dataTransfer.files[0];
    setFile(uploadedFile);

    const formData = new FormData();
    formData.append("file", uploadedFile);

    const response = await fetch("http://localhost:8000/extract", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    setText(data.text || data.error);
    setMeta(data);
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Resume Doctor v2</h1>
      <p>Status: {status}</p>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          border: "2px dashed #aaa",
          padding: "2rem",
          marginTop: "1rem",
          textAlign: "center",
        }}
      >
        Drag and drop your resume (PDF, DOCX, TXT)
      </div>

      {file && (
        <div style={{ marginTop: "1rem" }}>
          <strong>Uploaded:</strong> {file.name}
        </div>
      )}

      {meta && (
        <div style={{ marginTop: "1rem" }}>
          <strong>Extraction:</strong> {meta.method} | Words: {meta.words}
        </div>
      )}

      {text && (
        <textarea
          value={text}
          readOnly
          rows={15}
          style={{ width: "100%", marginTop: "1rem" }}
        />
      )}
    </div>
  );
}
