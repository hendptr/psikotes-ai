import { promises as fs } from "fs";
import path from "path";

const SESSION_DIR = path.join(process.cwd(), ".tmp");
const SESSION_FILE = path.join(SESSION_DIR, "session-store.json");

export type AnswerSnapshot = {
  selected: string | null;
  isCorrect: boolean | null;
  timeSpent: number;
  autoAdvance?: boolean;
};

export type SessionConfig = {
  userType: string;
  category: string;
  difficulty: string;
  count: number;
  customTimeSeconds?: number | null;
};

export type SessionRecord = {
  sessionId: string;
  questions: unknown[];
  answers: Record<number, AnswerSnapshot>;
  currentIndex: number;
  completed: boolean;
  config: SessionConfig;
  updatedAt: number;
  startedAt: number;
};

const sessionStore = new Map<string, SessionRecord>();
let initialized = false;
let pendingSave: Promise<void> | null = null;

async function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  try {
    const buffer = await fs.readFile(SESSION_FILE, "utf8");
    const raw = JSON.parse(buffer) as SessionRecord[];
    for (const record of raw) {
      sessionStore.set(record.sessionId, record);
    }
  } catch (error: unknown) {
    // File may not exist on first run; ignore ENOENT.
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.error("Failed to load session store:", error);
    }
  }
}

async function persistStore() {
  await ensureInitialized();
  await fs.mkdir(SESSION_DIR, { recursive: true });
  const snapshot = Array.from(sessionStore.values());
  await fs.writeFile(SESSION_FILE, JSON.stringify(snapshot, null, 2), "utf8");
}

function schedulePersist() {
  if (pendingSave) return;
  pendingSave = persistStore()
    .catch((error) => {
      console.error("Failed to persist session store:", error);
    })
    .finally(() => {
      pendingSave = null;
    });
}

export async function getSession(sessionId: string) {
  await ensureInitialized();
  return sessionStore.get(sessionId) ?? null;
}

export async function setSession(record: SessionRecord) {
  await ensureInitialized();
  sessionStore.set(record.sessionId, record);
  schedulePersist();
  return record;
}

export async function updateSession(
  sessionId: string,
  updater: (record: SessionRecord | null) => SessionRecord | null
) {
  await ensureInitialized();
  const current = sessionStore.get(sessionId) ?? null;
  const next = updater(current);
  if (!next) {
    if (sessionStore.has(sessionId)) {
      sessionStore.delete(sessionId);
      schedulePersist();
    }
    return null;
  }
  sessionStore.set(sessionId, next);
  schedulePersist();
  return next;
}

export async function deleteSession(sessionId: string) {
  await ensureInitialized();
  const existed = sessionStore.delete(sessionId);
  if (existed) {
    schedulePersist();
  }
  return existed;
}

export async function listSessions() {
  await ensureInitialized();
  return Array.from(sessionStore.values());
}
