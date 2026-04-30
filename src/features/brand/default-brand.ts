import type { BrandProfile } from "@/shared/types";

export const defaultBrandProfile: BrandProfile = {
  name: "PawCare 鲜护",
  tone: "真诚、专业、温暖，不夸大功效",
  audience: "养猫养狗的新手与精细化喂养用户",
  forbiddenWords: ["根治", "保证治愈", "绝对安全"],
  servicePolicy: "先安抚情绪，再确认订单与宠物状态；涉及健康问题时建议咨询兽医。",
  replyLength: "medium"
};
