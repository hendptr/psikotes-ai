import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connectMongo } from "@/lib/MongoDB";
import { BookModel, type BookDocument } from "@/lib/models";
import { BASE_PATH } from "@/lib/config";
import BookReader from "@/components/book-reader";

export const revalidate = 0;

type BookDetail = Pick<
  BookDocument,
  "id" | "title" | "author" | "description" | "fileSize" | "createdAt"
> & { pdfUrl: string };

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
      title: "Buku tidak ditemukan - Perpustakaan Winnie",
    };
  }
  return {
    title: `${book.title} - Perpustakaan Winnie`,
    description: book.description || "Baca buku digital langsung dari perpustakaan publik Winnie.",
  };
}

export default async function BookDetailPage({ params }: BookPageProps) {
  const resolvedParams = await Promise.resolve(params);
  const book = await getBook(resolvedParams.bookId);
  if (!book) {
    notFound();
  }

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
      </div>

      <BookReader fileUrl={book.pdfUrl} title={book.title} />
    </div>
  );
}
