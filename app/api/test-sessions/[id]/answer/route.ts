import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/MongoDB";
import {
  AnswerModel,
  QuestionInstanceModel,
  TestSessionModel,
  type PsychotestQuestion,
} from "@/lib/models";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const answerSchema = z.object({
  questionIndex: z.number().int().min(0),
  selectedLabel: z.string().min(1).max(5),
  correctLabel: z.string().min(1).max(5),
  timeSpentMs: z.number().int().min(0),
});

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
    const body = await req.json();
    const parsed = answerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload jawaban tidak valid." }, { status: 400 });
    }

    await connectMongo();

    const session = await TestSessionModel.findOne({
      _id: sessionId,
      userId: user.id,
    }).lean<{
      _id: string;
      questionsJson: PsychotestQuestion[];
    }>();

    if (!session) {
      return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
    }

    const question = session.questionsJson?.[parsed.data.questionIndex];
    if (!question) {
      return NextResponse.json({ error: "Index soal di luar jangkauan." }, { status: 400 });
    }

    const questionInstance = await QuestionInstanceModel.findOne({
      sessionId,
      index: parsed.data.questionIndex,
    }).lean<{ _id: string }>();

    const isCorrect = parsed.data.selectedLabel === parsed.data.correctLabel;

    await AnswerModel.findOneAndUpdate(
      {
        userId: user.id,
        sessionId,
        questionIndex: parsed.data.questionIndex,
      },
      {
        userId: user.id,
        sessionId,
        questionId: questionInstance?._id ?? null,
        questionIndex: parsed.data.questionIndex,
        selectedLabel: parsed.data.selectedLabel,
        correctLabel: parsed.data.correctLabel,
        isCorrect,
        category: question.category,
        difficulty: question.difficulty,
        timeSpentMs: parsed.data.timeSpentMs,
        answeredAt: new Date(),
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    return NextResponse.json({ ok: true, isCorrect });
  } catch (error) {
    console.error("Submit answer error:", error);
    return NextResponse.json({ error: "Gagal menyimpan jawaban." }, { status: 500 });
  }
}
