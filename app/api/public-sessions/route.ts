import { NextResponse } from "next/server";
import { listPublicSessions } from "@/lib/test-sessions";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sessions = await listPublicSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("List public sessions error:", error);
    return NextResponse.json({ error: "Gagal memuat daftar soal publik." }, { status: 500 });
  }
}
