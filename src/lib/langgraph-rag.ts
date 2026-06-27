import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { db } from "./db";
import { embedBatch, embedText, queryVectors, upsertVectors } from "./vector-store";

// Recursive character split algorithm for educational visualization
export function recursiveSplitText(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let currentStart = 0;
  while (currentStart < text.length) {
    let currentEnd = Math.min(currentStart + size, text.length);
    
    // Find boundaries near end
    if (currentEnd < text.length) {
      const windowSearchRange = Math.min(overlap, Math.floor(size * 0.3));
      let boundaryIndex = -1;
      
      boundaryIndex = text.lastIndexOf("\n\n", currentEnd);
      if (boundaryIndex > currentStart && boundaryIndex > currentEnd - windowSearchRange) {
        currentEnd = boundaryIndex + 2;
      } else {
        boundaryIndex = text.lastIndexOf("\n", currentEnd);
        if (boundaryIndex > currentStart && boundaryIndex > currentEnd - windowSearchRange) {
          currentEnd = boundaryIndex + 1;
        } else {
          boundaryIndex = text.lastIndexOf(" ", currentEnd);
          if (boundaryIndex > currentStart && boundaryIndex > currentEnd - windowSearchRange) {
            currentEnd = boundaryIndex + 1;
          }
        }
      }
    }
    
    const chunk = text.substring(currentStart, currentEnd).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    
    currentStart = currentEnd - overlap;
    if (currentStart >= currentEnd) {
      currentStart = currentEnd - 1;
    }
  }
  return chunks;
}

