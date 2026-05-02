import { defaultBrandProfile } from "@/features/brand/default-brand";
import { sampleAnalyses, sampleReplies, sampleReviews } from "@/features/reviews/sample-data";
import type { AnalysisResult, BrandProfile, ReplyDraft, Review } from "@/shared/types";
import { prisma, isDbAvailable } from "@/server/db/client";

type PrismaReview = Awaited<ReturnType<typeof prisma.review.findMany>>[number];
type PrismaAnalysis = NonNullable<Awaited<ReturnType<typeof prisma.analysisResult.findFirst>>>;
type PrismaReply = Awaited<ReturnType<typeof prisma.replyDraft.findMany>>[number];
type PrismaBrand = NonNullable<Awaited<ReturnType<typeof prisma.brandProfile.findFirst>>>;

export async function ensureDemoData() {
  if (!(await isDbAvailable())) return;
  const reviewCount = await prisma.review.count();

  await prisma.brandProfile.upsert({
    where: { id: "demo-brand" },
    update: {},
    create: {
      id: "demo-brand",
      name: defaultBrandProfile.name,
      tone: defaultBrandProfile.tone,
      audience: defaultBrandProfile.audience,
      forbiddenWords: JSON.stringify(defaultBrandProfile.forbiddenWords),
      servicePolicy: defaultBrandProfile.servicePolicy,
      replyLength: defaultBrandProfile.replyLength
    }
  });

  await Promise.all(
    [
      {
        name: "review-analysis",
        version: "v1",
        purpose: "Analyze pet brand customer review into sentiment, topics, intent, urgency and summary.",
        content: "Return strict JSON only. Avoid unsupported factual claims.",
        active: true
      },
      {
        name: "reply-generation",
        version: "v1",
        purpose: "Generate customer-service reply draft for manual review.",
        content: "Use brand voice, avoid medical diagnosis, and flag risky promises.",
        active: true
      }
    ].map((prompt) =>
      prisma.promptVersion.upsert({
        where: { name_version: { name: prompt.name, version: prompt.version } },
        update: {},
        create: prompt
      })
    )
  );

  if (reviewCount > 0) {
    return;
  }

  await prisma.importBatch.create({
    data: {
      id: "demo-batch",
      fileName: "demo-pet-reviews.csv",
      totalRows: sampleReviews.length,
      reviews: {
        create: sampleReviews.map((review) => ({
          id: review.id,
          platform: review.platform,
          productName: review.productName,
          rating: review.rating,
          author: review.author,
          content: review.content,
          createdAt: review.createdAt ? new Date(review.createdAt) : undefined,
          importedAt: new Date(review.importedAt)
        }))
      }
    }
  });

  await prisma.analysisResult.createMany({
    data: sampleAnalyses.map((analysis) => ({
      reviewId: analysis.reviewId,
      sentiment: analysis.sentiment,
      topics: JSON.stringify(analysis.topics),
      intent: analysis.intent,
      urgency: analysis.urgency,
      summary: analysis.summary,
      confidence: analysis.confidence
    }))
  });

  await prisma.replyDraft.createMany({
    data: sampleReplies.map((reply) => ({
      id: reply.id,
      reviewId: reply.reviewId,
      replyText: reply.replyText,
      editedText: reply.editedText,
      tone: reply.tone,
      riskFlags: JSON.stringify(reply.riskFlags),
      reasoningSummary: reply.reasoningSummary,
      status: reply.status,
      generationParams: JSON.stringify(reply.generationParams ?? { mode: "mock", model: "Mock", promptVersion: "reply-generation:v1" }),
      createdAt: new Date(reply.createdAt)
    }))
  });
}

export async function getWorkspaceData() {
  try {
    await ensureDemoData();

    const [reviews, analyses, brand] = await Promise.all([
      prisma.review.findMany({ orderBy: { importedAt: "desc" } }),
      prisma.analysisResult.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.brandProfile.findFirst()
    ]);
    // Deduplicate: keep only the latest draft per reviewId
    const rawReplies = await prisma.replyDraft.findMany({ orderBy: { createdAt: "desc" } });
    const latestPerReview = new Map(rawReplies.map((r) => [r.reviewId, r]));
    const replies = [...latestPerReview.values()];

    return {
      reviews: reviews.map(mapReview),
      analyses: analyses.map(mapAnalysis),
      replies: replies.map(mapReply),
      brand: brand ? mapBrand(brand) : defaultBrandProfile
    };
  } catch {
    return {
      reviews: sampleReviews,
      analyses: sampleAnalyses,
      replies: sampleReplies,
      brand: defaultBrandProfile,
      demoMode: true
    };
  }
}

