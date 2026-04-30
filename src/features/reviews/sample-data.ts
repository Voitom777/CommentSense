import type { AnalysisResult, ReplyDraft, Review } from "@/shared/types";

export const sampleReviews: Review[] = [
  {
    id: "rev_001",
    platform: "天猫",
    productName: "低敏鸡肉猫粮",
    rating: 5,
    author: "布偶家长",
    content: "猫咪换粮一周没有软便，颗粒大小也合适，客服提醒循序换粮很贴心。",
    createdAt: "2026-03-21",
    importedAt: "2026-04-01"
  },
  {
    id: "rev_002",
    platform: "京东",
    productName: "幼犬益生菌",
    rating: 2,
    author: "豆豆妈",
    content: "包装破了，粉末漏出来一半，狗狗还没敢吃，希望尽快处理。",
    createdAt: "2026-03-24",
    importedAt: "2026-04-01"
  },
  {
    id: "rev_003",
    platform: "小红书",
    productName: "猫砂除臭喷雾",
    rating: 3,
    author: "三花观察员",
    content: "味道不刺鼻，但除臭持续时间比预期短，大概半天就要再喷。",
    createdAt: "2026-03-28",
    importedAt: "2026-04-01"
  },
  {
    id: "rev_004",
    platform: "抖音小店",
    productName: "冻干零食",
    rating: 1,
    author: "柯基乐乐",
    content: "狗狗吃完吐了两次，不确定是不是零食问题，想问问成分和售后。",
    createdAt: "2026-04-01",
    importedAt: "2026-04-01"
  },
  {
    id: "rev_005",
    platform: "天猫",
    productName: "低敏鸡肉猫粮",
    rating: 4,
    author: "橘猫铲屎官",
    content: "猫爱吃，便便正常，希望能出更小包装方便试吃。",
    createdAt: "2026-04-04",
    importedAt: "2026-04-01"
  },
  {
    id: "rev_006",
    platform: "京东",
    productName: "宠物湿巾",
    rating: 5,
    author: "奶茶爸爸",
    content: "湿度刚好，擦脚不掉毛絮，出门回来用很方便。",
    createdAt: "2026-04-05",
    importedAt: "2026-04-01"
  }
];

export const sampleAnalyses: AnalysisResult[] = [
  {
    reviewId: "rev_001",
    sentiment: "positive",
    topics: ["换粮体验", "客服服务", "颗粒适口性"],
    intent: "分享正向体验",
    urgency: "low",
    summary: "用户认可换粮指导和猫粮适口性。",
    confidence: 0.93
  },
  {
    reviewId: "rev_002",
    sentiment: "negative",
    topics: ["包装破损", "物流体验", "售后处理"],
    intent: "要求售后",
    urgency: "high",
    summary: "包装破损导致产品损耗，需要尽快安抚并处理售后。",
    confidence: 0.91
  },
  {
    reviewId: "rev_003",
    sentiment: "neutral",
    topics: ["除臭时长", "气味接受度"],
    intent: "反馈产品体验",
    urgency: "medium",
    summary: "用户认可气味温和，但认为除臭持续时间不足。",
    confidence: 0.88
  },
  {
    reviewId: "rev_004",
    sentiment: "negative",
    topics: ["疑似不适", "成分咨询", "售后"],
    intent: "咨询健康风险",
    urgency: "critical",
    summary: "涉及宠物呕吐，需要避免诊断并引导停止喂食、联系售后和兽医。",
    confidence: 0.95
  }
];

export const sampleReplies: ReplyDraft[] = [
  {
    id: "reply_001",
    reviewId: "rev_002",
    replyText: "非常抱歉让您收到破损包装。请先暂停使用并保留外包装照片，我们会协助核实订单并尽快安排补发或售后处理。",
    tone: "真诚、负责",
    riskFlags: [],
    reasoningSummary: "先道歉，再给明确售后动作。",
    status: "needs_review",
    createdAt: "2026-04-02"
  },
  {
    id: "reply_002",
    reviewId: "rev_004",
    replyText: "很抱歉看到狗狗出现不适。建议您先暂停喂食并保留产品批次信息，同时尽快咨询专业兽医；我们也会协助您核查成分与售后问题。",
    tone: "谨慎、关怀",
    riskFlags: ["health_related"],
    reasoningSummary: "涉及健康问题，避免判断病因，建议咨询兽医。",
    status: "needs_review",
    createdAt: "2026-04-02"
  }
];
