import { randomUUID } from "crypto";
import { connectMongo } from "./MongoDB";
import {
  QuestionInstanceModel,
  TestDuelModel,
  TestSessionModel,
  type PsychotestQuestion,
  type TestDuelDocument,
} from "./models";
import type { PublicUser } from "./auth";
import { generatePsychotestQuestions } from "./gemini";

export type TestDuelSource =
  | { type: "public"; publicId: string }
  | { type: "generated"; userType: string; category: string; difficulty: string; count: number; customDurationSeconds?: number | null };

export type TestDuelResult = {
  score: number;
  correct: number;
  answered: number;
};

export type TestDuel = Omit<TestDuelDocument, "_id"> & { id: string };

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function toDuel(dto: TestDuelDocument): TestDuel {
  return dto.toJSON() as TestDuel;
}

function generateRoomCode() {
  return Array.from({ length: 6 }, () =>
    ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
  ).join("");
}

async function createQuestionInstances(sessionId: string, questions: PsychotestQuestion[]) {
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

async function createSessionFromQuestions(params: {
  user: PublicUser;
  questions: PsychotestQuestion[];
  meta: {
    userType: string;
    category: string;
    difficulty: string;
    customDurationSeconds: number | null;
  };
  duelId: string;
  duelRole: "host" | "guest";
  roomCode: string;
}) {
  const { user, questions, meta, duelId, duelRole, roomCode } = params;
  const sessionDoc = await TestSessionModel.create({
    userId: user.id,
    userType: meta.userType,
    category: meta.category,
    difficulty: meta.difficulty,
    questionCount: questions.length,
    customDurationSeconds: meta.customDurationSeconds,
    questionsJson: questions,
    startedAt: new Date(),
    duelId,
    duelRole,
    duelRoomCode: roomCode,
  });
  await createQuestionInstances(sessionDoc.id, questions);
  return sessionDoc.toJSON() as { id: string };
}

async function ensureUniqueRoomCode(attempts = 0): Promise<string> {
  await connectMongo();
  const code = generateRoomCode();
  if (attempts > 3) return code;
  const exists = await TestDuelModel.exists({ roomCode: code });
  if (exists) {
    return ensureUniqueRoomCode(attempts + 1);
  }
  return code;
}

export async function createTestDuel(user: PublicUser, source: TestDuelSource) {
  await connectMongo();

  let questions: PsychotestQuestion[] = [];
  let meta: { userType: string; category: string; difficulty: string; customDurationSeconds: number | null; publicId: string | null } = {
    userType: "",
    category: "",
    difficulty: "",
    customDurationSeconds: null,
    publicId: null,
  };

  if (source.type === "public") {
    const base = await TestSessionModel.findOne({
      publicId: source.publicId,
      isPublic: true,
    }).lean<{
      userType: string;
      category: string;
      difficulty: string;
      customDurationSeconds: number | null;
      questionsJson: PsychotestQuestion[];
    }>();
    if (!base) {
      throw new Error("Soal publik tidak ditemukan.");
    }
    questions = base.questionsJson;
    meta = {
      userType: base.userType,
      category: base.category,
      difficulty: base.difficulty,
      customDurationSeconds: base.customDurationSeconds ?? null,
      publicId: source.publicId,
    };
  } else {
    const generated = await generatePsychotestQuestions({
      userType: source.userType,
      category: source.category,
      difficulty: source.difficulty,
      count: source.count,
    });
    questions = generated;
    meta = {
      userType: source.userType,
      category: source.category,
      difficulty: source.difficulty,
      customDurationSeconds: source.customDurationSeconds ?? null,
      publicId: null,
    };
  }

  const roomCode = await ensureUniqueRoomCode();
  const duel = await TestDuelModel.create({
    roomCode,
    status: "waiting",
    sourceType: source.type,
    publicId: meta.publicId,
    userType: meta.userType,
    category: meta.category,
    difficulty: meta.difficulty,
    questionCount: questions.length,
    customDurationSeconds: meta.customDurationSeconds,
    questionsJson: questions,
    host: {
      userId: user.id,
      name: user.name ?? null,
      email: user.email,
      ready: true,
    },
  });

  const hostSession = await createSessionFromQuestions({
    user,
    questions,
    meta,
    duelId: duel.id,
    duelRole: "host",
    roomCode,
  });

  duel.host.sessionId = hostSession.id;
  await duel.save();

  return { duel: toDuel(duel), sessionId: hostSession.id };
}

export async function joinTestDuel(user: PublicUser, roomCode: string) {
  await connectMongo();
  const duel = await TestDuelModel.findOne({ roomCode });
  if (!duel) return null;

  const questions = duel.questionsJson;
  const meta = {
    userType: duel.userType,
    category: duel.category,
    difficulty: duel.difficulty,
    customDurationSeconds: duel.customDurationSeconds ?? null,
  };

  // If host re-joins
  if (duel.host.userId === user.id) {
    let sessionId = duel.host.sessionId;
    if (!sessionId) {
      const hostSession = await createSessionFromQuestions({
        user,
        questions,
        meta,
        duelId: duel.id,
        duelRole: "host",
        roomCode: duel.roomCode,
      });
      sessionId = hostSession.id;
      duel.host.sessionId = sessionId;
      await duel.save();
    }
    return { duel: toDuel(duel), sessionId };
  }

  // If guest already set
  if (duel.guest?.userId === user.id) {
    let sessionId = duel.guest.sessionId;
    if (!sessionId) {
      const guestSession = await createSessionFromQuestions({
        user,
        questions,
        meta,
        duelId: duel.id,
        duelRole: "guest",
        roomCode: duel.roomCode,
      });
      sessionId = guestSession.id;
      duel.guest.sessionId = sessionId;
      duel.status = duel.status === "waiting" ? "active" : duel.status;
      duel.startedAt = duel.startedAt ?? new Date();
      await duel.save();
    }
    return { duel: toDuel(duel), sessionId };
  }

  // If guest slot empty
  if (!duel.guest) {
    const guestSession = await createSessionFromQuestions({
      user,
      questions,
      meta,
      duelId: duel.id,
      duelRole: "guest",
      roomCode: duel.roomCode,
    });
    duel.guest = {
      userId: user.id,
      name: user.name ?? null,
      email: user.email,
      ready: true,
      sessionId: guestSession.id,
    };
    duel.status = "active";
    duel.startedAt = duel.startedAt ?? new Date();
    await duel.save();
    return { duel: toDuel(duel), sessionId: guestSession.id };
  }

  return null;
}

export async function submitTestDuelResult(
  duelId: string,
  userId: string,
  result: TestDuelResult
) {
  await connectMongo();
  const duel = await TestDuelModel.findById(duelId);
  if (!duel) return null;

  const isHost = duel.host.userId === userId;
  const isGuest = duel.guest?.userId === userId;
  if (!isHost && !isGuest) return null;

  const target = isHost ? duel.host : duel.guest;
  if (target) {
    target.score = result.score;
    target.correct = result.correct;
    target.answered = result.answered;
  }

  if (duel.host?.score != null && duel.guest?.score != null) {
    duel.status = "completed";
    duel.endedAt = new Date();
  }

  await duel.save();
  return toDuel(duel);
}
