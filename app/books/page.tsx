import Link from "next/link";
import { connectMongo } from "@/lib/MongoDB";
import { BookModel, BookProgressModel, type BookDocument } from "@/lib/models";
import { getCurrentUserFromCookies } from "@/lib/auth";
import { BASE_PATH } from "@/lib/config";
import BookUploadForm from "@/components/book-upload-form";
import PdfThumbnail from "@/components/pdf-thumbnail";
import BookDeleteButton from "@/components/book-delete-button";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type BookListItem = Pick<
  BookDocument,
  "id" | "title" | "author" | "description" | "fileSize"
> & {
  createdAt: string;
  createdBy: string | null;
  pdfUrl: string;
  isPublic: boolean;
  progress?: {
    status: string;
    lastPage: number;
  } | null;
  coverImageUrl?: string | null;
};

async function fetchBooks(
  userId?: string | null,
  role: "user" | "admin" = "user"
): Promise<BookListItem[]> {
  await connectMongo();
  const visibilityFilter =
    role === "admin"
      ? {}
      : userId
      ? { $or: [{ isPublic: { $ne: false } }, { createdBy: userId }] }
      : { isPublic: { $ne: false } };
  const [docs, progresses] = await Promise.all([
    BookModel.find(visibilityFilter)
      .sort({ createdAt: -1 })
      .lean<
        Array<{
          _id: string;
          title: string;
          author: string;
          description: string;
          pdfUrl: string;
          fileSize: number;
          createdAt: Date;
          createdBy?: string | null;
          coverImageUrl?: string | null;
          isPublic?: boolean;
        }>
      >(),
    userId
      ? BookProgressModel.find({ userId })
          .lean<Array<{ bookId: string; status: string; lastPage: number }>>()
      : Promise.resolve([]),
  ]);

  const progressMap = new Map(progresses.map((item) => [item.bookId, { status: item.status, lastPage: item.lastPage }]));

  return docs.map((doc) => ({
    id: doc._id,
    title: doc.title,
    author: doc.author,
    description: doc.description,
    pdfUrl: `${BASE_PATH}/api/books/${doc._id}/file`,
    fileSize: doc.fileSize,
    createdAt: doc.createdAt?.toISOString?.() ?? new Date().toISOString(),
    createdBy: doc.createdBy ?? null,
    isPublic: doc.isPublic !== false,
    progress: progressMap.get(doc._id) ?? null,
    coverImageUrl: doc.coverImageUrl ?? null,
  }));
}

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

function formatDate(value: string) {
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return value;
  }
}

function progressLabel(progress?: BookListItem["progress"]) {
  if (!progress) return "Belum dimulai";
  if (progress.status === "completed") return "Selesai dibaca";
  if (progress.status === "reading") return `Sedang dibaca - Hal ${progress.lastPage}`;
  return "Belum dimulai";
}

export default async function BooksPage() {
  const user = await getCurrentUserFromCookies();
  const books = await fetchBooks(user?.id ?? null, user?.role ?? "user");

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-slate-50 p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-sky-600">Perpustakaan digital</p>
            <h1 className="text-3xl font-semibold text-slate-900">Referensi psikotes siap pakai</h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Semua PDF yang diunggah akan tersedia bagi seluruh pengguna sehingga tim belajar dari sumber yang sama.
            </p>
            <ul className="text-sm text-slate-500">
              <li>- Unggah file PDF hingga 100MB secara aman.</li>
              <li>- Baca langsung lewat workspace anotasi interaktif.</li>
            </ul>
          </div>
          <BookUploadForm canUpload={Boolean(user)} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Koleksi terbaru</p>
            <h2 className="text-2xl font-semibold text-slate-900">Rak Digital</h2>
          </div>
          <span className="text-sm text-slate-500">{books.length} buku tersedia</span>
        </div>

        {books.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500">
            Belum ada buku yang diunggah. Yuk jadi yang pertama mengisi perpustakaan publik ini!
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {books.map((book) => (
              <article
                key={book.id}
                className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-sm transition hover:-translate-y-1 hover:border-sky-100 hover:shadow-lg"
              >
                <PdfThumbnail
                  bookId={book.id}
                  fileUrl={book.pdfUrl}
                  title={book.title}
                  coverUrl={book.coverImageUrl ? `${BASE_PATH}${book.coverImageUrl}` : undefined}
                />
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold text-slate-900">{book.title}</h3>
                    <span className="text-xs text-slate-400">{formatBytes(book.fileSize)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-600">
                      {progressLabel(book.progress)}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        book.isPublic
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {book.isPublic ? "Publik" : "Privat"}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    {book.author || "Anonim"} - Diunggah {formatDate(book.createdAt)}
                  </p>
                  <p
                    className="text-sm text-slate-600"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {book.description?.trim() || "Tidak ada deskripsi tambahan."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Link
                    href={`/books/${book.id}`}
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-sky-600 px-4 py-2 font-semibold text-white transition hover:bg-sky-500"
                  >
                    Baca Sekarang
                  </Link>
                  <a
                    href={book.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 font-semibold text-slate-700 transition hover:border-slate-300"
                  >
                    Unduh
                  </a>
                  {user && (user.id === book.createdBy || user.role === "admin") && (
                    <BookDeleteButton bookId={book.id} bookTitle={book.title} />
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

