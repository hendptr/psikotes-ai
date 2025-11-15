import Link from "next/link";
import { connectMongo } from "@/lib/MongoDB";
import { BookModel, type BookDocument } from "@/lib/models";
import { getCurrentUserFromCookies } from "@/lib/auth";
import { BASE_PATH } from "@/lib/config";
import BookUploadForm from "@/components/book-upload-form";
import PdfThumbnail from "@/components/pdf-thumbnail";

export const revalidate = 0;

type BookListItem = Pick<
  BookDocument,
  "id" | "title" | "author" | "description" | "pdfUrl" | "fileSize"
> & { createdAt: string };

async function fetchBooks(): Promise<BookListItem[]> {
  await connectMongo();
  const docs = await BookModel.find()
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
      }>
    >();

  return docs.map((doc) => ({
    id: doc._id,
    title: doc.title,
    author: doc.author,
    description: doc.description,
    pdfUrl: `${BASE_PATH}${doc.pdfUrl}`,
    fileSize: doc.fileSize,
    createdAt: doc.createdAt?.toISOString?.() ?? new Date().toISOString(),
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

export default async function BooksPage() {
  const [user, books] = await Promise.all([getCurrentUserFromCookies(), fetchBooks()]);

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-slate-50 p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-sky-600">Perpustakaan Winnieee!</p>
            <h1 className="text-3xl font-semibold text-slate-900">Baca Buku Digital Untuk Winnie yang Paling Cantik!</h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Semua PDF yang diunggah akan langsung tersedia untuk seluruh pengguna.
            </p>
            <ul className="text-sm text-slate-500">
              <li>- Unggah file PDF hingga 100MB.</li>
              <li>- Siap dibaca lewat penampil PDF yang nyaman.</li>
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
                <PdfThumbnail fileUrl={book.pdfUrl} title={book.title} />
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold text-slate-900">{book.title}</h3>
                    <span className="text-xs text-slate-400">{formatBytes(book.fileSize)}</span>
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
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
