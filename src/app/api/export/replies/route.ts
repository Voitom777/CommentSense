import { NextResponse } from "next/server";
import { exportApprovedRepliesCsv } from "@/server/replies/reply-service";

export async function GET() {
  return new NextResponse(await exportApprovedRepliesCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="approved-replies.csv"'
    }
  });
}