export async function createImportedReviews(input: { batchId: string; fileName: string; reviews: Review[]; totalRows: number }) {
  if (!(await isDbAvailable())) {
    throw new Error("演示模式不支持导入评论");
  }
  await prisma.importBatch.create({
    data: {
      id: input.batchId,
      fileName: input.fileName,
      totalRows: input.totalRows,
      reviews: {
        create: input.reviews.map((review) => ({
          id: review.id,
          platform: review.platform,
          productName: review.productName,
          rating: review.rating,
          author: review.author,
          content: review.content,
          createdAt: review.createdAt ? new Date(review.createdAt) : undefined,
          importedAt: new Date(review.importedAt)
        }))
      }
    }
  });

  return input.reviews;
}

export async function findReviewsByIds(reviewIds: string[]) {
  if (!(await isDbAvailable())) return [];

  const reviews = await prisma.review.findMany({
    where: { id: { in: reviewIds } }
  });

  return reviews.map(mapReview);
}

export async function upsertAnalysisResult(analysis: AnalysisResult) {
  if (!(await isDbAvailable())) {
    throw new Error("演示模式不支持分析评论");
  }

  const saved = await prisma.analysisResult.upsert({
    where: { reviewId: analysis.reviewId },
    update: {
      sentiment: analysis.sentiment,
      topics: JSON.stringify(analysis.topics),
      intent: analysis.intent,
      urgency: analysis.urgency,
      summary: analysis.summary,
      confidence: analysis.confidence
    },
    create: {
      reviewId: analysis.reviewId,
      sentiment: analysis.sentiment,
      topics: JSON.stringify(analysis.topics),
      intent: analysis.intent,
      urgency: analysis.urgency,
      summary: analysis.summary,
      confidence: analysis.confidence
    }
  });

  return mapAnalysis(saved);
}

export async function findReplyDraftsByReviewIds(reviewIds: string[]) {
  if (!(await isDbAvailable())) return [];

  const drafts = await prisma.replyDraft.findMany({
    where: { reviewId: { in: reviewIds } }
  });
  return drafts.map(mapReply);
}

export async function createReplyDraft(reply: ReplyDraft) {
  if (!(await isDbAvailable())) {
    throw new Error("演示模式不支持生成回复");
  }

  const saved = await prisma.replyDraft.create({
    data: {
      id: reply.id,
      reviewId: reply.reviewId,
      replyText: reply.replyText,
      editedText: reply.editedText,
      tone: reply.tone,
      riskFlags: JSON.stringify(reply.riskFlags),
      reasoningSummary: reply.reasoningSummary,
      status: reply.status,
      generationParams: JSON.stringify(reply.generationParams ?? {}),
      createdAt: new Date(reply.createdAt)
    }
  });

  return mapReply(saved);
}

export async function updateReplyDraftById(
  replyId: string,
  patch: Partial<Pick<ReplyDraft, "editedText" | "status" | "replyText" | "tone" | "riskFlags" | "reasoningSummary" | "generationParams" | "createdAt">>
) {
  try {
    const saved = await prisma.replyDraft.update({
      where: { id: replyId },
      data: {
        ...patch,
        riskFlags: patch.riskFlags ? JSON.stringify(patch.riskFlags) : undefined,
        generationParams: patch.generationParams ? JSON.stringify(patch.generationParams) : undefined
      }
    });
    return mapReply(saved);
  } catch {
    return null;
  }
}

export async function getApprovedReplies() {
  if (!(await isDbAvailable())) return [];

  const replies = await prisma.replyDraft.findMany({
    where: { status: "approved" },
    orderBy: { updatedAt: "desc" }
  });

  return replies.map(mapReply);
}

function mapReview(review: PrismaReview): Review {
  return {
    id: review.id,
    platform: review.platform ?? undefined,
    productName: review.productName ?? undefined,
    rating: review.rating ?? undefined,
    author: review.author ?? undefined,
    content: review.content,
    createdAt: review.createdAt?.toISOString(),
    importedAt: review.importedAt.toISOString()
  };
}

function mapAnalysis(analysis: PrismaAnalysis): AnalysisResult {
  return {
    reviewId: analysis.reviewId,
    sentiment: analysis.sentiment as AnalysisResult["sentiment"],
    topics: parseStringArray(analysis.topics),
    intent: analysis.intent,
    urgency: analysis.urgency as AnalysisResult["urgency"],
    summary: analysis.summary,
    confidence: analysis.confidence
  };
}

function mapReply(reply: PrismaReply): ReplyDraft {
  return {
    id: reply.id,
    reviewId: reply.reviewId,
    replyText: reply.replyText,
    editedText: reply.editedText ?? undefined,
    tone: reply.tone,
    riskFlags: parseStringArray(reply.riskFlags),
    reasoningSummary: reply.reasoningSummary,
    status: reply.status as ReplyDraft["status"],
    generationParams: parseRecord(reply.generationParams),
    createdAt: reply.createdAt.toISOString()
  };
}

function mapBrand(brand: PrismaBrand): BrandProfile {
  return {
    name: brand.name,
    tone: brand.tone,
    audience: brand.audience,
    forbiddenWords: parseStringArray(brand.forbiddenWords),
    servicePolicy: brand.servicePolicy,
    replyLength: brand.replyLength as BrandProfile["replyLength"]
  };
}

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
