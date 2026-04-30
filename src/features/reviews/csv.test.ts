import { describe, expect, it } from "vitest";
import { importReviewsFromCsv, normalizeRating, parseCsv } from "./csv";

describe("CSV review import", () => {
  it("parses quoted commas", () => {
    const rows = parseCsv('content,rating\n"味道温和, 猫能接受",5');
    expect(rows).toEqual([{ content: "味道温和, 猫能接受", rating: "5" }]);
  });

  it("accepts missing optional fields", () => {
    const result = importReviewsFromCsv("content\n猫咪爱吃");
    expect(result.acceptedRows).toBe(1);
    expect(result.reviews[0].content).toBe("猫咪爱吃");
    expect(result.reviews[0].platform).toBeUndefined();
  });

  it("rejects rows without content", () => {
    const result = importReviewsFromCsv("content,rating\n,5");
    expect(result.acceptedRows).toBe(0);
    expect(result.rejectedRows).toBe(1);
  });

  it("normalizes ratings into the 1 to 5 range", () => {
    expect(normalizeRating("8")).toBe(5);
    expect(normalizeRating("-1")).toBe(1);
    expect(normalizeRating("bad")).toBeUndefined();
  });
});
