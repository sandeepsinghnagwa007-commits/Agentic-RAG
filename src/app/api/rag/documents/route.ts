import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const documents = await db.uploadedDocument.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(documents);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed fetching documents" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }

    const userId = (session.user as any).id;
    const doc = await db.uploadedDocument.findFirst({
      where: { id, userId },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found or unauthorized" }, { status: 404 });
    }

    await db.uploadedDocument.delete({ where: { id } });
    return NextResponse.json({ message: "Document deleted successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed deleting document" },
      { status: 500 }
    );
  }
}
