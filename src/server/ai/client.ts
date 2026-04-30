import type { BrandProfile, Review } from "@/shared/types";
import { analysisSchema, replySchema } from "./schemas";
import { mockAnalyzeReview, mockGenerateReply } from "./mock";
import { promptVersions } from "./prompts";
import { detectRiskFlags } from "./risk";
import { getEffectiveAiConfig } from "./config";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

async function callOpenAICompatible(messages: ChatMessage[]) {
  const config = await getEffectiveAiConfig();
  const { baseUrl, apiKey, model } = config;

  if (config.mode === "mock" || !baseUrl || !apiKey || !model) {
    return null;
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      stream: false,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`AI provider returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI provider returned an empty response");
  }

  return parseModelJson(content);
}

export function parseModelJson(content: string) {
  const cleaned = content
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json/gi, "```")
    .trim();

  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const jsonText = extractFirstJsonObject(cleaned);
    if (!jsonText) {
      throw new Error("AI 模型没有返回可解析的 JSON，请换用非推理模式模型，或检查模型是否支持 JSON 输出。");
    }

    return JSON.parse(jsonText) as unknown;
  }
}

function extractFirstJsonObject(text: string) {
  const start = text.indexOf("{");
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let quoted = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (quoted) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

export async function analyzeReview(review: Review) {
  const aiResult = await callOpenAICompatible([
    { role: "system", content: "你是严格的 JSON 输出助手。" },
    { role: "user", content: promptVersions.reviewAnalysis.build(review) }
  ]);

  return analysisSchema.parse(aiResult ?? mockAnalyzeReview(review));
}

export async function generateReply(review: Review, brand: BrandProfile) {
  const aiResult = await callOpenAICompatible([
    { role: "system", content: "你是严格的 JSON 输出助手。" },
    { role: "user", content: promptVersions.replyGeneration.build(review, brand) }
  ]);

  const parsed = replySchema.parse(aiResult ?? mockGenerateReply(review, brand));
  const riskFlags = Array.from(new Set([...parsed.riskFlags, ...detectRiskFlags(parsed.replyText, brand)]));

  return {
    ...parsed,
    riskFlags
  };
}

export async function testAiConnection() {
  const aiResult = await callOpenAICompatible([
    { role: "system", content: "你是严格的 JSON 输出助手。" },
    {
      role: "user",
      content:
        '请只返回 JSON，不要 Markdown，不要解释，不要输出思考过程。字段必须包含 ok 和 message，例如 {"ok":true,"message":"connected"}'
    }
  ]);

  if (!aiResult) {
    return {
      ok: false,
      message: "当前未配置完整 API 信息，仍处于 Mock 模式。"
    };
  }

  return {
    ok: true,
    message: "模型接口连通，且返回内容可解析为 JSON。"
  };
}
