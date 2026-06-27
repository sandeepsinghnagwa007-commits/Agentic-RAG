import { db } from "./db";
import { Pinecone } from "@pinecone-database/pinecone";

// Cosine similarity between two vectors
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Generate a deterministic 128-dimensional mock embedding for offline mode
export function getMockEmbedding(text: string): number[] {
  const vectorSize = 128;
  const vector = new Array(vectorSize).fill(0);
  const lowercase = text.toLowerCase();
  
  // Use words and character hashing to make it text-sensitive
  for (let i = 0; i < lowercase.length; i++) {
    const charCode = lowercase.charCodeAt(i);
    // Mix the character code into multiple dimensions for dispersion
    const index1 = charCode % vectorSize;
    const index2 = (charCode * (i + 1)) % vectorSize;
    vector[index1] += 0.5 * (charCode / 256.0);
    vector[index2] += 0.5 * (charCode / 256.0);
  }
  
  // Add direct word token check for overlapping search terms
  const words = lowercase.split(/\W+/);
  for (const word of words) {
    if (word.length === 0) continue;
    let wordHash = 0;
    for (let j = 0; j < word.length; j++) {
      wordHash += word.charCodeAt(j) * (j + 1);
    }
    const idx = wordHash % vectorSize;
    vector[idx] += 1.5;
  }

  // Normalize the vector
  let norm = 0;
  for (let i = 0; i < vectorSize; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vectorSize; i++) {
      vector[i] = vector[i] / norm;
    }
  } else {
    vector[0] = 1.0;
  }
  return vector;
}

// Embed a single text string using Google GenAI or local fallback
export async function embedText(text: string, googleApiKey?: string): Promise<number[]> {
  if (!googleApiKey) {
    return getMockEmbedding(text);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text }] },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini Embedding Error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.embedding.values;
  } catch (error) {
    console.error("Failed to fetch live embedding, falling back to mock:", error);
    return getMockEmbedding(text);
  }
}

// Embed multiple text chunks in a single batched call to save network roundtrips
export async function embedBatch(texts: string[], googleApiKey?: string): Promise<number[][]> {
  if (!googleApiKey) {
    return texts.map(getMockEmbedding);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: "models/text-embedding-004",
            content: { parts: [{ text }] },
          })),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini Batch Embedding Error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.embeddings.map((e: any) => e.values);
  } catch (error) {
    console.error("Failed to fetch live batch embeddings, falling back to mock:", error);
    return texts.map(getMockEmbedding);
  }
}

// Initialize Pinecone Client (only if API Key is provided)
function getPineconeClient(apiKey: string) {
  return new Pinecone({ apiKey });
}

// Save embeddings either in Pinecone (if configured) or SQLite local store
export async function upsertVectors(
  documentId: string,
  chunks: { id: string; text: string; chunkIndex: number }[],
  embeddings: number[][],
  pineconeConfig?: { apiKey?: string; indexName?: string }
): Promise<{ location: "PINECONE" | "SQLITE"; count: number }> {
  // If Pinecone is configured, upload to Pinecone
  if (pineconeConfig?.apiKey && pineconeConfig.indexName) {
    try {
      const pc = getPineconeClient(pineconeConfig.apiKey);
      const index = pc.index(pineconeConfig.indexName);
      
      const records = chunks.map((chunk, i) => ({
        id: chunk.id,
        values: embeddings[i],
        metadata: {
          documentId,
          text: chunk.text,
          chunkIndex: chunk.chunkIndex,
        },
      }));

      // Upsert to Pinecone
      await index.upsert({ records });

      // Save references inside SQLite with null embeddings to save space, flag as Pinecone-managed
      await Promise.all(
        chunks.map((chunk) =>
          db.documentChunk.update({
            where: { id: chunk.id },
            data: { embedding: "PINECONE_STORED" },
          })
        )
      );

      return { location: "PINECONE", count: chunks.length };
    } catch (error) {
      console.error("Failed uploading to Pinecone, falling back to local SQLite storage:", error);
    }
  }

  // Local Storage (SQLite): Serialize and save embeddings as JSON strings
  await Promise.all(
    chunks.map((chunk, i) =>
      db.documentChunk.update({
        where: { id: chunk.id },
        data: { embedding: JSON.stringify(embeddings[i]) },
      })
    )
  );

  return { location: "SQLITE", count: chunks.length };
}

// Query vectors: similarity search over Pinecone or local SQLite DB
export async function queryVectors(
  documentId: string,
  queryEmbedding: number[],
  k: number,
  pineconeConfig?: { apiKey?: string; indexName?: string }
): Promise<{ text: string; chunkIndex: number; score: number }[]> {
  // Try Pinecone first if configured
  if (pineconeConfig?.apiKey && pineconeConfig.indexName) {
    try {
      const pc = getPineconeClient(pineconeConfig.apiKey);
      const index = pc.index(pineconeConfig.indexName);

      const queryResponse = await index.query({
        vector: queryEmbedding,
        topK: k,
        filter: { documentId: { $eq: documentId } },
        includeMetadata: true,
      });

      return queryResponse.matches.map((match) => ({
        text: (match.metadata?.text as string) || "",
        chunkIndex: (match.metadata?.chunkIndex as number) ?? -1,
        score: match.score ?? 0,
      }));
    } catch (error) {
      console.error("Pinecone search failed, trying local fallback:", error);
    }
  }

  // Local SQLite search: Fetch all chunks, parse JSON embeddings, and compute Cosine Similarity in JS
  const dbChunks = await db.documentChunk.findMany({
    where: { documentId },
  });

  const scoredChunks = dbChunks
    .map((chunk) => {
      let embeddingVec: number[] = [];
      try {
        embeddingVec = chunk.embedding ? JSON.parse(chunk.embedding) : [];
      } catch (e) {
        console.error("Failed to parse local embedding for chunk", chunk.id, e);
      }

      if (embeddingVec.length === 0) {
        // Fallback if vector was not stored (e.g. mock search fallback)
        embeddingVec = getMockEmbedding(chunk.text);
      }

      const score = cosineSimilarity(queryEmbedding, embeddingVec);
      return {
        text: chunk.text,
        chunkIndex: chunk.chunkIndex,
        score,
      };
    })
    .sort((a, b) => b.score - a.score) // Sort descending
    .slice(0, k);

  return scoredChunks;
}
