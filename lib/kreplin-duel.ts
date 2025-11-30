import { randomUUID } from "crypto";
import { connectMongo } from "./MongoDB";
import { KreplinDuelModel, type KreplinDuelDocument } from "./models";
import type { PublicUser } from "./auth";

export type KreplinDuelStatus = "waiting" | "ready" | "active" | "completed";
export type KreplinDuelRole = "host" | "guest";

export type KreplinDuelSummary = {
  totalCorrect: number;
  totalAnswered: number;
  accuracy: number;
  resultId?: string | null;
};

export type KreplinDuel = Omit<KreplinDuelDocument, "_id"> & { id: string };

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function generateRoomCode(attempts = 0): Promise<string> {
  const code = Array.from({ length: 6 }, () =>
    ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
  ).join("");
  if (attempts > 4) return code;

  await connectMongo();
  const exists = await KreplinDuelModel.exists({ roomCode: code });
  if (exists) {
    return generateRoomCode(attempts + 1);
  }
  return code;
}

function toDuel(dto: KreplinDuelDocument): KreplinDuel {
  return (dto as unknown as { toJSON: () => KreplinDuel }).toJSON();
}

export async function createKreplinDuel(user: PublicUser, durationSeconds: number) {
  await connectMongo();
  const roomCode = await generateRoomCode();
  const duel = await KreplinDuelModel.create({
    roomCode,
    status: "waiting",
    durationSeconds,
    mode: "auto",
    host: {
      userId: user.id,
      name: user.name ?? null,
      email: user.email,
      ready: false,
    },
  });
  return toDuel(duel);
}

export async function joinKreplinDuel(user: PublicUser, roomCode: string) {
  await connectMongo();
  const duel = await KreplinDuelModel.findOne({ roomCode });
  if (!duel) return null;

  if (duel.guest?.userId && duel.host.userId !== user.id && duel.guest.userId !== user.id) {
    return null;
  }

  if (duel.host.userId === user.id) {
    return toDuel(duel);
  }

  if (duel.guest?.userId === user.id) {
    return toDuel(duel);
  }

  duel.guest = {
    userId: user.id,
    name: user.name ?? null,
    email: user.email,
    ready: false,
  };

  await duel.save();
  return toDuel(duel);
}

export async function getKreplinDuelById(duelId: string) {
  await connectMongo();
  const duel = await KreplinDuelModel.findById(duelId);
  if (!duel) return null;
  return toDuel(duel);
}

export async function setKreplinDuelReady(
  duelId: string,
  userId: string,
  ready: boolean
) {
  await connectMongo();
  const duel = await KreplinDuelModel.findById(duelId);
  if (!duel) return null;
  if (duel.status === "completed") return toDuel(duel);

  const isHost = duel.host.userId === userId;
  const isGuest = duel.guest?.userId === userId;
  if (!isHost && !isGuest) return null;

  if (isHost) duel.host.ready = ready;
  if (isGuest && duel.guest) duel.guest.ready = ready;

  if (duel.host.ready && duel.guest?.ready && duel.status !== "active") {
    duel.status = "active";
    duel.startedAt = new Date();
  } else if (!duel.host.ready || !duel.guest?.ready) {
    duel.status = "ready";
    duel.startedAt = null;
  } else if (duel.status === "waiting" && (duel.host.ready || duel.guest?.ready)) {
    duel.status = "ready";
  }

  await duel.save();
  return toDuel(duel);
}

export async function submitKreplinDuelResult(
  duelId: string,
  userId: string,
  summary: KreplinDuelSummary
) {
  await connectMongo();
  const duel = await KreplinDuelModel.findById(duelId);
  if (!duel) return null;

  const isHost = duel.host.userId === userId;
  const isGuest = duel.guest?.userId === userId;
  if (!isHost && !isGuest) return null;

  const target = isHost ? duel.host : duel.guest;
  if (target) {
    target.resultId = summary.resultId ?? target.resultId ?? randomUUID();
    target.totalCorrect = summary.totalCorrect;
    target.totalAnswered = summary.totalAnswered;
    target.accuracy = summary.accuracy;
  }

  if (duel.host?.resultId && duel.guest?.resultId) {
    duel.status = "completed";
    duel.endedAt = new Date();
  }

  await duel.save();
  return toDuel(duel);
}
