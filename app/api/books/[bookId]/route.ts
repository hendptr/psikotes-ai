import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import { connectMongo } from "@/lib/MongoDB";
import { BookModel } from "@/lib/models";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

async function deleteFileIfExists(filePath?: string | null) {
  if (!filePath) {
    return;
  }
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.error(`Failed to delete file at ${filePath}`, error);
    }
  }
}

export async function DELETE(
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
    await connectMongo();
    const book = await BookModel.findById(bookId).lean<{
      _id: string;
      createdBy?: string | null;
      pdfPath?: string | null;
      coverImagePath?: string | null;
    }>();

    if (!book) {
      return NextResponse.json({ error: "Buku tidak ditemukan." }, { status: 404 });
    }

    if (book.createdBy && book.createdBy !== user.id) {
      return NextResponse.json({ error: "Tidak diizinkan menghapus buku ini." }, { status: 403 });
    }

    await Promise.allSettled([
      deleteFileIfExists(book.pdfPath),
      deleteFileIfExists(book.coverImagePath),
    ]);

    await BookModel.deleteOne({ _id: bookId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete book:", error);
    return NextResponse.json({ error: "Gagal menghapus buku." }, { status: 500 });
  }
}
