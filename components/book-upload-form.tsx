'use client';

import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/config";
import { useToast } from "@/components/toast-provider";

type BookUploadFormProps = {
  canUpload: boolean;
};

export default function BookUploadForm({ canUpload }: BookUploadFormProps) {
  const router = useRouter();
  const formId = useId();
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [chosenFile, setChosenFile] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUpload || uploading) {
      return;
    }

    const form = event.currentTarget;
    const fileInput = form.querySelector<HTMLInputElement>('input[type="file"][name="file"]');
    const file = fileInput?.files?.[0];
    if (!file) {
      showToast("Pilih file PDF terlebih dahulu.", { variant: "error" });
      return;
    }

    if (!file.type.toLowerCase().includes("pdf")) {
      showToast("File harus berformat PDF.", { variant: "error" });
      return;
    }

    const formData = new FormData(form);
    setUploading(true);
    try {
      const response = await fetch(`${API_BASE}/books`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error ?? "Gagal mengunggah buku.";
        showToast(message, { variant: "error" });
        return;
      }

      form.reset();
      setChosenFile(null);
      showToast("Buku berhasil diunggah!", { variant: "success" });
      router.refresh();
    } catch (error) {
      console.error("Upload book failed", error);
      showToast("Terjadi kesalahan jaringan.", { variant: "error" });
    } finally {
      setUploading(false);
    }
  };

  if (!canUpload) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        Login terlebih dahulu untuk mengunggah buku favoritmu. Semua buku yang diunggah akan
        otomatis tersedia untuk semua pengguna.
      </div>
    );
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Judul Buku
          <input
            required
            name="title"
            maxLength={160}
            placeholder="mis. Psikotes Pintar"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Penulis/Pemilik
          <input
            name="author"
            maxLength={120}
            placeholder="Opsional"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </label>
      </div>

      <label className="text-sm font-semibold text-slate-700">
        Deskripsi Singkat
        <textarea
          name="description"
          maxLength={2000}
          rows={3}
          placeholder="Catatan atau highlight penting dari buku ini..."
          className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
        />
      </label>

      <div className="flex flex-col gap-2 text-sm font-semibold text-slate-700 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex-1">
          File PDF
          <input
            type="file"
            name="file"
            accept="application/pdf"
            required
            disabled={uploading}
            onChange={(event) => {
              const nextFile = event.target.files?.[0];
              setChosenFile(nextFile ? nextFile.name : null);
            }}
            className="mt-1 block w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-sky-700 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed"
          />
        </label>
        {chosenFile && (
          <span className="text-xs font-normal text-slate-500 sm:w-48 sm:text-right">
            File dipilih: {chosenFile}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <p>Maksimal 35MB, format PDF saja.</p>
        <button
          type="submit"
          disabled={uploading}
          className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200 disabled:opacity-70"
        >
          {uploading ? "Mengunggah..." : "Unggah Buku"}
        </button>
      </div>
    </form>
  );
}
