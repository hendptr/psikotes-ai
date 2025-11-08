import { connectMongo } from "./MongoDB";
import { AnswerModel, TestSessionModel, UserModel, type PsychotestQuestion } from "./models";

const MODE_LABELS: Record<string, string> = {
  santai: "Santai",
  serius: "Serius",
  simulasi: "Simulasi",
};

const CATEGORY_LABELS: Record<string, string> = {
  mixed: "Campuran Variatif",
  padanan_kata: "Padanan Kata",
  sinonim_antonim: "Sinonim & Antonim",
  hafalan_kata: "Hafalan Kata",
  deret_matematika: "Deret Matematika",
  perbandingan_senilai_berbalik: "Perbandingan Senilai & Berbalik Nilai",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  mudah: "Mudah",
  sedang: "Sedang",
  sulit: "Sulit",
};

export type AnswerSummary = {
  questionIndex: number;
  selectedLabel: string;
  correctLabel: string;
  isCorrect: boolean;
  timeSpentMs: number;
};

export type SessionDetail = {
  id: string;
  userType: string;
  category: string;
  difficulty: string;
  questionCount: number;
  customDurationSeconds: number | null;
  startedAt: Date;
  completedAt: Date | null;
  score: number | null;
  isPublic: boolean;
  publicId: string | null;
  questions: PsychotestQuestion[];
  answers: AnswerSummary[];
};

export type SessionListEntry = {
  id: string;
  userType: string;
  category: string;
  difficulty: string;
  questionCount: number;
  customDurationSeconds: number | null;
  startedAt: Date;
  completedAt: Date | null;
  score: number | null;
  isPublic: boolean;
  publicId: string | null;
  totalAnswered: number;
  totalCorrect: number;
};

export type PublicSessionListEntry = {
  publicId: string;
  title: string;
  userType: string;
  category: string;
  difficulty: string;
  questionCount: number;
  customDurationSeconds: number | null;
  author: {
    name: string | null;
    email: string;
  };
  publishedAt: Date;
};

export async function getSessionForUser(
  userId: string,
  sessionId: string
): Promise<SessionDetail | null> {
  await connectMongo();

  const session = await TestSessionModel.findOne({
    _id: sessionId,
    userId,
  }).lean<{
    _id: string;
    userType: string;
    category: string;
    difficulty: string;
    questionCount: number;
    customDurationSeconds: number | null;
    isPublic: boolean;
    publicId: string | null;
    startedAt: Date;
    completedAt: Date | null;
    score: number | null;
    questionsJson: PsychotestQuestion[];
  }>();

  if (!session) {
    return null;
  }

  const answers = await AnswerModel.find({
    sessionId,
    userId,
  })
    .sort({ questionIndex: 1 })
    .lean<AnswerSummary[]>();

  return {
    id: session._id,
    userType: session.userType,
    category: session.category,
    difficulty: session.difficulty,
    questionCount: session.questionCount,
    customDurationSeconds: session.customDurationSeconds ?? null,
    isPublic: session.isPublic ?? false,
    publicId: session.publicId ?? null,
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? null,
    score: session.score ?? null,
    questions: session.questionsJson,
    answers,
  };
}

export async function listSessionsForUser(userId: string): Promise<SessionListEntry[]> {
  await connectMongo();

  const [sessions, answerStats] = await Promise.all([
    TestSessionModel.find({ userId })
      .sort({ startedAt: -1 })
      .limit(50)
      .lean<
        Array<{
          _id: string;
          userType: string;
          category: string;
          difficulty: string;
          questionCount: number;
          customDurationSeconds: number | null;
          isPublic: boolean;
          publicId: string | null;
          startedAt: Date;
          completedAt: Date | null;
          score: number | null;
        }>
      >(),
    AnswerModel.aggregate<{
      _id: string;
      total: number;
      correct: number;
    }>([
      { $match: { userId } },
      {
        $group: {
          _id: "$sessionId",
          total: { $sum: 1 },
          correct: {
            $sum: { $cond: [{ $eq: ["$isCorrect", true] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const statsMap = new Map(answerStats.map((stat) => [stat._id, stat]));

  return sessions.map((session) => {
    const stats = statsMap.get(session._id);
    return {
      id: session._id,
      userType: session.userType,
      category: session.category,
      difficulty: session.difficulty,
      questionCount: session.questionCount,
      customDurationSeconds: session.customDurationSeconds ?? null,
      isPublic: session.isPublic ?? false,
      publicId: session.publicId ?? null,
      startedAt: session.startedAt,
      completedAt: session.completedAt ?? null,
      score: session.score ?? null,
      totalAnswered: stats?.total ?? 0,
      totalCorrect: stats?.correct ?? 0,
    };
  });
}

export async function listPublicSessions(): Promise<PublicSessionListEntry[]> {
  await connectMongo();

  const sessions = await TestSessionModel.find({
    isPublic: true,
    publicId: { $ne: null },
  })
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean<
      Array<{
        publicId: string;
        userId: string;
        userType: string;
        category: string;
        difficulty: string;
        questionCount: number;
        customDurationSeconds: number | null;
        updatedAt: Date;
      }>
    >();

  const authorIds = Array.from(new Set(sessions.map((session) => session.userId)));
  const authors = await UserModel.find({ _id: { $in: authorIds } }).lean<
    Array<{ _id: string; name: string | null; email: string }>
  >();
  const authorMap = new Map(authors.map((author) => [author._id, author]));

  return sessions.map((session) => {
    const author = authorMap.get(session.userId);
    return {
      publicId: session.publicId,
      title: `${CATEGORY_LABELS[session.category] ?? session.category} - ${
        DIFFICULTY_LABELS[session.difficulty] ?? session.difficulty
      }`,
      userType: session.userType,
      category: session.category,
      difficulty: session.difficulty,
      questionCount: session.questionCount,
      customDurationSeconds: session.customDurationSeconds ?? null,
      author: {
        name: author?.name ?? null,
        email: author?.email ?? "",
      },
      publishedAt: session.updatedAt,
    };
  });
}

