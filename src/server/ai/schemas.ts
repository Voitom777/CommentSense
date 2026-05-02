import { z } from "zod";

export const analysisSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  topics: z.array(z.string()).min(1),
  intent: z.string().min(1),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  summary: z.string().min(1),
  confidence: z.unknown().transform((v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
  })
});

export const replySchema = z.object({
  replyText: z.string().min(1),
  tone: z.string().min(1),
  riskFlags: z.array(z.string()),
  reasoningSummary: z.string().min(1)
});

export type StructuredAnalysis = z.infer<typeof analysisSchema>;
export type StructuredReply = z.infer<typeof replySchema>;
