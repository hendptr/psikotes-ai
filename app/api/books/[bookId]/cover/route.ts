import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { BookModel } from "@/lib/models";
import { connectMongo } from "@/lib/MongoDB";

const COVER_DIR = path.join(process.cwd(), "public", "books", "covers");

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) {
    return null;
  }
  return Buffer.from(match[1]!, "base64");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;
  if (!bookId) {
    return NextResponse.json({ error: "ID buku tidak valid." }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => null);
    const buffer = body?.dataUrl ? parseDataUrl(body.dataUrl) : null;
    if (!buffer?.length) {
      return NextResponse.json({ error: "Data cover tidak valid." }, { status: 400 });
    }

    await fs.mkdir(COVER_DIR, { recursive: true });
    const coverPath = path.join(COVER_DIR, `${bookId}.png`);
    await fs.writeFile(coverPath, buffer);
    const relativeUrl = `/books/covers/${bookId}.png`;

    await connectMongo();
    await BookModel.updateOne(
      { _id: bookId },
      {
        $set: {
          coverImagePath: coverPath,
          coverImageUrl: relativeUrl,
        },
      }
    );

    return NextResponse.json({ coverUrl: relativeUrl });
  } catch (error) {
    console.error("Failed to save cover:", error);
    return NextResponse.json({ error: "Gagal menyimpan cover." }, { status: 500 });
  }
}
