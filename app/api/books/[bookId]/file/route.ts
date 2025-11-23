import { NextResponse, type NextRequest } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { connectMongo } from "@/lib/MongoDB";
import { BookModel } from "@/lib/models";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;
  if (!bookId) {
    return NextResponse.json({ error: "ID buku tidak valid." }, { status: 400 });
  }

  try {
    await connectMongo();
    const book = await BookModel.findById(bookId).lean<{
      _id: string;
      pdfPath?: string | null;
      title?: string;
      originalFileName?: string;
      createdBy?: string | null;
      isPublic?: boolean;
    }>();

    if (!book?.pdfPath) {
      return NextResponse.json({ error: "File buku tidak ditemukan." }, { status: 404 });
    }

    const user = await getCurrentUser(req);
    const isPublic = book.isPublic !== false;
    const isOwner = book.createdBy ? user?.id === book.createdBy : true;
    const isAdmin = user?.role === "admin";
    if (!isPublic && !isOwner && !isAdmin) {
      return NextResponse.json({ error: "Tidak diizinkan mengakses file ini." }, { status: 403 });
    }

    const fileStats = await stat(book.pdfPath);
    const nodeStream = createReadStream(book.pdfPath);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;

    const filename = book.originalFileName || `${book.title ?? "book"}.pdf`;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": fileStats.size.toString(),
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Failed to stream book:", error);
    return NextResponse.json({ error: "Gagal memuat file buku." }, { status: 500 });
  }
}
