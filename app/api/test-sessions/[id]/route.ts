import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { AnswerModel, QuestionInstanceModel, TestSessionModel } from "@/lib/models";
import { getSessionForUser } from "@/lib/test-sessions";

export const runtime = "nodejs";

type RouteParams = { id: string };

export async function GET(
  req: NextRequest,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await Promise.resolve(params);
    const session = await getSessionForUser(user.id, id);
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error("Fetch session error:", error);
    return NextResponse.json({ error: "Gagal memuat sesi." }, { status: 500 });
  }
}

export async function PATCH(
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
    const action = body?.action as "publish" | "unpublish" | undefined;

    if (!action || !["publish", "unpublish"].includes(action)) {
      return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
    }

    const session = await TestSessionModel.findOne({ _id: id, userId: user.id }).lean<{
      _id: string;
      isPublic: boolean;
      publicId: string | null;
    }>();

    if (!session) {
      return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
    }

    if (action === "publish") {
      const publicId = session.publicId ?? randomUUID();
      await TestSessionModel.updateOne(
        { _id: id },
        {
          $set: {
            isPublic: true,
            publicId,
          },
        }
      );
      return NextResponse.json({ ok: true, isPublic: true, publicId });
    }

    await TestSessionModel.updateOne(
      { _id: id },
      {
        $set: {
          isPublic: false,
        },
      }
    );

    return NextResponse.json({ ok: true, isPublic: false });
  } catch (error) {
    console.error("Update session visibility error:", error);
    return NextResponse.json({ error: "Gagal memperbarui status publikasi." }, { status: 500 });
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
    const existing = await TestSessionModel.findOne({ _id: id, userId: user.id }).lean();
    if (!existing) {
      return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
    }

    await Promise.all([
      QuestionInstanceModel.deleteMany({ sessionId: id }),
      AnswerModel.deleteMany({ sessionId: id }),
      TestSessionModel.deleteOne({ _id: id }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json({ error: "Gagal menghapus sesi." }, { status: 500 });
  }
}
