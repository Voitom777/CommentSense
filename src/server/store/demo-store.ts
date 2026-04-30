import type { AnalysisResult, ReplyDraft, Review } from "@/shared/types";
import { sampleAnalyses, sampleReplies, sampleReviews } from "@/features/reviews/sample-data";

type Store = {
  reviews: Review[];
  analyses: AnalysisResult[];
  replies: ReplyDraft[];
};

const globalForStore = globalThis as unknown as {
  commentSenseStore?: Store;
};

export const demoStore =
  globalForStore.commentSenseStore ??
  ({
    reviews: [...sampleReviews],
    analyses: [...sampleAnalyses],
    replies: [...sampleReplies]
  } satisfies Store);

if (!globalForStore.commentSenseStore) {
  globalForStore.commentSenseStore = demoStore;
}

export function upsertAnalysis(analysis: AnalysisResult) {
  const index = demoStore.analyses.findIndex((item) => item.reviewId === analysis.reviewId);
  if (index >= 0) {
    demoStore.analyses[index] = analysis;
  } else {
    demoStore.analyses.push(analysis);
  }
}

export function upsertReply(reply: ReplyDraft) {
  const index = demoStore.replies.findIndex((item) => item.id === reply.id);
  if (index >= 0) {
    demoStore.replies[index] = reply;
  } else {
    demoStore.replies.push(reply);
  }
}
