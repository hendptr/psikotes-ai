import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { submitKreplinDuelResult, type KreplinDuelSummary } from "@/lib/kreplin-duel";

const payloadSchema = z.object({
  resultId: z.string().min(1),
  totalCorrect: z.number().int().min(0),
  totalAnswered: z.number().int().min(0),
  accuracy: z.number().min(0),
});

export async function POST(
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
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
    }

    const summary: KreplinDuelSummary = {
      resultId: parsed.data.resultId,
      totalCorrect: parsed.data.totalCorrect,
      totalAnswered: parsed.data.totalAnswered,
      accuracy: parsed.data.accuracy,
    };

    const duel = await submitKreplinDuelResult(duelId, user.id, summary);
    if (!duel) {
      return NextResponse.json({ error: "Duel tidak ditemukan atau kamu bukan peserta." }, { status: 404 });
    }

    return NextResponse.json({ duel });
  } catch (error) {
    console.error("Submit Kreplin duel result error:", error);
    return NextResponse.json({ error: "Gagal mengirim hasil duel." }, { status: 500 });
  }
}
