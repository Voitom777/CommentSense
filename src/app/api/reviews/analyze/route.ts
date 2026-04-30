import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeReviewsById } from "@/server/analysis/analysis-service";

const requestSchema = z.object({
  reviewIds: z.array(z.string()).min(1)
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return NextResponse.json({ analyses: await analyzeReviewsById(parsed.data.reviewIds) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "分析评论失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
