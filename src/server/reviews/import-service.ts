import { importReviewsFromCsv } from "@/features/reviews/csv";
import { createImportedReviews } from "@/server/db/repository";

export async function importReviewCsv(file: File) {
  const result = importReviewsFromCsv(await file.text(), file.name);
  await createImportedReviews({
    batchId: result.batchId,
    fileName: file.name,
    reviews: result.reviews,
    totalRows: result.totalRows
  });

  return result;
}
