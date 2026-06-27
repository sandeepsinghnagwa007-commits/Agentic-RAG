import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists with this email" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user and initialize default progress items for steps
    const user = await db.user.create({
      data: {
        email,
        name: name || null,
        password: hashedPassword,
        progress: {
          createMany: {
            data: [
              { stepName: "INGESTION", status: "NOT_STARTED" },
              { stepName: "RETRIEVAL", status: "NOT_STARTED" },
              { stepName: "GENERATION", status: "NOT_STARTED" },
            ]
          }
        }
      }
    });

    return NextResponse.json(
      { message: "User registered successfully", userId: user.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
