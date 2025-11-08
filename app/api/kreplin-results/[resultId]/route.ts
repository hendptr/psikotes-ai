import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getKreplinResult } from "@/lib/kreplin";

type RouteParams = { resultId: string };

export async function GET(
  req: NextRequest,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { resultId } = await Promise.resolve(params);
    const result = await getKreplinResult(user.id, resultId);
    if (!result) {
      return NextResponse.json({ error: "Hasil tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Get Kreplin result error:", error);
    return NextResponse.json({ error: "Gagal memuat hasil." }, { status: 500 });
  }
}
