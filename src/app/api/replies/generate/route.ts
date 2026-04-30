import { NextResponse } from "next/server";
import { z } from "zod";
import { generateReplyDrafts } from "@/server/replies/reply-service";

const requestSchema = z.object({
  reviewIds: z.array(z.string()).min(1)
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return NextResponse.json({ replies: await generateReplyDrafts(parsed.data.reviewIds) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成回复失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
