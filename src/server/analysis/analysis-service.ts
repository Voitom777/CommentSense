import type { AnalysisResult } from "@/shared/types";
import { analyzeReview } from "@/server/ai/client";
import { findReviewsByIds, upsertAnalysisResult } from "@/server/db/repository";

export async function analyzeReviewsById(reviewIds: string[]) {
  const selectedReviews = await findReviewsByIds(reviewIds);

  return Promise.all(
    selectedReviews.map(async (review): Promise<AnalysisResult> => {
      const result = await analyzeReview(review);
      const analysis = {
        reviewId: review.id,
        ...result
      };

      return upsertAnalysisResult(analysis);
    })
  );
}
