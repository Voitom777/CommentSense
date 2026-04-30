import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAiConfigStatus, updateRuntimeAiConfig } from "@/server/ai/config";

export async function GET() {
  return NextResponse.json(await getAiConfigStatus());
}

export async function PUT(request: Request) {
  try {
    return NextResponse.json(await updateRuntimeAiConfig(await request.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }

    throw error;
  }
}
