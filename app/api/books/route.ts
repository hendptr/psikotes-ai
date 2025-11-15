import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { promises as fs } from "fs";
import { z } from "zod";
import { connectMongo } from "@/lib/MongoDB";
import { BookModel } from "@/lib/models";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_PDF_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB safety cap
const BOOKS_ROOT = path.join(process.cwd(), "public", "books");
const PDF_DIR = path.join(BOOKS_ROOT, "pdfs");

const uploadSchema = z.object({
  title: z.string().trim().min(3).max(160),
  author: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
});

function sanitizeFilename(input: string) {
  const lower = input.toLowerCase().replace(/[^a-z0-9]+/gi, "-");
  const normalized = lower.replace(/-+/g, "-").replace(/(^-|-$)/g, "");
  return normalized || "book";
}

async function ensureUploadDir() {
  await fs.mkdir(PDF_DIR, { recursive: true });
}

function toRelativePublicPath(absolutePath: string) {
  const relative = path.relative(path.join(process.cwd(), "public"), absolutePath);
  return `/${relative.replace(/\\/g, "/")}`;
}

export async function GET() {
  await connectMongo();
  const books = await BookModel.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json({ books });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const textPayload = uploadSchema.safeParse({
      title: formData.get("title"),
      author: formData.get("author"),
      description: formData.get("description"),
    });
    if (!textPayload.success) {
      return NextResponse.json({ error: "Data buku tidak valid." }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File PDF wajib diunggah." }, { status: 400 });
    }

    const fileMime = (file.type || "").toLowerCase();
    if (fileMime && !fileMime.includes("pdf")) {
      return NextResponse.json({ error: "File harus berupa PDF." }, { status: 400 });
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      return NextResponse.json({ error: "Ukuran PDF maksimal 100MB." }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (!fileBuffer.length) {
      return NextResponse.json({ error: "File kosong tidak dapat dipakai." }, { status: 400 });
    }

    const bookId = randomUUID();
    const safeName = sanitizeFilename(file.name || textPayload.data.title);
    const pdfFilename = `${bookId}-${safeName}.pdf`;
    const pdfDiskPath = path.join(PDF_DIR, pdfFilename);

    await ensureUploadDir();
    await fs.writeFile(pdfDiskPath, fileBuffer);

    await connectMongo();
    const [book] = await BookModel.create([
      {
        _id: bookId,
        title: textPayload.data.title,
        author: textPayload.data.author ?? "",
        description: textPayload.data.description ?? "",
        pdfPath: pdfDiskPath,
        pdfUrl: toRelativePublicPath(pdfDiskPath),
        originalFileName: file.name || `${safeName}.pdf`,
        fileSize: fileBuffer.length,
        createdBy: user.id,
      },
    ]);

    return NextResponse.json({ book: book.toJSON() }, { status: 201 });
  } catch (error) {
    console.error("Failed to upload book:", error);
    return NextResponse.json({ error: "Gagal menyimpan buku." }, { status: 500 });
  }
}
