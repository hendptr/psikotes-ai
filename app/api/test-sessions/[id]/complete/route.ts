import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/MongoDB";
import { AnswerModel, TestSessionModel } from "@/lib/models";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

type RouteParams = { id: string };

export async function POST(
  req: NextRequest,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await Promise.resolve(params);

  try {
    await connectMongo();

    const session = await TestSessionModel.findOne({
      _id: sessionId,
      userId: user.id,
    }).lean<{
      _id: string;
      questionCount: number;
    }>();

    if (!session) {
      return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
    }

    const answerStats = await AnswerModel.aggregate<{
      correct: number;
      total: number;
    }>([
      { $match: { userId: user.id, sessionId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          correct: {
            $sum: { $cond: [{ $eq: ["$isCorrect", true] }, 1, 0] },
          },
        },
      },
    ]);

    const totals = answerStats[0] ?? { total: 0, correct: 0 };
    const accuracy =
      session.questionCount > 0 ? (totals.correct / session.questionCount) * 100 : 0;

    await TestSessionModel.updateOne(
      { _id: sessionId, userId: user.id },
      {
        $set: {
          completedAt: new Date(),
          score: accuracy,
          isDraft: false,
          draftSavedAt: null,
          draftQuestionIndex: null,
          draftTimerSeconds: null,
        },
      }
    );

    return NextResponse.json({
      ok: true,
      score: accuracy,
      answered: totals.total,
      correct: totals.correct,
    });
  } catch (error) {
    console.error("Complete session error:", error);
    return NextResponse.json(
      { error: "Gagal menyelesaikan sesi." },
      { status: 500 }
    );
  }
}
