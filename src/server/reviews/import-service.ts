import { decodeCsvBuffer, importReviewsFromCsv } from "@/features/reviews/csv";
import { createImportedReviews } from "@/server/db/repository";

export async function importReviewCsv(file: File) {
  const buffer = await file.arrayBuffer();
  const text = decodeCsvBuffer(buffer);
  const result = importReviewsFromCsv(text, file.name);
  await createImportedReviews({
    batchId: result.batchId,
    fileName: file.name,
    reviews: result.reviews,
    totalRows: result.totalRows
  });

  return result;
}
