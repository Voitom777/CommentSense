import { NextResponse } from "next/server";
import { importReviewCsv } from "@/server/reviews/import-service";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  return NextResponse.json(await importReviewCsv(file));
}
