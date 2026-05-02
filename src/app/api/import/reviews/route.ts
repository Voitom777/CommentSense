import { NextResponse } from "next/server";
import { importReviewCsv } from "@/server/reviews/import-service";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
    }

    return NextResponse.json(await importReviewCsv(file));
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入评论失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
