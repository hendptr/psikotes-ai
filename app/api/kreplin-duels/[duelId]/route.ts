import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getKreplinDuelById, setKreplinDuelReady } from "@/lib/kreplin-duel";

const readySchema = z.object({
  ready: z.boolean(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ duelId: string }> }
) {
  const { duelId } = await context.params;
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const duel = await getKreplinDuelById(duelId);
    if (!duel) {
      return NextResponse.json({ error: "Duel tidak ditemukan." }, { status: 404 });
    }

    const isParticipant =
      duel.host.userId === user.id || duel.guest?.userId === user.id;
    if (!isParticipant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ duel });
  } catch (error) {
    console.error("Get Kreplin duel error:", error);
    return NextResponse.json({ error: "Gagal memuat duel." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ duelId: string }> }
) {
  const { duelId } = await context.params;
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = readySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
    }

    const duel = await setKreplinDuelReady(duelId, user.id, parsed.data.ready);
    if (!duel) {
      return NextResponse.json({ error: "Duel tidak ditemukan atau kamu bukan peserta." }, { status: 404 });
    }

    return NextResponse.json({ duel });
  } catch (error) {
    console.error("Set Kreplin duel ready error:", error);
    return NextResponse.json({ error: "Gagal memperbarui status duel." }, { status: 500 });
  }
}
