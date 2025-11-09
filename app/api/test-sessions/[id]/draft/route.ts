import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/MongoDB";
import { getCurrentUser } from "@/lib/auth";
import { TestSessionModel } from "@/lib/models";

export const runtime = "nodejs";

const saveDraftSchema = z.object({
  questionIndex: z.number().int().min(0),
  remainingSeconds: z.number().int().min(0).nullable().optional(),
});

type RouteParams = { id: string };

export async function POST(
  req: NextRequest,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await Promise.resolve(params);
    const body = await req.json().catch(() => null);
    const parsed = saveDraftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload draft tidak valid." }, { status: 400 });
    }

    await connectMongo();
    const session = await TestSessionModel.findOne({
      _id: id,
      userId: user.id,
    }).lean<{ _id: string; questionCount: number }>();

    if (!session) {
      return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
    }

    const clampedIndex = Math.min(
      Math.max(parsed.data.questionIndex, 0),
      Math.max(session.questionCount - 1, 0)
    );

    await TestSessionModel.updateOne(
      { _id: id },
      {
        $set: {
          isDraft: true,
          draftSavedAt: new Date(),
          draftQuestionIndex: clampedIndex,
          draftTimerSeconds:
            typeof parsed.data.remainingSeconds === "number" ? parsed.data.remainingSeconds : null,
        },
      }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Save draft error:", error);
    return NextResponse.json({ error: "Gagal menyimpan draft sesi." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await Promise.resolve(params);
    await connectMongo();
    const result = await TestSessionModel.updateOne(
      { _id: id, userId: user.id },
      {
        $set: {
          isDraft: false,
          draftSavedAt: null,
          draftQuestionIndex: null,
          draftTimerSeconds: null,
        },
      }
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Clear draft error:", error);
    return NextResponse.json({ error: "Gagal menghapus status draft." }, { status: 500 });
  }
}
