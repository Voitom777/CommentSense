import { NextResponse } from "next/server";
import { exportApprovedRepliesCsv } from "@/server/replies/reply-service";

export async function GET() {
  try {
    return new NextResponse(await exportApprovedRepliesCsv(), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="approved-replies.csv"'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
