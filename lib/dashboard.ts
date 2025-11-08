import { connectMongo } from "./MongoDB";
import { AnswerModel, TestSessionModel } from "./models";

export type CategoryAccuracy = {
  correct: number;
  total: number;
  accuracy: number;
};

export type SessionSummary = {
  id: string;
  startedAt: Date;
  completedAt: Date | null;
  questionCount: number;
  correctCount: number;
  accuracy: number;
};

export type DashboardData = {
  totalSessionsCompleted: number;
  totalQuestionsAnswered: number;
  totalCorrect: number;
  totalIncorrect: number;
  averageAccuracy: number;
  averageTimePerQuestionSeconds: number;
  categoryAccuracy: Record<string, CategoryAccuracy>;
  sessions: SessionSummary[];
};

export async function getDashboardData(userId: string): Promise<DashboardData> {
  await connectMongo();

  const [sessionStats, sessionList] = await Promise.all([
    AnswerModel.aggregate<{
      _id: string;
      total: number;
      correct: number;
      totalTime: number;
    }>([
      { $match: { userId } },
      {
        $group: {
          _id: "$sessionId",
          total: { $sum: 1 },
          correct: {
            $sum: {
              $cond: [{ $eq: ["$isCorrect", true] }, 1, 0],
            },
          },
          totalTime: { $sum: "$timeSpentMs" },
        },
      },
    ]),
    TestSessionModel.find({ userId })
      .sort({ startedAt: -1 })
      .limit(20)
      .lean<
        Array<{
          _id: string;
          startedAt: Date;
          completedAt: Date | null;
          questionCount: number;
        }>
      >(),
  ]);

  const aggregateTotals = sessionStats.reduce(
    (acc, item) => {
      acc.totalAnswers += item.total;
      acc.totalCorrect += item.correct;
      acc.totalTime += item.totalTime;
      return acc;
    },
    { totalAnswers: 0, totalCorrect: 0, totalTime: 0 }
  );

  const categoryAgg = await AnswerModel.aggregate<{
    _id: string;
    correct: number;
    total: number;
  }>([
    { $match: { userId } },
    {
      $group: {
        _id: "$category",
        total: { $sum: 1 },
        correct: {
          $sum: {
            $cond: [{ $eq: ["$isCorrect", true] }, 1, 0],
          },
        },
      },
    },
  ]);

  const sessionStatsMap = new Map(sessionStats.map((item) => [item._id, item]));
  const sessions: SessionSummary[] = sessionList.map((session) => {
    const stats = sessionStatsMap.get(session._id);
    const correctCount = stats?.correct ?? 0;
    const total = stats?.total ?? session.questionCount;
    return {
      id: session._id,
      startedAt: session.startedAt,
      completedAt: session.completedAt ?? null,
      questionCount: session.questionCount,
      correctCount,
      accuracy: total > 0 ? (correctCount / total) * 100 : 0,
    };
  });

  const categoryAccuracy = categoryAgg.reduce<Record<string, CategoryAccuracy>>((acc, item) => {
    const accuracy = item.total > 0 ? (item.correct / item.total) * 100 : 0;
    acc[item._id] = {
      correct: item.correct,
      total: item.total,
      accuracy,
    };
    return acc;
  }, {});

  const totalSessionsCompleted = await TestSessionModel.countDocuments({
    userId,
    completedAt: { $ne: null },
  });

  const totalQuestionsAnswered = aggregateTotals.totalAnswers;
  const totalCorrect = aggregateTotals.totalCorrect;
  const totalIncorrect = totalQuestionsAnswered - totalCorrect;
  const averageAccuracy =
    totalQuestionsAnswered > 0 ? (totalCorrect / totalQuestionsAnswered) * 100 : 0;
  const averageTimePerQuestionSeconds =
    totalQuestionsAnswered > 0 ? aggregateTotals.totalTime / totalQuestionsAnswered / 1000 : 0;

  return {
    totalSessionsCompleted,
    totalQuestionsAnswered,
    totalCorrect,
    totalIncorrect,
    averageAccuracy,
    averageTimePerQuestionSeconds,
    categoryAccuracy,
    sessions,
  };
}