// Gemini 2.5 Flash content generator helper
export async function generateText(
  prompt: string,
  systemPrompt: string,
  googleApiKey?: string
): Promise<string> {
  if (!googleApiKey) {
    return `[Mock Response] (Configure your GEMINI_API_KEY in settings to see a live Gemini response)

Based on the retrieved context, here is the simulated response:
The document details concepts relevant to your search. The similarity search matched several paragraphs containing the keywords. Adjusting the chunk size slider on the dashboard will re-split the source and calculate updated vectors.`;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini LLM Error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Failed generating live response:", error);
    return `[Error Generating Live LLM Response] falling back to mock answer. Details: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// 1. Define the LangGraph State Annotation
export const GraphAnnotation = Annotation.Root({
  userId: Annotation<string>(),
  documentId: Annotation<string | null>(),
  documentName: Annotation<string | null>(),
  documentText: Annotation<string | null>(),
  query: Annotation<string | null>(),
  chunks: Annotation<string[]>({
    reducer: (state, update) => update,
    default: () => [],
  }),
  embeddings: Annotation<number[][]>({
    reducer: (state, update) => update,
    default: () => [],
  }),
  retrievedContext: Annotation<{ text: string; chunkIndex: number; score: number }[]>({
    reducer: (state, update) => update,
    default: () => [],
  }),
  finalAnswer: Annotation<string | null>({
    reducer: (state, update) => update,
    default: () => null,
  }),
  currentNode: Annotation<string>({
    reducer: (state, update) => update,
    default: () => "START",
  }),
  status: Annotation<string>({
    reducer: (state, update) => update,
    default: () => "NOT_STARTED",
  }),
  error: Annotation<string | null>({
    reducer: (state, update) => update,
    default: () => null,
  }),
  parameters: Annotation<{
    chunkSize: number;
    chunkOverlap: number;
    k: number;
    googleApiKey?: string;
    pineconeApiKey?: string;
    pineconeIndexName?: string;
    systemPrompt?: string;
  }>(),
});

export type PipelineState = typeof GraphAnnotation.State;

// 2. Define the Ingestion Agent (Splitting & Vectorization)
async function ingestionAgent(state: PipelineState): Promise<Partial<PipelineState>> {
  if (!state.documentText) {
    return { error: "No document text provided for ingestion." };
  }

  try {
    const { chunkSize, chunkOverlap, googleApiKey, pineconeApiKey, pineconeIndexName } = state.parameters;
    
    // Chunking text
    const textChunks = recursiveSplitText(state.documentText, chunkSize, chunkOverlap);
    
    // Check if document record already exists or create new
    let documentId = state.documentId;
    if (!documentId) {
      const doc = await db.uploadedDocument.create({
        data: {
          userId: state.userId,
          name: state.documentName || "document.txt",
          content: state.documentText,
          chunkCount: textChunks.length,
        },
      });
      documentId = doc.id;
    } else {
      // Clear old chunks if re-chunking
      await db.documentChunk.deleteMany({
        where: { documentId },
      });
      await db.uploadedDocument.update({
        where: { id: documentId },
        data: {
          chunkCount: textChunks.length,
          content: state.documentText,
        },
      });
    }

    // Create DB chunk records placeholder
    const chunkRecords = await Promise.all(
      textChunks.map((text, i) =>
        db.documentChunk.create({
          data: {
            documentId: documentId!,
            text,
            chunkIndex: i,
          },
        })
      )
    );

    // Generating embeddings
    const vectors = await embedBatch(textChunks, googleApiKey);

    // Save vectors (Pinecone or local SQLite DB JSON string format)
    const upsertRes = await upsertVectors(
      documentId,
      chunkRecords.map((r, i) => ({ id: r.id, text: r.text, chunkIndex: r.chunkIndex })),
      vectors,
      { apiKey: pineconeApiKey, indexName: pineconeIndexName }
    );

    return {
      documentId,
      chunks: textChunks,
      embeddings: vectors.slice(0, 5), // Save top 5 for UI visualization limits
      currentNode: "INGESTION",
      status: "PAUSED_AFTER_INGESTION",
      error: null,
    };
  } catch (err: any) {
    return { error: `Ingestion error: ${err.message || String(err)}` };
  }
}

// 3. Define the Retrieval Agent
async function retrievalAgent(state: PipelineState): Promise<Partial<PipelineState>> {
  if (!state.documentId) {
    return { error: "No ingested document found to retrieve from." };
  }
  if (!state.query) {
    return { error: "No search query provided." };
  }

  try {
    const { googleApiKey, pineconeApiKey, pineconeIndexName, k } = state.parameters;
    
    // Embed the query
    const queryVector = await embedText(state.query, googleApiKey);
    
    // Similarity search in database (Pinecone or SQLite Cosine similarity)
    const results = await queryVectors(state.documentId, queryVector, k, {
      apiKey: pineconeApiKey,
      indexName: pineconeIndexName,
    });

    return {
      retrievedContext: results,
      currentNode: "RETRIEVAL",
      status: "PAUSED_AFTER_RETRIEVAL",
      error: null,
    };
  } catch (err: any) {
    return { error: `Retrieval error: ${err.message || String(err)}` };
  }
}

// 4. Define the Generation Agent
async function generationAgent(state: PipelineState): Promise<Partial<PipelineState>> {
  if (!state.query) {
    return { error: "No query provided for generating response." };
  }

  try {
    const { googleApiKey, systemPrompt } = state.parameters;
    
    // Format retrieved context text blocks
    const contextText = state.retrievedContext
      .map((item, idx) => `[Chunk #${item.chunkIndex + 1} - Score: ${(item.score * 100).toFixed(1)}%]:\n${item.text}`)
      .join("\n\n");

    const defaultSystemPrompt = "You are an educational AI tutor explaining concepts to a student. Generate a grounded, easy-to-understand explanation using only the provided search Context chunks. If the answer cannot be found in the Context, inform the user politely.";
    const activeSystemPrompt = systemPrompt || defaultSystemPrompt;

    const fullUserPrompt = `Context Chunks:\n${contextText || "No context found."}\n\nQuestion: ${state.query}\n\nEducational Answer:`;

    const answer = await generateText(fullUserPrompt, activeSystemPrompt, googleApiKey);

    return {
      finalAnswer: answer,
      currentNode: "GENERATION",
      status: "COMPLETED",
      error: null,
    };
  } catch (err: any) {
    return { error: `Generation error: ${err.message || String(err)}` };
  }
}

// 5. Define Supervisor router
function supervisorRouter(state: PipelineState): string {
  if (state.error) {
    return END;
  }

  // Programmatic, deterministic state-routing logic
  if (state.status === "NOT_STARTED" && state.documentText && state.chunks.length === 0) {
    return "ingest";
  }
  if (state.status === "PAUSED_AFTER_INGESTION" && state.query && state.retrievedContext.length === 0) {
    return "retrieve";
  }
  if (state.status === "PAUSED_AFTER_RETRIEVAL" && state.retrievedContext.length > 0 && !state.finalAnswer) {
    return "generate";
  }

  return END;
}

// 6. Build the StateGraph
const workflow = new StateGraph(GraphAnnotation)
  .addNode("ingest", ingestionAgent)
  .addNode("retrieve", retrievalAgent)
  .addNode("generate", generationAgent);

workflow.addEdge(START, "ingest"); // Fallback initial entry point
workflow.addConditionalEdges("ingest", supervisorRouter, {
  ingest: "ingest",
  retrieve: "retrieve",
  generate: "generate",
  [END]: END,
});
workflow.addConditionalEdges("retrieve", supervisorRouter, {
  ingest: "ingest",
  retrieve: "retrieve",
  generate: "generate",
  [END]: END,
});
workflow.addConditionalEdges("generate", supervisorRouter, {
  ingest: "ingest",
  retrieve: "retrieve",
  generate: "generate",
  [END]: END,
});

export const compiledGraph = workflow.compile();

/**
 * Educational custom step runner to run the pipeline sequentially.
 * This simulates LangGraph pauses at breakpoints (HITL) for standard REST environments.
 */
export async function stepRagPipeline(currentState: PipelineState): Promise<PipelineState> {
  const nextNode = supervisorRouter(currentState);
  
  if (nextNode === END) {
    return {
      ...currentState,
      status: "COMPLETED",
    };
  }

  let update: Partial<PipelineState> = {};
  if (nextNode === "ingest") {
    update = await ingestionAgent(currentState);
  } else if (nextNode === "retrieve") {
    update = await retrievalAgent(currentState);
  } else if (nextNode === "generate") {
    update = await generationAgent(currentState);
  }

  const newState = {
    ...currentState,
    ...update,
  };

  // Keep records synchronized with SQLite db tracking for user profiles
  await db.userProgress.upsert({
    where: {
      userId_stepName: {
        userId: newState.userId,
        stepName: newState.currentNode === "START" ? "INGESTION" : newState.currentNode,
      },
    },
    update: {
      status: newState.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
    },
    create: {
      userId: newState.userId,
      stepName: newState.currentNode === "START" ? "INGESTION" : newState.currentNode,
      status: newState.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
    },
  });

  return newState;
}
