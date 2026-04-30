import { z } from "zod";
import type { ImportResult, Review } from "@/shared/types";

const reviewRowSchema = z.object({
  content: z.string().trim().min(1, "content is required"),
  platform: z.string().optional(),
  productName: z.string().optional(),
  rating: z.string().optional(),
  author: z.string().optional(),
  createdAt: z.string().optional()
});

export function normalizeRating(value: string | number | undefined) {
  if (value === undefined || value === "") {
    return undefined;
  }

  const rating = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(rating)) {
    return undefined;
  }

  return Math.min(5, Math.max(1, rating));
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const [headers, ...body] = rows;
  return body.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]))
  );
}

export function importReviewsFromCsv(text: string, fileName = "uploaded.csv"): ImportResult {
  const records = parseCsv(text);
  const batchId = `batch_${Date.now()}`;
  const reviews: Review[] = [];
  const errors: string[] = [];

  records.forEach((record, index) => {
    const parsed = reviewRowSchema.safeParse(record);
    if (!parsed.success) {
      errors.push(`Row ${index + 2}: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`);
      return;
    }

    const row = parsed.data;
    reviews.push({
      id: `rev_${batchId}_${index + 1}`,
      platform: row.platform || undefined,
      productName: row.productName || undefined,
      rating: normalizeRating(row.rating),
      author: row.author || undefined,
      content: row.content,
      createdAt: row.createdAt || undefined,
      importedAt: new Date().toISOString()
    });
  });

  return {
    batchId,
    totalRows: records.length,
    acceptedRows: reviews.length,
    rejectedRows: errors.length,
    reviews,
    errors
  };
}
