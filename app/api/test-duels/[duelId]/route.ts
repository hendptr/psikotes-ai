import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { TestDuelModel } from "@/lib/models";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ duelId: string }> }
) {
  const { duelId } = await context.params;
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const duel = await TestDuelModel.findById(duelId);
  if (!duel) {
    return NextResponse.json({ error: "Duel tidak ditemukan." }, { status: 404 });
  }

  const isParticipant =
    duel.host.userId === user.id || duel.guest?.userId === user.id;
  if (!isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ duel: duel.toJSON() });
}
