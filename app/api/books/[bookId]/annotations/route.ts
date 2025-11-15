import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/MongoDB";
import { BookAnnotationModel, BookModel } from "@/lib/models";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const pointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const strokeSchema = z.object({
  type: z.enum(["pen", "circle", "cross"]).optional(),
  color: z.string().min(1),
  width: z.number().min(0.5).max(20),
  points: z.array(pointSchema).min(2),
});

const payloadSchema = z.object({
  page: z.number().int().min(1).max(10_000),
  strokes: z.array(strokeSchema),
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
  const pageParam = req.nextUrl.searchParams.get("page");
  await connectMongo();

  if (pageParam) {
    const page = Number(pageParam);
    const annotation = await BookAnnotationModel.findOne({ userId: user.id, bookId, page }).lean();
    return NextResponse.json({ annotation });
  }

  const annotations = await BookAnnotationModel.find({ userId: user.id, bookId }).lean();
  return NextResponse.json({ annotations });
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
    const json = await req.json();
    const parsed = payloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data coretan tidak valid." }, { status: 400 });
    }

    await connectMongo();
    const exists = await BookModel.exists({ _id: bookId });
    if (!exists) {
      return NextResponse.json({ error: "Buku tidak ditemukan." }, { status: 404 });
    }

    const annotation = await BookAnnotationModel.findOneAndUpdate(
      { userId: user.id, bookId, page: parsed.data.page },
      { $set: { strokes: parsed.data.strokes } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({ annotation });
  } catch (error) {
    console.error("Failed to save annotations:", error);
    return NextResponse.json({ error: "Gagal menyimpan coretan." }, { status: 500 });
  }
}
