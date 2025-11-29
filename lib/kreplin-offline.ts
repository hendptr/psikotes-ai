import type { KreplinResultInput } from "./kreplin";
import type { KreplinDuelRole } from "./kreplin-duel";

export type OfflineKreplinResult = KreplinResultInput & {
  id: string;
  createdAt: string;
  duelId?: string | null;
  duelRole?: KreplinDuelRole | null;
};

const STORAGE_KEY = "kreplinOfflineResults";
const MAX_QUEUE = 10;

function readQueue(): OfflineKreplinResult[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistQueue(queue: OfflineKreplinResult[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function getOfflineKreplinQueue() {
  return readQueue();
}

export function findOfflineKreplinResult(id: string) {
  return readQueue().find((item) => item.id === id) ?? null;
}

export function saveOfflineKreplinResult(result: OfflineKreplinResult) {
  const queue = readQueue().filter((item) => item.id !== result.id);
  const nextQueue = [...queue, result].slice(-MAX_QUEUE);
  persistQueue(nextQueue);
  return result;
}

export function removeOfflineKreplinResult(id: string) {
  const queue = readQueue().filter((item) => item.id !== id);
  persistQueue(queue);
  return queue;
}

export async function syncOfflineKreplinResults() {
  const queue = readQueue();
  if (queue.length === 0) {
    return { synced: [] as { offlineId: string; serverId?: string }[], remaining: queue };
  }

  const synced: { offlineId: string; serverId?: string }[] = [];
  const remaining: OfflineKreplinResult[] = [];

  for (const item of queue) {
    try {
      const { id: _id, createdAt: _createdAt, ...payload } = item;
      const response = await fetch("/api/kreplin-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const json = await response.json().catch(() => ({}));
        const serverId = typeof json?.resultId === "string" ? json.resultId : undefined;
        if (serverId && item.duelId && item.duelRole) {
          void fetch(`/api/kreplin-duels/${item.duelId}/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resultId: serverId,
              totalCorrect: item.totalCorrect,
              totalAnswered: item.totalAnswered,
              accuracy: item.accuracy,
            }),
          }).catch((err) => console.error("Submit duel result from offline queue failed:", err));
        }
        synced.push({ offlineId: item.id, serverId });
        continue;
      }
    } catch (error) {
      console.error("Sync offline Kreplin result failed:", error);
    }
    remaining.push(item);
  }

  persistQueue(remaining);
  return { synced, remaining };
}
