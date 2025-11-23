import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connectMongo } from "@/lib/MongoDB";
import { BookAnnotationModel, BookModel, BookProgressModel, type BookDocument } from "@/lib/models";
import { BASE_PATH } from "@/lib/config";
import BookReadingWorkspace from "@/components/book-reading-workspace";
import { getCurrentUserFromCookies } from "@/lib/auth";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type BookDetail = Pick<
  BookDocument,
  "id" | "title" | "author" | "description" | "fileSize" | "createdAt"
> & { pdfUrl: string; createdBy: string | null; isPublic: boolean };

const getBook = cache(async (bookId: string): Promise<BookDetail | null> => {
  await connectMongo();
  const doc = await BookModel.findById(bookId).lean<{
    _id: string;
    title: string;
    author: string;
    description: string;
    pdfUrl: string;
    fileSize: number;
    createdAt: Date;
    createdBy?: string | null;
    isPublic?: boolean;
  }>();

  if (!doc) {
    return null;
  }

  return {
    id: doc._id,
    title: doc.title,
    author: doc.author,
    description: doc.description,
    pdfUrl: `${BASE_PATH}/api/books/${doc._id}/file`,
    fileSize: doc.fileSize,
    createdAt: doc.createdAt,
    createdBy: doc.createdBy ?? null,
    isPublic: doc.isPublic !== false,
  };
});

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(date: Date) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

type BookPageProps = {
  params: { bookId: string } | Promise<{ bookId: string }>;
};

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params);
  const book = await getBook(resolvedParams.bookId);
  if (!book) {
    return {
      title: "Buku tidak ditemukan - Perpustakaan Digital",
    };
  }
  if (!book.isPublic) {
    return {
      title: "Buku privat - Perpustakaan Digital",
      description: "Konten ini hanya tersedia untuk pemilik atau admin.",
    };
  }
  return {
    title: `${book.title} - Perpustakaan Digital`,
    description: book.description || "Baca buku digital langsung dari perpustakaan publik Psikotes AI.",
  };
}

async function fetchProgress(bookId: string, userId?: string | null) {
  if (!userId) return null;
  await connectMongo();
  const progress = await BookProgressModel.findOne({ userId, bookId }).lean<{
    status: "not_started" | "reading" | "completed";
    lastPage: number;
    note: string;
    updatedAt: Date;
  }>();
  if (!progress) return null;
  return {
    status: progress.status,
    lastPage: progress.lastPage,
    note: progress.note,
    updatedAt: progress.updatedAt?.toISOString(),
  };
}

async function fetchAnnotations(bookId: string, userId?: string | null) {
  if (!userId) return {};
  await connectMongo();
  const docs = await BookAnnotationModel.find({ userId, bookId }).lean<
    Array<{
      page: number;
      strokes: { color: string; width: number; points: { x: number; y: number }[] }[];
    }>
  >();
  const map: Record<number, { color: string; width: number; points: { x: number; y: number }[] }[]> = {};
  for (const doc of docs) {
    map[doc.page] = doc.strokes;
  }
  return map;
}

export default async function BookDetailPage({ params }: BookPageProps) {
  const resolvedParams = await Promise.resolve(params);
  const book = await getBook(resolvedParams.bookId);
  if (!book) {
    notFound();
  }
  const user = await getCurrentUserFromCookies();
  const canAccess =
    book.isPublic || (user && (user.role === "admin" || user.id === book.createdBy));
  if (!canAccess) {
    notFound();
  }
  const progress = await fetchProgress(book.id, user?.id);
  const annotations = await fetchAnnotations(book.id, user?.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
        <Link href="/books" className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700">
          {"<-"} Kembali ke daftar buku
        </Link>
        <span className="text-xs uppercase tracking-[0.3em] text-slate-300">|</span>
        <span>
          {formatBytes(book.fileSize)} - Diunggah {formatDate(book.createdAt)}
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sedang dibaca</p>
        <h1 className="text-3xl font-semibold text-slate-900">{book.title}</h1>
        <p className="text-sm text-slate-500">{book.author || "Anonim"}</p>
        <p className="max-w-3xl text-base text-slate-600">{book.description || "Tidak ada deskripsi."}</p>
        <div className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 font-semibold ${
              book.isPublic ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {book.isPublic ? "Publik" : "Privat"}
          </span>
          {!book.isPublic && (
            <span>
              {user?.role === "admin" || user?.id === book.createdBy
                ? "Hanya terlihat oleh tim hingga diterbitkan."
                : null}
            </span>
          )}
        </div>
      </div>

      {user ? (
        <BookReadingWorkspace
          bookId={book.id}
          title={book.title}
          fileUrl={book.pdfUrl}
          initialProgress={progress}
          initialAnnotations={annotations}
        />
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-500">
          Login untuk menyimpan progres, halaman terakhir, dan catatan baca.
        </div>
      )}
    </div>
  );
}
