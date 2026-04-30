import type { BrandProfile, Review } from "@/shared/types";

export const promptVersions = {
  reviewAnalysis: {
    name: "review-analysis",
    version: "v1",
    build(review: Review) {
      return [
        "你是宠物品牌评论分析助手。请只返回 JSON，不要 Markdown，不要解释，不要输出思考过程。",
        "字段必须包含 sentiment, topics, intent, urgency, summary, confidence。",
        "sentiment 只能是 positive / neutral / negative / mixed。",
        "urgency 只能是 low / medium / high / critical。",
        `评论平台：${review.platform ?? "未知"}`,
        `产品：${review.productName ?? "未知"}`,
        `评分：${review.rating ?? "未知"}`,
        `评论内容：${review.content}`
      ].join("\n")
    }
  },
  replyGeneration: {
    name: "reply-generation",
    version: "v1",
    build(review: Review, brand: BrandProfile) {
      return [
        "你是宠物品牌客服回复助手。请只返回 JSON，不要 Markdown，不要解释，不要输出思考过程。",
        "字段必须包含 replyText, tone, riskFlags, reasoningSummary。",
        "回复要给人工审核，不能承诺无法兑现的赔偿。",
        "涉及宠物健康、呕吐、腹泻、过敏时，避免诊断，建议咨询专业兽医。",
        `品牌：${brand.name}`,
        `品牌语气：${brand.tone}`,
        `目标用户：${brand.audience}`,
        `禁用词：${brand.forbiddenWords.join("、")}`,
        `服务策略：${brand.servicePolicy}`,
        `回复长度：${brand.replyLength}`,
        `评论内容：${review.content}`
      ].join("\n")
    }
  }
};
