import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { connectMongo } from "@/lib/MongoDB";
import { TestSessionModel } from "@/lib/models";

export const runtime = "nodejs";

const payloadSchema = z.object({
  isPublic: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ error: "ID sesi tidak valid." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
    }

    await connectMongo();
    const session = await TestSessionModel.findById(sessionId).lean<{
      _id: string;
      publicId?: string | null;
    }>();
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
    }

    if (parsed.data.isPublic) {
      const publicId = session.publicId ?? randomUUID();
      await TestSessionModel.updateOne(
        { _id: sessionId },
        { $set: { isPublic: true, publicId } }
      );
      return NextResponse.json({ ok: true, isPublic: true, publicId });
    }

    await TestSessionModel.updateOne({ _id: sessionId }, { $set: { isPublic: false } });
    return NextResponse.json({ ok: true, isPublic: false });
  } catch (error) {
    console.error("Admin update session visibility error:", error);
    return NextResponse.json({ error: "Gagal memperbarui status arsip." }, { status: 500 });
  }
}
