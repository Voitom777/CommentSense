import { describe, expect, it } from "vitest";
import { defaultBrandProfile } from "@/features/brand/default-brand";
import { sampleReviews } from "@/features/reviews/sample-data";
import { detectRiskFlags } from "./risk";
import { analysisSchema, replySchema } from "./schemas";
import { mockAnalyzeReview, mockGenerateReply } from "./mock";
import { parseModelJson } from "./client";

describe("AI structured output", () => {
  it("validates mock analysis output", () => {
    const analysis = mockAnalyzeReview(sampleReviews[0]);
    expect(() => analysisSchema.parse(analysis)).not.toThrow();
  });

  it("validates mock reply output", () => {
    const reply = mockGenerateReply(sampleReviews[1], defaultBrandProfile);
    expect(() => replySchema.parse(reply)).not.toThrow();
  });

  it("flags health related and unsafe promise risks", () => {
    const flags = detectRiskFlags("狗狗吐了，不能保证治愈吗", defaultBrandProfile);
    expect(flags).toContain("health_related");
    expect(flags).toContain("unsafe_promise");
  });

  it("extracts JSON from thinking model text", () => {
    const parsed = parseModelJson('<think>先思考</think>\n这是结果：{"replyText":"您好","tone":"温暖","riskFlags":[],"reasoningSummary":"测试"}');
    expect(replySchema.parse(parsed).replyText).toBe("您好");
  });
});
