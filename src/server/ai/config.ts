import { z } from "zod";
import type { AiConfigStatus } from "@/shared/types";
import { prisma } from "@/server/db/client";

const runtimeConfigSchema = z.object({
  baseUrl: z.string().url().optional().or(z.literal("")),
  model: z.string().trim().optional(),
  apiKey: z.string().trim().optional(),
  clearApiKey: z.boolean().optional()
});

export async function getEffectiveAiConfig() {
  const saved = await prisma.aiConfig.findUnique({ where: { id: "default" } });
  const savedReady = Boolean(saved?.baseUrl && saved.model && saved.apiKey);

  if (savedReady) {
    return {
      mode: "runtime" as const,
      baseUrl: saved?.baseUrl,
      model: saved?.model,
      apiKey: saved?.apiKey
    };
  }

  const envReady = Boolean(process.env.AI_BASE_URL && process.env.AI_MODEL && process.env.AI_API_KEY);

  if (envReady) {
    return {
      mode: "environment" as const,
      baseUrl: process.env.AI_BASE_URL,
      model: process.env.AI_MODEL,
      apiKey: process.env.AI_API_KEY
    };
  }

  return {
    mode: "mock" as const,
    baseUrl: saved?.baseUrl || process.env.AI_BASE_URL,
    model: saved?.model || process.env.AI_MODEL,
    apiKey: saved?.apiKey || process.env.AI_API_KEY
  };
}

export async function getAiConfigStatus(): Promise<AiConfigStatus> {
  const effective = await getEffectiveAiConfig();

  return {
    mode: effective.mode,
    baseUrl: effective.baseUrl ?? undefined,
    model: effective.model ?? undefined,
    hasApiKey: Boolean(effective.apiKey),
    sourceLabel:
      effective.mode === "runtime"
        ? "页面配置"
        : effective.mode === "environment"
          ? "环境变量"
          : "Mock"
  };
}

export async function updateRuntimeAiConfig(input: unknown) {
  const parsed = runtimeConfigSchema.parse(input);
  const existing = await prisma.aiConfig.findUnique({ where: { id: "default" } });

  await prisma.aiConfig.upsert({
    where: { id: "default" },
    update: {
      baseUrl: parsed.baseUrl?.trim() || undefined,
      model: parsed.model?.trim() || undefined,
      apiKey: parsed.clearApiKey ? undefined : parsed.apiKey?.trim() || existing?.apiKey
    },
    create: {
      id: "default",
      baseUrl: parsed.baseUrl?.trim() || undefined,
      model: parsed.model?.trim() || undefined,
      apiKey: parsed.clearApiKey ? undefined : parsed.apiKey?.trim() || undefined
    }
  });

  return getAiConfigStatus();
}
