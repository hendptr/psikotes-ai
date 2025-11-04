import { NextRequest, NextResponse } from "next/server";
import {
  AnswerSnapshot,
  deleteSession,
  getSession,
  updateSession,
} from "@/lib/session-store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ sessionId: string }> };

type UpdateSessionBody = {
  answers?: Record<number, AnswerSnapshot>;
  currentIndex?: number;
  completed?: boolean;
};

export async function GET(
  _req: NextRequest,
  context: RouteContext
) {
  const { sessionId } = await context.params;
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "Session tidak ditemukan." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    sessionId: session.sessionId,
    questions: session.questions,
    progress: {
      answers: session.answers,
      currentIndex: session.currentIndex,
      completed: session.completed,
    },
    config: session.config,
  });
}

export async function PATCH(
  req: NextRequest,
  context: RouteContext
) {
  let body: UpdateSessionBody;
  try {
    body = (await req.json()) as UpdateSessionBody;
  } catch {
    return NextResponse.json(
      { error: "Payload tidak valid." },
      { status: 400 }
    );
  }

  const { sessionId } = await context.params;

  const updated = await updateSession(sessionId, (record) => {
    if (!record) {
      return null;
    }

    return {
      ...record,
      answers: body.answers ?? record.answers,
      currentIndex:
        typeof body.currentIndex === "number" && !Number.isNaN(body.currentIndex)
          ? body.currentIndex
          : record.currentIndex,
      completed:
        typeof body.completed === "boolean" ? body.completed : record.completed,
      updatedAt: Date.now(),
    };
  });

  if (!updated) {
    return NextResponse.json(
      { error: "Session tidak ditemukan." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    sessionId: updated.sessionId,
    progress: {
      answers: updated.answers,
      currentIndex: updated.currentIndex,
      completed: updated.completed,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  context: RouteContext
) {
  const { sessionId } = await context.params;
  const removed = await deleteSession(sessionId);
  if (!removed) {
    return NextResponse.json(
      { error: "Session tidak ditemukan." },
      { status: 404 }
    );
  }
  return NextResponse.json({ success: true });
}

