export type Sentiment = "positive" | "neutral" | "negative" | "mixed";
export type Urgency = "low" | "medium" | "high" | "critical";
export type ReplyStatus = "draft" | "needs_review" | "approved";
export type ReplyFilter = "all" | "unreplied" | "generating" | "pending_review" | "approved";
export type BusyOperation = "import" | "analyze" | "reply";

export type Review = {
  id: string;
  platform?: string;
  productName?: string;
  rating?: number;
  author?: string;
  content: string;
  createdAt?: string;
  importedAt: string;
};

export type AnalysisResult = {
  reviewId: string;
  sentiment: Sentiment;
  topics: string[];
  intent: string;
  urgency: Urgency;
  summary: string;
  confidence: number;
};

export type ReplyDraft = {
  id: string;
  reviewId: string;
  replyText: string;
  editedText?: string;
  tone: string;
  riskFlags: string[];
  reasoningSummary: string;
  status: ReplyStatus;
  generationParams?: Record<string, unknown>;
  createdAt: string;
};

export type BrandProfile = {
  name: string;
  tone: string;
  audience: string;
  forbiddenWords: string[];
  servicePolicy: string;
  replyLength: "short" | "medium" | "long";
};

export type ImportResult = {
  batchId: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  reviews: Review[];
  errors: string[];
};

export type AiConfigStatus = {
  mode: "mock" | "runtime" | "environment";
  baseUrl?: string;
  model?: string;
  hasApiKey: boolean;
  sourceLabel: string;
};
