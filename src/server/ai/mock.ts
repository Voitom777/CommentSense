import type { BrandProfile, Review } from "@/shared/types";
import type { StructuredAnalysis, StructuredReply } from "./schemas";
import { detectRiskFlags } from "./risk";

export function mockAnalyzeReview(review: Review): StructuredAnalysis {
  const content = review.content;
  const rating = review.rating ?? 3;
  const healthRelated = ["吐", "不适", "腹泻", "过敏"].some((term) => content.includes(term));

  const topics = new Set<string>();
  if (content.includes("包装") || content.includes("漏")) topics.add("包装/物流");
  if (content.includes("客服") || content.includes("售后")) topics.add("客服售后");
  if (content.includes("味道") || content.includes("除臭")) topics.add("气味与功效");
  if (content.includes("颗粒") || content.includes("爱吃")) topics.add("适口性");
  if (healthRelated) topics.add("宠物健康反馈");
  if (topics.size === 0) topics.add("产品体验");

  return {
    sentiment: rating >= 4 ? "positive" : rating === 3 ? "neutral" : "negative",
    topics: Array.from(topics),
    intent: healthRelated ? "咨询健康风险" : rating <= 2 ? "要求处理问题" : rating >= 4 ? "分享正向体验" : "反馈产品体验",
    urgency: healthRelated ? "critical" : rating <= 2 ? "high" : "low",
    summary: healthRelated
      ? "评论涉及宠物健康不适，需要谨慎回应并建议咨询兽医。"
      : rating <= 2
        ? "用户反馈体验问题，需要安抚并给出清晰处理路径。"
        : rating >= 4
          ? "用户表达认可，可感谢并强化品牌价值。"
          : "用户提出中性反馈，可回应具体体验并邀请补充信息。",
    confidence: healthRelated ? 0.94 : 0.88
  };
}

export function mockGenerateReply(review: Review, brand: BrandProfile): StructuredReply {
  const analysis = mockAnalyzeReview(review);
  const riskFlags = detectRiskFlags(review.content, brand);
  const prefix = analysis.sentiment === "positive" ? "感谢您的认可和细致反馈。" : "很抱歉这次体验没有达到您的期待。";
  const healthLine = riskFlags.includes("health_related")
    ? "涉及宠物不适，建议您先暂停喂食并尽快咨询专业兽医，同时保留产品批次与订单信息方便我们协助核查。"
    : "";
  const serviceLine = analysis.sentiment === "negative"
    ? "请您通过订单页面联系我们，我们会优先核实情况并给出补发、退换或进一步售后方案。"
    : "我们会把您的建议同步给产品团队，也欢迎继续分享宠物的使用体验。";

  return {
    replyText: [prefix, healthLine, serviceLine].filter(Boolean).join(" "),
    tone: brand.tone,
    riskFlags,
    reasoningSummary: riskFlags.includes("health_related")
      ? "评论包含宠物健康相关信号，因此回复避免诊断并引导兽医咨询。"
      : "按评论情绪和品牌语气生成可人工审核的客服回复。"
  };
}
