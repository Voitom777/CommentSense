import type { BrandProfile } from "@/shared/types";

const healthTerms = ["吐", "呕吐", "拉稀", "腹泻", "过敏", "生病", "兽医", "不适"];
const promiseTerms = ["根治", "保证治愈", "绝对安全", "百分百"];

export function detectRiskFlags(text: string, brand: BrandProfile) {
  const flags = new Set<string>();

  if (healthTerms.some((term) => text.includes(term))) {
    flags.add("health_related");
  }

  if (promiseTerms.some((term) => text.includes(term))) {
    flags.add("unsafe_promise");
  }

  for (const word of brand.forbiddenWords) {
    if (word && text.includes(word)) {
      flags.add("forbidden_word");
    }
  }

  return Array.from(flags);
}
