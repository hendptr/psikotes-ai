import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/MongoDB";
import { BookModel, BookProgressModel } from "@/lib/models";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const updateSchema = z.object({
  status: z.enum(["not_started", "reading", "completed"]),
  lastPage: z.number().int().min(1).max(10_000),
  note: z.string().max(2000).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { bookId } = await params;
  if (!bookId) {
    return NextResponse.json({ error: "ID buku tidak valid." }, { status: 400 });
  }

  await connectMongo();
  const progress = await BookProgressModel.findOne({ userId: user.id, bookId }).lean<{
    status: "not_started" | "reading" | "completed";
    lastPage: number;
    note: string;
    updatedAt: Date;
  }>();
  if (!progress) {
    return NextResponse.json({ progress: null });
  }
  return NextResponse.json({
    progress: {
      status: progress.status,
      lastPage: progress.lastPage,
      note: progress.note,
      updatedAt: progress.updatedAt,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { bookId } = await params;
  if (!bookId) {
    return NextResponse.json({ error: "ID buku tidak valid." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data progres tidak valid." }, { status: 400 });
    }
    const { status, lastPage, note } = parsed.data;

    await connectMongo();
    const bookExists = await BookModel.exists({ _id: bookId });
    if (!bookExists) {
      return NextResponse.json({ error: "Buku tidak ditemukan." }, { status: 404 });
    }

    const progress = await BookProgressModel.findOneAndUpdate(
      { userId: user.id, bookId },
      { $set: { status, lastPage, note: note ?? "" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean<{
      status: "not_started" | "reading" | "completed";
      lastPage: number;
      note: string;
      updatedAt: Date;
    }>();

    if (!progress) {
      return NextResponse.json({ error: "Gagal menyimpan progres." }, { status: 500 });
    }

    return NextResponse.json({
      progress: {
        status: progress.status,
        lastPage: progress.lastPage,
        note: progress.note,
        updatedAt: progress.updatedAt,
      },
    });
  } catch (error) {
    console.error("Failed to update book progress:", error);
    return NextResponse.json({ error: "Gagal menyimpan progres buku." }, { status: 500 });
  }
}
