import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getDashboardData(user.id);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Gagal memuat dashboard." }, { status: 500 });
  }
}
