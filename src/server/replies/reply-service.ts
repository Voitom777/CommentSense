import { defaultBrandProfile } from "@/features/brand/default-brand";
import type { ReplyDraft } from "@/shared/types";
import { getAiConfigStatus } from "@/server/ai/config";
import { generateReply } from "@/server/ai/client";
import { createReplyDraft, findReviewsByIds, getApprovedReplies, updateReplyDraftById } from "@/server/db/repository";

export async function generateReplyDrafts(reviewIds: string[]) {
  const selectedReviews = await findReviewsByIds(reviewIds);
  const aiConfig = await getAiConfigStatus();

  return Promise.all(
    selectedReviews.map(async (review): Promise<ReplyDraft> => {
      const result = await generateReply(review, defaultBrandProfile);
      const reply: ReplyDraft = {
        id: `reply_${review.id}_${Date.now()}`,
        reviewId: review.id,
        replyText: result.replyText,
        tone: result.tone,
        riskFlags: result.riskFlags,
        reasoningSummary: result.reasoningSummary,
        status: result.riskFlags.length > 0 ? "needs_review" : "draft",
        generationParams: {
          mode: aiConfig.mode,
          model: aiConfig.model || "Mock",
          brand: defaultBrandProfile.name,
          promptVersion: "reply-generation:v1"
        },
        createdAt: new Date().toISOString()
      };

      return createReplyDraft(reply);
    })
  );
}

export async function updateReplyDraft(replyId: string, patch: Partial<Pick<ReplyDraft, "editedText" | "status">>) {
  return updateReplyDraftById(replyId, patch);
}

export async function exportApprovedRepliesCsv() {
  const approvedReplies = await getApprovedReplies();
  const rows = [
    ["reviewId", "replyText", "editedText", "tone", "riskFlags", "status"],
    ...approvedReplies.map((reply) => [
      reply.reviewId,
      reply.replyText,
      reply.editedText ?? "",
      reply.tone,
      reply.riskFlags.join("|"),
      reply.status
    ])
  ];

  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function escapeCsv(value: string | number | undefined) {
  const text = value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
