"use client";

import React, { useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { Trash2, Key, Sliders, Database, FileText, LogOut, Check, ToggleLeft, ToggleRight } from "lucide-react";

interface UploadedDocument {
  id: string;
  name: string;
  chunkCount: number;
}

interface ParameterPanelProps {
  parameters: {
    chunkSize: number;
    chunkOverlap: number;
    k: number;
    googleApiKey: string;
    pineconeApiKey: string;
    pineconeIndexName: string;
    systemPrompt: string;
  };
  setParameters: React.Dispatch<React.SetStateAction<any>>;
  onUploadDocument: (name: string, content: string) => void;
  selectedDocId: string | null;
  onSelectDoc: (docId: string) => void;
  localMode: boolean;
  setLocalMode: (val: boolean) => void;
}

export function ParameterPanel({
  parameters,
  setParameters,
  onUploadDocument,
  selectedDocId,
  onSelectDoc,
  localMode,
  setLocalMode
}: ParameterPanelProps) {
  const { data: session } = useSession();
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [docName, setDocName] = useState("document.txt");
  const [showKeys, setShowKeys] = useState(false);

  // Fetch documents
  const fetchDocs = async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch("/api/rag/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [selectedDocId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setPastedText(text);
    };
    reader.readAsText(file);
  };

  const handleIngestClick = () => {
    if (!pastedText.trim()) return;
    onUploadDocument(docName, pastedText);
    setPastedText("");
    setDocName("document.txt");
  };

  const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const res = await fetch(`/api/rag/documents?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchDocs();
        if (selectedDocId === id) {
          // Trigger clear on parent
          onSelectDoc("");
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      borderRight: "1px solid var(--border)",
      background: "var(--bg-surface)",
      padding: "20px",
      overflowY: "auto"
    }}>
      {/* Brand Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "24px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, var(--primary), var(--secondary))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            color: "white"
          }}>
            LR
          </div>
          <div>
            <h1 style={{ fontSize: "16px", fontWeight: "700" }}>Learn RAG</h1>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              {session?.user?.name || "Student Session"}
            </div>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center"
          }}
          title="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </div>

      {/* Mode Switcher */}
      <div className="glass-panel" style={{
        padding: "12px",
        marginBottom: "20px",
        background: "rgba(255,255,255,0.02)"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "600" }}>
              {localMode ? "Mock / Offline Mode" : "Live API Mode"}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              {localMode ? "Runs locally without API keys" : "Uses Gemini & Pinecone"}
            </div>
          </div>
          <button
            onClick={() => setLocalMode(!localMode)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: localMode ? "var(--text-muted)" : "var(--primary)"
            }}
          >
            {localMode ? <ToggleLeft size={36} /> : <ToggleRight size={36} />}
          </button>
        </div>
      </div>

      {/* API Key Panel (If Live Mode) */}
      {!localMode && (
        <div className="glass-panel" style={{
          padding: "16px",
          marginBottom: "20px",
          background: "rgba(157, 78, 221, 0.03)",
          borderColor: "rgba(157, 78, 221, 0.15)"
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
            cursor: "pointer"
          }} onClick={() => setShowKeys(!showKeys)}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "600" }}>
              <Key size={14} color="var(--primary)" /> API Credentials
            </div>
            <span style={{ fontSize: "11px", color: "var(--primary)" }}>
              {showKeys ? "Hide" : "Expand"}
            </span>
          </div>

          {showKeys && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Gemini API Key</label>
                <input
                  type="password"
                  className="input-control"
                  style={{ padding: "8px 12px", fontSize: "12px" }}
                  placeholder="AIzaSy..."
                  value={parameters.googleApiKey}
                  onChange={(e) => setParameters((prev: any) => ({ ...prev, googleApiKey: e.target.value }))}
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Pinecone API Key</label>
                <input
                  type="password"
                  className="input-control"
                  style={{ padding: "8px 12px", fontSize: "12px" }}
                  placeholder="pcsk_..."
                  value={parameters.pineconeApiKey}
                  onChange={(e) => setParameters((prev: any) => ({ ...prev, pineconeApiKey: e.target.value }))}
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Pinecone Index Name</label>
                <input
                  type="text"
                  className="input-control"
                  style={{ padding: "8px 12px", fontSize: "12px" }}
                  placeholder="e.g. educational-rag"
                  value={parameters.pineconeIndexName}
                  onChange={(e) => setParameters((prev: any) => ({ ...prev, pineconeIndexName: e.target.value }))}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* RAG Sliders */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)" }}>
          <Sliders size={14} /> Hyperparameters
        </div>

        <div className="input-group" style={{ gap: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
            <span>Chunk Size (chars)</span>
            <span style={{ color: "var(--primary)", fontWeight: "bold" }}>{parameters.chunkSize}</span>
          </div>
          <input
            type="range"
            min="100"
            max="1500"
            step="50"
            className="range-slider"
            value={parameters.chunkSize}
            onChange={(e) => setParameters((prev: any) => ({ ...prev, chunkSize: parseInt(e.target.value) }))}
          />
        </div>

        <div className="input-group" style={{ gap: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
            <span>Chunk Overlap</span>
            <span style={{ color: "var(--primary)", fontWeight: "bold" }}>{parameters.chunkOverlap}</span>
          </div>
          <input
            type="range"
            min="0"
            max="300"
            step="10"
            className="range-slider"
            value={parameters.chunkOverlap}
            onChange={(e) => setParameters((prev: any) => ({ ...prev, chunkOverlap: parseInt(e.target.value) }))}
          />
        </div>

        <div className="input-group" style={{ gap: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
            <span>Retrieve Count (k)</span>
            <span style={{ color: "var(--secondary)", fontWeight: "bold" }}>{parameters.k}</span>
          </div>
          <input
            type="range"
            min="1"
            max="8"
            step="1"
            className="range-slider"
            value={parameters.k}
            onChange={(e) => setParameters((prev: any) => ({ ...prev, k: parseInt(e.target.value) }))}
          />
        </div>
      </div>

      {/* Document Manager */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)" }}>
          <Database size={14} /> Document Index
        </div>

        {/* Existing Docs */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          maxHeight: "150px",
          overflowY: "auto",
          paddingRight: "4px"
        }}>
          {loadingDocs ? (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
              Loading index...
            </div>
          ) : documents.length === 0 ? (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", border: "1px dashed var(--border)", padding: "12px", borderRadius: "var(--radius-sm)" }}>
              No documents indexed. Paste text below to start.
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => onSelectDoc(doc.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: selectedDocId === doc.id ? "rgba(157, 78, 221, 0.1)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${selectedDocId === doc.id ? "var(--primary)" : "var(--border)"}`,
                  cursor: "pointer",
                  fontSize: "12px",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                  <FileText size={14} color={selectedDocId === doc.id ? "var(--primary)" : "var(--text-secondary)"} />
                  <span style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: selectedDocId === doc.id ? "600" : "normal"
                  }}>
                    {doc.name}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{doc.chunkCount} chk</span>
                  <button
                    onClick={(e) => handleDeleteDoc(doc.id, e)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer"
                    }}
                    title="Delete document"
                  >
                    <Trash2 size={12} hover-color="var(--error)" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Upload Doc Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "auto" }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="input-label">Ingest New Document</label>
              <label style={{
                fontSize: "11px",
                color: "var(--secondary)",
                cursor: "pointer",
                fontWeight: "600"
              }}>
                Upload File
                <input
                  type="file"
                  accept=".txt,.md"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />
              </label>
            </div>
            
            <input
              type="text"
              className="input-control"
              style={{ padding: "6px 10px", fontSize: "12px", marginBottom: "6px" }}
              placeholder="document.txt"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
            />

            <textarea
              className="input-control"
              style={{
                height: "80px",
                fontSize: "12px",
                resize: "none",
                fontFamily: "var(--font-sans)"
              }}
              placeholder="Paste custom document text here..."
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />
          </div>

          <button
            onClick={handleIngestClick}
            className="btn btn-secondary"
            disabled={!pastedText.trim()}
            style={{
              fontSize: "12px",
              padding: "8px 16px",
              background: pastedText.trim() ? "var(--primary)" : undefined,
              color: pastedText.trim() ? "white" : undefined,
              borderColor: pastedText.trim() ? "var(--primary)" : undefined
            }}
          >
            Create & Ingest Chunks
          </button>
        </div>
      </div>
    </div>
  );
}
