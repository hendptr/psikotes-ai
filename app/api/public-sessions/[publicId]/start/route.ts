import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectMongo } from "@/lib/MongoDB";
import {
  QuestionInstanceModel,
  TestSessionModel,
  type PsychotestQuestion,
} from "@/lib/models";

export const runtime = "nodejs";

type RouteParams = { publicId: string };

async function createQuestionInstances(
  sessionId: string,
  questions: PsychotestQuestion[]
) {
  if (!questions.length) return;
  await QuestionInstanceModel.insertMany(
    questions.map((question, index) => ({
      sessionId,
      index,
      category: question.category,
      questionType: question.questionType,
    }))
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { publicId } = await Promise.resolve(params);
    await connectMongo();

    const sourceSession = await TestSessionModel.findOne({
      publicId,
      isPublic: true,
    }).lean<{
      _id: string;
      userType: string;
      category: string;
      difficulty: string;
      questionCount: number;
      customDurationSeconds: number | null;
      questionsJson: PsychotestQuestion[];
    }>();

    if (!sourceSession) {
      return NextResponse.json({ error: "Soal publik tidak ditemukan." }, { status: 404 });
    }

    const newSession = await TestSessionModel.create({
      userId: user.id,
      userType: sourceSession.userType,
      category: sourceSession.category,
      difficulty: sourceSession.difficulty,
      questionCount: sourceSession.questionCount,
      customDurationSeconds: sourceSession.customDurationSeconds ?? null,
      questionsJson: sourceSession.questionsJson,
      startedAt: new Date(),
    });

    await createQuestionInstances(newSession.id, sourceSession.questionsJson);

    return NextResponse.json({
      sessionId: newSession.id,
      questions: sourceSession.questionsJson,
    });
  } catch (error) {
    console.error("Start public session error:", error);
    return NextResponse.json({ error: "Gagal memulai sesi dari soal publik." }, { status: 500 });
  }
}
