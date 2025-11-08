import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import mongoose, { type ClientSession } from "mongoose";
import { connectMongo } from "@/lib/MongoDB";
import {
  QuestionInstanceModel,
  TestSessionModel,
  type PsychotestQuestion,
} from "@/lib/models";
import { getCurrentUser } from "@/lib/auth";
import {
  GeminiUnavailableError,
  generatePsychotestQuestions,
} from "@/lib/gemini";
import { listSessionsForUser } from "@/lib/test-sessions";

export const runtime = "nodejs";

type SessionCreatePayload = {
  userId: string;
  userType: string;
  category: string;
  difficulty: string;
  questionCount: number;
  customDurationSeconds: number | null;
  questionsJson: PsychotestQuestion[];
  startedAt: Date;
};

const createSessionSchema = z.object({
  userType: z.enum(["santai", "serius", "simulasi"]).or(z.string().min(1)),
  category: z
    .enum([
      "mixed",
      "padanan_kata",
      "sinonim_antonim",
      "hafalan_kata",
      "deret_matematika",
      "perbandingan_senilai_berbalik",
    ])
    .or(z.string().min(1)),
  difficulty: z.enum(["mudah", "sedang", "sulit"]).or(z.string().min(1)),
  count: z.number().int().min(1).max(30),
  customDurationSeconds: z.number().int().min(10).max(900).nullable().optional(),
});

function clampCount(value: number) {
  return Math.min(30, Math.max(1, value));
}

async function createQuestionInstances(
  sessionId: string,
  questions: PsychotestQuestion[],
  mongoSession?: ClientSession
) {
  if (!questions.length) {
    return;
  }
  await QuestionInstanceModel.insertMany(
    questions.map((question, index) => ({
      sessionId,
      index,
      category: question.category,
      questionType: question.questionType,
    })),
    { session: mongoSession }
  );
}

function isDuplicatePublicIdError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const mongoError = error as { code?: number; keyPattern?: Record<string, unknown> };
  return mongoError.code === 11000 && Boolean(mongoError.keyPattern?.publicId);
}

async function createSessionWithRetry(payload: SessionCreatePayload, mongoSession?: ClientSession) {
  try {
    const docs = await TestSessionModel.create([payload], { session: mongoSession });
    return docs[0]!;
  } catch (error) {
    if (!isDuplicatePublicIdError(error)) {
      throw error;
    }

    // Clean up legacy null publicId values that violate the unique index, then retry once.
    await TestSessionModel.updateMany(
      { publicId: null },
      { $unset: { publicId: "" } }
    );

    const docs = await TestSessionModel.create([payload], { session: mongoSession });
    return docs[0]!;
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Konfigurasi tidak valid." }, { status: 400 });
    }

    const { userType, category, difficulty, customDurationSeconds } = parsed.data;
    const count = clampCount(parsed.data.count);

    await connectMongo();

    const questions = await generatePsychotestQuestions({
      userType,
      category,
      difficulty,
      count,
    });

    const persistSession = async (mongoSession?: ClientSession) => {
      const sessionDoc = await createSessionWithRetry(
        {
          userId: user.id,
          userType,
          category,
          difficulty,
          questionCount: questions.length,
          customDurationSeconds: customDurationSeconds ?? null,
          questionsJson: questions,
          startedAt: new Date(),
        },
        mongoSession
      );
      await createQuestionInstances(sessionDoc.id, questions, mongoSession);
      return sessionDoc;
    };

    let createdSession: Awaited<ReturnType<typeof persistSession>>;

    try {
      const mongoSession = await mongoose.startSession();
      try {
        await mongoSession.withTransaction(async () => {
          createdSession = await persistSession(mongoSession);
        });
      } finally {
        await mongoSession.endSession();
      }
    } catch (transactionError) {
      if (
        transactionError &&
        typeof transactionError === "object" &&
        "code" in transactionError &&
        (transactionError as { code?: number }).code === 20
      ) {
        console.warn("Transactions unavailable, falling back to non-transactional save.");
        createdSession = await persistSession();
      } else {
        throw transactionError;
      }
    }

    return NextResponse.json({
      sessionId: createdSession.id,
      questions,
    });
  } catch (error) {
    if (error instanceof GeminiUnavailableError) {
      console.error("Gemini unavailable:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 503 }
      );
    }

    console.error("Create session error:", error);
    return NextResponse.json(
      { error: "Gagal membuat sesi latihan." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sessions = await listSessionsForUser(user.id);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("List sessions error:", error);
    return NextResponse.json({ error: "Gagal memuat daftar sesi." }, { status: 500 });
  }
}
