import { NextResponse } from "next/server";
import { listSessions } from "@/lib/session-store";

export const runtime = "nodejs";

export async function GET() {
  const sessions = await listSessions();
  const sorted = sessions
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((session) => ({
      sessionId: session.sessionId,
      questions: session.questions,
      answers: session.answers,
      currentIndex: session.currentIndex,
      completed: session.completed,
      config: session.config,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
    }));

  return NextResponse.json({ sessions: sorted });
}
