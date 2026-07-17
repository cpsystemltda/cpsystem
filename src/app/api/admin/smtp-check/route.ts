import { NextRequest, NextResponse } from "next/server";
import { statusSmtp } from "@/lib/email";
export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  return NextResponse.json(statusSmtp());
}
