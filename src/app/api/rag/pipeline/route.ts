import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { stepRagPipeline, PipelineState } from "@/lib/langgraph-rag";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const userId = (session.user as any).id;

    // Reconstruct the pipeline state passed from the frontend for human-in-the-loop inspection
    const state: PipelineState = {
      userId,
      documentId: body.documentId || null,
      documentName: body.documentName || null,
      documentText: body.documentText || null,
      query: body.query || null,
      chunks: body.chunks || [],
      embeddings: body.embeddings || [],
      retrievedContext: body.retrievedContext || [],
      finalAnswer: body.finalAnswer || null,
      currentNode: body.currentNode || "START",
      status: body.status || "NOT_STARTED",
      error: null,
      parameters: {
        chunkSize: typeof body.parameters?.chunkSize === "number" ? body.parameters.chunkSize : 500,
        chunkOverlap: typeof body.parameters?.chunkOverlap === "number" ? body.parameters.chunkOverlap : 50,
        k: typeof body.parameters?.k === "number" ? body.parameters.k : 3,
        googleApiKey: body.parameters?.googleApiKey || process.env.GEMINI_API_KEY || "",
        pineconeApiKey: body.parameters?.pineconeApiKey || process.env.PINECONE_API_KEY || "",
        pineconeIndexName: body.parameters?.pineconeIndexName || process.env.PINECONE_INDEX_NAME || "",
        systemPrompt: body.parameters?.systemPrompt || "",
      },
    };

    const newState = await stepRagPipeline(state);
    
    return NextResponse.json(newState);
  } catch (error: any) {
    console.error("Pipeline run error:", error);
    return NextResponse.json(
      { error: error.message || "Failed running pipeline step" },
      { status: 500 }
    );
  }
}
