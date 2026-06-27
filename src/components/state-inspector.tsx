"use client";

import React, { useState } from "react";
import { Terminal, Code, Info, HelpCircle } from "lucide-react";

interface StateInspectorProps {
  state: {
    userId: string;
    documentId: string | null;
    documentName: string | null;
    documentText: string | null;
    query: string | null;
    chunks: string[];
    embeddings: number[][];
    retrievedContext: any[];
    finalAnswer: string | null;
    currentNode: string;
    status: string;
    error: string | null;
  };
  localMode: boolean;
}

export function StateInspector({ state, localMode }: StateInspectorProps) {
  const [activeTab, setActiveTab] = useState<"inspector" | "math">("inspector");

  // Format state fields to display in a simplified layout
  const cleanStateForDisplay = {
    currentNode: state.currentNode,
    status: state.status,
    documentName: state.documentName,
    query: state.query,
    chunksCount: state.chunks.length,
    embeddingsCount: state.embeddings.length,
    retrievedCount: state.retrievedContext.length,
    hasAnswer: !!state.finalAnswer,
    error: state.error,
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      borderLeft: "1px solid var(--border)",
      background: "var(--bg-surface)",
      padding: "20px",
      overflowY: "auto"
    }}>
      {/* Tab Selectors */}
      <div style={{
        display: "flex",
        background: "rgba(0,0,0,0.2)",
        borderRadius: "var(--radius-sm)",
        padding: "3px",
        marginBottom: "20px"
      }}>
        <button
          onClick={() => setActiveTab("inspector")}
          style={{
            flex: 1,
            padding: "8px",
            border: "none",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "600",
            cursor: "pointer",
            background: activeTab === "inspector" ? "var(--bg-surface)" : "transparent",
            color: activeTab === "inspector" ? "var(--text-primary)" : "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px"
          }}
        >
          <Terminal size={14} /> State Inspector
        </button>
        <button
          onClick={() => setActiveTab("math")}
          style={{
            flex: 1,
            padding: "8px",
            border: "none",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "600",
            cursor: "pointer",
            background: activeTab === "math" ? "var(--bg-surface)" : "transparent",
            color: activeTab === "math" ? "var(--text-primary)" : "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px"
          }}
        >
          <Code size={14} /> RAG Explainer
        </button>
      </div>

      {activeTab === "inspector" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)" }}>
            <Info size={14} /> LangGraph Global State
          </div>

          {/* Quick Summary State Card */}
          <div className="glass-panel" style={{ padding: "14px", fontSize: "12px", background: "rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Current Node:</span>
              <span style={{ color: "var(--primary)", fontWeight: "bold" }}>{state.currentNode}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Status:</span>
              <span style={{
                color: state.status === "COMPLETED" ? "var(--success)" : 
                       state.status.startsWith("PAUSED") ? "var(--warning)" : "var(--text-muted)",
                fontWeight: "bold"
              }}>{state.status}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>Source Mode:</span>
              <span style={{ color: "var(--secondary)", fontWeight: "bold" }}>{localMode ? "Offline (TF-IDF Mock)" : "Gemini API"}</span>
            </div>
          </div>

          {/* Summary State JSON */}
          <div>
            <div style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "6px" }}>
              State Metadata
            </div>
            <pre className="json-viewer">
              <code>
                {"{\n"}
                {Object.entries(cleanStateForDisplay).map(([key, val], idx, arr) => (
                  <React.Fragment key={key}>
                    {"  "}<span className="json-key">&ldquo;{key}&rdquo;</span>:{" "}
                    {typeof val === "string" ? (
                      <span className="json-value-string">&ldquo;{val}&rdquo;</span>
                    ) : typeof val === "number" ? (
                      <span className="json-value-number">{val}</span>
                    ) : typeof val === "boolean" ? (
                      <span className="json-value-boolean">{String(val)}</span>
                    ) : (
                      <span className="json-value-boolean">null</span>
                    )}
                    {idx < arr.length - 1 ? ",\n" : "\n"}
                  </React.Fragment>
                ))}
                {"}"}
              </code>
            </pre>
          </div>

          {/* Embeddings Array Visualization */}
          {state.embeddings.length > 0 && (
            <div>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "6px"
              }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-secondary)" }}>
                  Vector Embeddings (`state.embeddings`)
                </span>
                <span style={{ fontSize: "10px", color: "var(--primary)", fontWeight: "bold" }}>
                  {state.embeddings[0].length} dimensions
                </span>
              </div>
              <div className="glass-panel" style={{
                padding: "12px",
                fontSize: "11px",
                background: "var(--bg-input)",
                maxHeight: "150px",
                overflowY: "auto",
                fontFamily: "var(--font-mono)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)"
              }}>
                {state.embeddings.map((vec, chunkIdx) => (
                  <div key={chunkIdx} style={{ marginBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.02)", paddingBottom: "6px" }}>
                    <div style={{ color: "var(--primary)", fontWeight: "bold", marginBottom: "2px" }}>
                      Chunk #{chunkIdx + 1} Vector:
                    </div>
                    <div style={{ wordBreak: "break-all", color: "var(--secondary)" }}>
                      [{vec.slice(0, 5).map(v => v.toFixed(5)).join(", ")}, ... {vec.length - 5} more floats]
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1, fontSize: "13px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)" }}>
            <HelpCircle size={14} /> Educational Walkthrough
          </div>

          {/* Ingestion Explainer */}
          <div className="glass-panel" style={{ padding: "14px" }}>
            <h4 style={{ color: "var(--primary)", fontSize: "13px", marginBottom: "6px" }}>1. Document Ingestion</h4>
            <p style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
              Text is broken into <strong>semantic chunks</strong> depending on the sliding window chunk size and overlap sliders. Each text chunk is mapped to a high-dimensional vector space using Gemini's embedding model or a hashing vectorizer.
            </p>
          </div>

          {/* Retrieval Explainer */}
          <div className="glass-panel" style={{ padding: "14px" }}>
            <h4 style={{ color: "var(--secondary)", fontSize: "13px", marginBottom: "6px" }}>2. Vector Retrieval</h4>
            <p style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
              When you submit a query, it is embedded using the exact same vector model. We compute the <strong>Cosine Distance</strong> (dot product normalized by magnitudes) between the query vector and all chunks. The top <em>k</em> highest-scoring chunks are loaded into the LangGraph state.
            </p>
          </div>

          {/* Prompt Explainer */}
          <div className="glass-panel" style={{ padding: "14px" }}>
            <h4 style={{ color: "var(--accent)", fontSize: "13px", marginBottom: "6px" }}>3. Synthesized Generation</h4>
            <p style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
              The matching document context is combined with your query into a structured system template. This unified context prompt is fed into <strong>Gemini 2.5 Flash</strong>, yielding an answer grounded in the sources.
            </p>
          </div>

          {/* Math Card */}
          <div className="glass-panel" style={{
            padding: "14px",
            background: "rgba(0, 180, 216, 0.02)",
            borderColor: "rgba(0, 180, 216, 0.15)",
            fontFamily: "var(--font-mono)",
            fontSize: "11px"
          }}>
            <div style={{ fontWeight: "bold", color: "var(--secondary)", marginBottom: "4px" }}>Cosine Distance Math</div>
            <code>Sim(A, B) = (A · B) / (||A|| ||B||)</code>
            <p style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "6px" }}>
              Dot product divided by the product of vector lengths. Returns 1.0 for identical angles, 0.0 for orthogonal.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
