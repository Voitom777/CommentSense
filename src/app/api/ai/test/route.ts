import { NextResponse } from "next/server";
import { getAiConfigStatus } from "@/server/ai/config";
import { testAiConnection } from "@/server/ai/client";

export async function POST() {
  try {
    const result = await testAiConnection();
    return NextResponse.json({
      ...result,
      config: await getAiConfigStatus()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型连通测试失败";

    return NextResponse.json(
      {
        ok: false,
        message,
        config: await getAiConfigStatus()
      },
      { status: 502 }
    );
  }
}
