"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ParameterPanel } from "@/components/parameter-panel";
import { GraphVisualizer } from "@/components/graph-visualizer";
import { StateInspector } from "@/components/state-inspector";
import { FileQuestion, AlertCircle, Sparkles, Send } from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Local storage credentials persistence
  const [localMode, setLocalMode] = useState(true);
  const [parameters, setParameters] = useState({
    chunkSize: 450,
    chunkOverlap: 40,
    k: 3,
    googleApiKey: "",
    pineconeApiKey: "",
    pineconeIndexName: "",
    systemPrompt: "You are an educational AI tutor explaining concepts to a student. Generate a grounded, easy-to-understand explanation using only the provided search Context chunks. If the answer cannot be found in the Context, inform the user politely.",
  });

  // Load API keys from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedGoogleKey = localStorage.getItem("learnrag_google_key") || "";
      const savedPineconeKey = localStorage.getItem("learnrag_pinecone_key") || "";
      const savedIndex = localStorage.getItem("learnrag_pinecone_index") || "";
      const savedMode = localStorage.getItem("learnrag_local_mode") !== "false"; // default true
      
      setLocalMode(savedMode);
      setParameters((prev) => ({
        ...prev,
        googleApiKey: savedGoogleKey,
        pineconeApiKey: savedPineconeKey,
        pineconeIndexName: savedIndex,
      }));
    }
  }, []);

  // Save keys to localStorage when changed
  useEffect(() => {
    localStorage.setItem("learnrag_google_key", parameters.googleApiKey);
    localStorage.setItem("learnrag_pinecone_key", parameters.pineconeApiKey);
    localStorage.setItem("learnrag_pinecone_index", parameters.pineconeIndexName);
    localStorage.setItem("learnrag_local_mode", String(localMode));
  }, [parameters.googleApiKey, parameters.pineconeApiKey, parameters.pineconeIndexName, localMode]);

  // Redirect if not logged in
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // LangGraph pipeline state
  const [pipelineState, setPipelineState] = useState({
    userId: "",
    documentId: null as string | null,
    documentName: null as string | null,
    documentText: null as string | null,
    query: null as string | null,
    chunks: [] as string[],
    embeddings: [] as number[][],
    retrievedContext: [] as any[],
    finalAnswer: null as string | null,
    currentNode: "START",
    status: "NOT_STARTED",
    error: null as string | null,
  });

  const [loading, setLoading] = useState(false);
  const [queryInput, setQueryInput] = useState("");

  const handleUploadDocument = async (name: string, content: string) => {
    setLoading(true);
    // Initialize state with the new document
    const baseState = {
      userId: session?.user ? (session.user as any).id : "",
      documentId: null,
      documentName: name,
      documentText: content,
      query: null,
      chunks: [],
      embeddings: [],
      retrievedContext: [],
      finalAnswer: null,
      currentNode: "START",
      status: "NOT_STARTED",
      error: null,
    };

    setPipelineState(baseState);

    try {
      const res = await fetch("/api/rag/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...baseState,
          parameters: {
            ...parameters,
            googleApiKey: localMode ? "" : parameters.googleApiKey,
            pineconeApiKey: localMode ? "" : parameters.pineconeApiKey,
            pineconeIndexName: localMode ? "" : parameters.pineconeIndexName,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const updatedState = await res.json();
      setPipelineState(updatedState);
    } catch (e: any) {
      console.error(e);
      setPipelineState((prev) => ({ ...prev, error: e.message || String(e) }));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDocument = async (docId: string) => {
    if (!docId) {
      handleReset();
      return;
    }
    
    // Clear and set doc index pointer
    setPipelineState({
      userId: session?.user ? (session.user as any).id : "",
      documentId: docId,
      documentName: "loading...",
      documentText: null,
      query: null,
      chunks: [],
      embeddings: [],
      retrievedContext: [],
      finalAnswer: null,
      currentNode: "INGESTION",
      status: "PAUSED_AFTER_INGESTION",
      error: null,
    });
  };

  const handleNextStep = async () => {
    setLoading(true);
    setPipelineState((prev) => ({ ...prev, error: null }));

    try {
      const payload = {
        ...pipelineState,
        // Override with newest user controls
        parameters: {
          ...parameters,
          googleApiKey: localMode ? "" : parameters.googleApiKey,
          pineconeApiKey: localMode ? "" : parameters.pineconeApiKey,
          pineconeIndexName: localMode ? "" : parameters.pineconeIndexName,
        },
      };

      const res = await fetch("/api/rag/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const updatedState = await res.json();
      setPipelineState(updatedState);
    } catch (e: any) {
      console.error(e);
      setPipelineState((prev) => ({ ...prev, error: e.message || String(e) }));
    } finally {
      setLoading(false);
    }
  };

  const handleRetrieveQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim() || !pipelineState.documentId) return;

    setLoading(true);
    const targetState = {
      ...pipelineState,
      query: queryInput,
      retrievedContext: [], // clear old
      finalAnswer: null, // clear old
      status: "PAUSED_AFTER_INGESTION", // rewind to trigger retrieval node
      error: null,
    };

    setPipelineState(targetState);

    try {
      const res = await fetch("/api/rag/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...targetState,
          parameters: {
            ...parameters,
            googleApiKey: localMode ? "" : parameters.googleApiKey,
            pineconeApiKey: localMode ? "" : parameters.pineconeApiKey,
            pineconeIndexName: localMode ? "" : parameters.pineconeIndexName,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const updatedState = await res.json();
      setPipelineState(updatedState);
    } catch (err: any) {
      console.error(err);
      setPipelineState((prev) => ({ ...prev, error: err.message || String(err) }));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPipelineState({
      userId: session?.user ? (session.user as any).id : "",
      documentId: null,
      documentName: null,
      documentText: null,
      query: null,
      chunks: [],
      embeddings: [],
      retrievedContext: [],
      finalAnswer: null,
      currentNode: "START",
      status: "NOT_STARTED",
      error: null,
    });
    setQueryInput("");
  };

  if (status === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyItems: "center", height: "100vh", background: "var(--bg-base)" }}>
        <h3 style={{ margin: "auto", color: "var(--text-secondary)" }}>Loading session details...</h3>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* 1. Left Parameter Panel */}
      <ParameterPanel
        parameters={parameters}
        setParameters={setParameters}
        onUploadDocument={handleUploadDocument}
        selectedDocId={pipelineState.documentId}
        onSelectDoc={handleSelectDocument}
        localMode={localMode}
        setLocalMode={setLocalMode}
      />

      {/* 2. Middle Interactive Workspace */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflowY: "auto",
        background: "rgba(0,0,0,0.1)"
      }}>
        {/* Visual Node Pipeline Graph */}
        <div style={{ flex: "0 0 auto" }}>
          <GraphVisualizer
            currentNode={pipelineState.currentNode}
            status={pipelineState.status}
            chunksCount={pipelineState.chunks.length}
            retrievedCount={pipelineState.retrievedContext.length}
            hasAnswer={!!pipelineState.finalAnswer}
            onNextStep={handleNextStep}
            onReset={handleReset}
            loading={loading}
            error={pipelineState.error}
            retrievedContext={pipelineState.retrievedContext}
          />
        </div>

        {/* Center Interactive Sandboxes */}
        <div style={{ padding: "0 24px 40px 24px", display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Sandbox Section 1: Retrieval Trigger (Question Desk) */}
          {(pipelineState.status.startsWith("PAUSED") || pipelineState.status === "COMPLETED") && (
            <div className="glass-panel" style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <FileQuestion color="var(--secondary)" size={20} />
                <h3 style={{ fontSize: "16px", fontWeight: "600" }}>Retrieval Sandbox</h3>
              </div>
              
              <form onSubmit={handleRetrieveQuery} style={{ display: "flex", gap: "12px" }}>
                <input
                  type="text"
                  className="input-control"
                  style={{ flex: 1 }}
                  placeholder="Ask a question about your uploaded document..."
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !queryInput.trim()}
                  style={{
                    background: "linear-gradient(135deg, var(--secondary), #028090)",
                    boxShadow: "0 0 15px rgba(0, 180, 216, 0.3)"
                  }}
                >
                  <Send size={16} /> Retrieve
                </button>
              </form>
            </div>
          )}

          {/* Sandbox Section 2: Generation Synthesis & Prompt Explainer */}
          {pipelineState.status === "PAUSED_AFTER_RETRIEVAL" && (
            <div className="glass-panel" style={{ padding: "24px", border: "1px solid rgba(157,78,221,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <AlertCircle color="var(--primary)" size={20} />
                <h3 style={{ fontSize: "16px", fontWeight: "600" }}>LLM Prompt Sandbox</h3>
              </div>

              <div className="input-group">
                <label className="input-label">System Instruction</label>
                <textarea
                  className="input-control"
                  style={{ height: "70px", resize: "none", fontSize: "13px" }}
                  value={parameters.systemPrompt}
                  onChange={(e) => setParameters(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  disabled={loading}
                />
              </div>

              {/* Prompt preview */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "600", marginBottom: "6px" }}>
                  Constructed LLM Prompt (Sent to Gemini 2.5 Flash):
                </div>
                <div style={{
                  background: "var(--bg-input)",
                  padding: "16px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  whiteSpace: "pre-wrap",
                  color: "var(--text-secondary)",
                  maxHeight: "180px",
                  overflowY: "auto"
                }}>
                  <span style={{ color: "var(--primary)", fontWeight: "bold" }}>[SYSTEM INSTRUCTION]</span>{"\n"}
                  {parameters.systemPrompt}{"\n\n"}
                  <span style={{ color: "var(--secondary)", fontWeight: "bold" }}>[CONTEXT CHUNKS]</span>{"\n"}
                  {pipelineState.retrievedContext.map((c, i) => `[Chunk #${c.chunkIndex + 1} - Score: ${(c.score*100).toFixed(1)}%]:\n${c.text}`).join("\n\n")}{"\n\n"}
                  <span style={{ color: "var(--accent)", fontWeight: "bold" }}>[USER QUERY]</span>{"\n"}
                  Question: {pipelineState.query}{"\n\n"}
                  <span style={{ color: "var(--text-primary)", fontWeight: "bold" }}>[RESPONSE GENERATION AREA]</span>
                </div>
              </div>

              <button
                onClick={handleNextStep}
                className="btn btn-primary pulse-glow"
                style={{ width: "100%" }}
                disabled={loading}
              >
                <Sparkles size={16} /> Synthesize Answer with Gemini 2.5 Flash
              </button>
            </div>
          )}

          {/* Sandbox Section 3: Final Answer Box */}
          {pipelineState.status === "COMPLETED" && pipelineState.finalAnswer && (
            <div className="glass-panel" style={{
              padding: "28px",
              border: "1px solid rgba(6, 214, 160, 0.3)",
              background: "rgba(6, 214, 160, 0.02)",
              boxShadow: "0 8px 32px 0 rgba(6, 214, 160, 0.05)"
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Sparkles color="var(--success)" size={20} />
                  <h3 style={{ fontSize: "16px", fontWeight: "700" }}>Grounded AI Response</h3>
                </div>
                <span style={{
                  fontSize: "10px",
                  fontWeight: "bold",
                  background: "rgba(6, 214, 160, 0.15)",
                  color: "var(--success)",
                  padding: "2px 8px",
                  borderRadius: "20px"
                }}>
                  GROUNDED BY CONTEXT
                </span>
              </div>

              <div style={{
                fontSize: "14px",
                lineHeight: "1.6",
                color: "var(--text-primary)",
                whiteSpace: "pre-wrap"
              }}>
                {pipelineState.finalAnswer}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Right Debugger State Inspector */}
      <StateInspector
        state={pipelineState}
        localMode={localMode}
      />
    </div>
  );
}
