import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { joinKreplinDuel } from "@/lib/kreplin-duel";

const joinSchema = z.object({
  roomCode: z.string().min(4).max(12),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = joinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Kode duel tidak valid." }, { status: 400 });
    }

    const duel = await joinKreplinDuel(user, parsed.data.roomCode.toUpperCase());
    if (!duel) {
      return NextResponse.json({ error: "Duel tidak ditemukan atau sudah penuh." }, { status: 404 });
    }

    return NextResponse.json({ duel });
  } catch (error) {
    console.error("Join Kreplin duel error:", error);
    return NextResponse.json({ error: "Gagal bergabung duel." }, { status: 500 });
  }
}
