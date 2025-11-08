'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";
import { API_BASE } from "@/lib/config";

type StartPublicSessionButtonProps = {
  publicId: string;
  className?: string;
};

export default function StartPublicSessionButton({
  publicId,
  className,
}: StartPublicSessionButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      const response = await fetch(API_BASE + '/public-sessions/' + publicId + '/start', {
        method: 'POST',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.sessionId) {
        throw new Error(payload?.error ?? 'Tidak dapat memulai sesi.');
      }
      router.push('/test/' + payload.sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memulai sesi.';
      window.alert(message);
    } finally {
      setLoading(false);
    }
  }

  const classes = [
    'inline-flex',
    'items-center',
    'justify-center',
    'rounded-full',
    'bg-slate-900',
    'px-4',
    'py-2',
    'text-sm',
    'font-semibold',
    'text-white',
    'transition',
    'hover:bg-slate-800',
    'disabled:opacity-60',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-slate-400',
  ];

  if (className) {
    classes.push(className);
  }

  return (
    <button
      type="button"
      onClick={handleStart}
      disabled={loading}
      className={classes.join(' ')}
    >
      {loading ? 'Menyiapkan...' : 'Mulai sesi ini'}
    </button>
  );
}
