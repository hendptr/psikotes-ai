import { connectMongo } from "./MongoDB";
import { KreplinResultModel, type KreplinResultDocument } from "./models";

export type KreplinSectionStat = {
  index: number;
  correct: number;
  total: number;
};

export type KreplinSpeedBucket = {
  index: number;
  correct: number;
  total: number;
};

export type KreplinResultInput = {
  mode: "manual" | "auto" | "tryout";
  durationSeconds: number;
  totalSections: number | null;
  totalAnswered: number;
  totalCorrect: number;
  totalIncorrect: number;
  accuracy: number;
  perSectionStats: KreplinSectionStat[];
  speedTimeline: KreplinSpeedBucket[];
};

export async function saveKreplinResult(userId: string, payload: KreplinResultInput) {
  await connectMongo();
  const result = await KreplinResultModel.create({
    userId,
    ...payload,
  });
  return result.toJSON() as KreplinResultDocument;
}

export async function listKreplinResults(userId: string, limit = 20) {
  await connectMongo();
  const results = await KreplinResultModel.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<(Omit<KreplinResultDocument, "id"> & { _id: string })[]>();

  return results.map((item) => ({
    ...item,
    id: item._id,
  }));
}

export async function getKreplinResult(userId: string, resultId: string) {
  await connectMongo();
  const result = await KreplinResultModel.findOne({
    _id: resultId,
    userId,
  }).lean<(Omit<KreplinResultDocument, "id"> & { _id: string })>();
  if (!result) {
    return null;
  }
  return {
    ...result,
    id: result._id,
  };
}

export async function deleteKreplinResult(userId: string, resultId: string) {
  await connectMongo();
  const deletion = await KreplinResultModel.deleteOne({
    _id: resultId,
    userId,
  });
  return deletion.deletedCount ?? 0;
}
