'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/config";
import { useToast } from "@/components/toast-provider";

type BookDeleteButtonProps = {
  bookId: string;
  bookTitle: string;
};

export default function BookDeleteButton({ bookId, bookTitle }: BookDeleteButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (loading) return;

    const confirmed = window.confirm(
      `Hapus buku "${bookTitle}"? File PDF juga akan dihapus permanent.`
    );
    if (!confirmed) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/books/${bookId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        showToast(payload?.error ?? "Gagal menghapus buku.", { variant: "error" });
        return;
      }

      showToast("Buku berhasil dihapus.", { variant: "success" });
      router.refresh();
    } catch (error) {
      console.error("Delete book failed:", error);
      showToast("Terjadi kesalahan jaringan.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center justify-center rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700 disabled:opacity-60"
    >
      {loading ? "Menghapus..." : "Hapus"}
    </button>
  );
}
