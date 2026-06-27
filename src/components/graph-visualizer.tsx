"use client";

import React from "react";
import { Play, RotateCcw, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";

interface ScoredChunk {
  text: string;
  chunkIndex: number;
  score: number;
}

interface GraphVisualizerProps {
  currentNode: string;
  status: string;
  chunksCount: number;
  retrievedCount: number;
  hasAnswer: boolean;
  onNextStep: () => void;
  onReset: () => void;
  loading: boolean;
  error: string | null;
  retrievedContext: ScoredChunk[];
}

export function GraphVisualizer({
  currentNode,
  status,
  chunksCount,
  retrievedCount,
  hasAnswer,
  onNextStep,
  onReset,
  loading,
  error,
  retrievedContext
}: GraphVisualizerProps) {
  
  // Helper to determine state style classes
  const getNodeClass = (nodeName: string) => {
    if (currentNode === nodeName) return "node-card active";
    
    if (nodeName === "INGESTION" && chunksCount > 0) return "node-card completed";
    if (nodeName === "RETRIEVAL" && retrievedCount > 0) return "node-card completed";
    if (nodeName === "GENERATION" && hasAnswer) return "node-card completed";
    
    return "node-card";
  };

  const getConnectorClass = (prevNode: string, nextNode: string) => {
    if (prevNode === "INGESTION" && chunksCount > 0) return "node-connector active";
    if (prevNode === "RETRIEVAL" && retrievedCount > 0) return "node-connector active";
    return "node-connector";
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      padding: "24px",
      overflowY: "auto"
    }}>
      {/* Workspace Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px"
      }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "600" }}>Interactive Multi-Agent Flow</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
            Watch LangGraph coordinate agents through the RAG pipeline.
          </p>
        </div>
        
        {/* Playback Controls */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onReset}
            className="btn btn-secondary"
            disabled={loading}
            title="Reset Pipeline State"
          >
            <RotateCcw size={16} /> Reset
          </button>
          
          <button
            onClick={onNextStep}
            className="btn btn-primary pulse-glow"
            disabled={loading || status === "COMPLETED"}
            style={{
              boxShadow: status === "COMPLETED" ? "none" : undefined
            }}
          >
            <Play size={16} /> 
            {loading ? "Running Agent..." : 
             status === "NOT_STARTED" ? "Start Ingestion" : 
             status === "PAUSED_AFTER_INGESTION" ? "Retrieve Chunks" :
             status === "PAUSED_AFTER_RETRIEVAL" ? "Generate Answer" :
             "Pipeline Completed"}
          </button>
        </div>
      </div>

      {/* Main Graph Panel */}
      <div className="glass-panel" style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        minHeight: "450px"
      }}>
        {error && (
          <div style={{
            width: "100%",
            maxWidth: "500px",
            background: "rgba(239, 71, 111, 0.1)",
            border: "1px solid var(--error)",
            color: "var(--error)",
            padding: "12px 16px",
            borderRadius: "var(--radius-sm)",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "14px"
          }}>
            <AlertTriangle size={20} />
            <div>
              <strong>Graph Runtime Error:</strong> {error}
            </div>
          </div>
        )}

        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px"
        }}>
          {/* Node 1: Supervisor (Router) */}
          <div className="node-card" style={{
            borderColor: "rgba(0, 180, 216, 0.3)",
            background: "rgba(0, 180, 216, 0.02)",
            width: "260px",
            padding: "12px"
          }}>
            <div style={{ fontSize: "11px", color: "var(--secondary)", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>
              Supervisor Agent (Router)
            </div>
            <div style={{ fontSize: "13px", fontWeight: "600", marginTop: "4px" }}>
              Deterministic State Controller
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "6px" }}>
              Programmatic routing — No API Cost
            </div>
          </div>

          <div className="node-connector active" style={{ height: "20px" }}></div>

          {/* Node 2: Ingestion Agent */}
          <div className={getNodeClass("INGESTION")} style={{ width: "260px" }}>
            <div style={{
              position: "absolute", right: "12px", top: "12px",
              color: chunksCount > 0 ? "var(--success)" : "var(--text-muted)"
            }}>
              {chunksCount > 0 ? <CheckCircle size={16} /> : <HelpCircle size={16} />}
            </div>
            <div style={{ fontSize: "11px", color: "var(--primary)", fontWeight: "bold", textTransform: "uppercase" }}>
              Node 1: Ingestion Agent
            </div>
            <div style={{ fontSize: "15px", fontWeight: "700", marginTop: "4px" }}>
              Document Processing
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px" }}>
              {chunksCount > 0 ? 
                `Split text into ${chunksCount} chunks. Created vector embeddings.` : 
                "Splits document and generates embedding float arrays."
              }
            </div>
          </div>

          <div className={getConnectorClass("INGESTION", "RETRIEVAL")} style={{ height: "20px" }}></div>

          {/* Vector Space Bridge (Interactive Visualizer) */}
          <div style={{
            border: "1px dashed var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 16px",
            fontSize: "12px",
            background: "rgba(0,0,0,0.2)",
            color: chunksCount > 0 ? "var(--secondary)" : "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span>📁 SQLite / Pinecone Vector Store</span>
            {chunksCount > 0 && <span style={{
              background: "rgba(0, 180, 216, 0.15)",
              color: "var(--secondary)",
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "10px",
              fontWeight: "bold"
            }}>INDEXED</span>}
          </div>

          <div className={getConnectorClass("INGESTION", "RETRIEVAL")} style={{ height: "20px" }}></div>

          {/* Node 3: Retrieval Agent */}
          <div className={getNodeClass("RETRIEVAL")} style={{ width: "260px" }}>
            <div style={{
              position: "absolute", right: "12px", top: "12px",
              color: retrievedCount > 0 ? "var(--success)" : "var(--text-muted)"
            }}>
              {retrievedCount > 0 ? <CheckCircle size={16} /> : <HelpCircle size={16} />}
            </div>
            <div style={{ fontSize: "11px", color: "var(--primary)", fontWeight: "bold", textTransform: "uppercase" }}>
              Node 2: Retrieval Agent
            </div>
            <div style={{ fontSize: "15px", fontWeight: "700", marginTop: "4px" }}>
              Similarity Search
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px" }}>
              {retrievedCount > 0 ? 
                `Retrieved ${retrievedCount} nearest neighbors via Cosine Distance.` : 
                "Embeds user query and searches vector store for matches."
              }
            </div>
          </div>

          <div className={getConnectorClass("RETRIEVAL", "GENERATION")} style={{ height: "20px" }}></div>

          {/* Node 4: Generation Agent */}
          <div className={getNodeClass("GENERATION")} style={{ width: "260px" }}>
            <div style={{
              position: "absolute", right: "12px", top: "12px",
              color: hasAnswer ? "var(--success)" : "var(--text-muted)"
            }}>
              {hasAnswer ? <CheckCircle size={16} /> : <HelpCircle size={16} />}
            </div>
            <div style={{ fontSize: "11px", color: "var(--primary)", fontWeight: "bold", textTransform: "uppercase" }}>
              Node 3: Generation Agent
            </div>
            <div style={{ fontSize: "15px", fontWeight: "700", marginTop: "4px" }}>
              Gemini Synthesis
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px" }}>
              {hasAnswer ? 
                "Constructed prompt template and generated answer." : 
                "Binds prompt with matching context and calls Gemini 2.5 Flash."
              }
            </div>
          </div>
        </div>
      </div>

      {/* Retrieval Context Visualizer */}
      {retrievedContext.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px" }}>
            Retrieved Context Chunks (k = {retrievedContext.length})
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
            {retrievedContext.map((item, idx) => (
              <div key={idx} className="glass-panel" style={{
                padding: "14px",
                borderLeft: "4px solid var(--secondary)",
                fontSize: "13px"
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "var(--text-secondary)",
                  fontSize: "11px",
                  fontWeight: "bold",
                  marginBottom: "6px"
                }}>
                  <span>CHUNK #{item.chunkIndex + 1}</span>
                  <span style={{
                    color: item.score > 0.6 ? "var(--success)" : "var(--warning)",
                    background: "rgba(255,255,255,0.03)",
                    padding: "2px 6px",
                    borderRadius: "4px"
                  }}>
                    Similarity: {(item.score * 100).toFixed(1)}%
                  </span>
                </div>
                <p style={{ fontStyle: "italic", color: "var(--text-primary)" }}>
                  &ldquo;{item.text}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
