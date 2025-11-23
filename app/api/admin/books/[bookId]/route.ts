import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { connectMongo } from "@/lib/MongoDB";
import { BookModel } from "@/lib/models";

export const runtime = "nodejs";

const payloadSchema = z.object({
  isPublic: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookId } = await params;
  if (!bookId) {
    return NextResponse.json({ error: "ID buku tidak valid." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
    }

    await connectMongo();
    const result = await BookModel.findByIdAndUpdate(
      bookId,
      { $set: { isPublic: parsed.data.isPublic } },
      { new: true }
    ).lean<{ _id: string }>();

    if (!result) {
      return NextResponse.json({ error: "Buku tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, isPublic: parsed.data.isPublic });
  } catch (error) {
    console.error("Admin update book visibility error:", error);
    return NextResponse.json({ error: "Gagal memperbarui status buku." }, { status: 500 });
  }
}
