import { NextResponse } from "next/server";
import { z } from "zod";
import { updateReplyDraft } from "@/server/replies/reply-service";

const updateSchema = z.object({
  editedText: z.string().optional(),
  status: z.enum(["draft", "needs_review", "approved", "rejected"]).optional()
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const reply = await updateReplyDraft(id, parsed.data);
  if (!reply) {
    return NextResponse.json({ error: "Reply draft not found" }, { status: 404 });
  }

  return NextResponse.json({ reply });
}
