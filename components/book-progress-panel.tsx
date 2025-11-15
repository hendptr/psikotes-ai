'use client';

type ProgressState = {
  status: "not_started" | "reading" | "completed";
  lastPage: number;
  note: string;
  updatedAt?: string;
};

type BookProgressPanelProps = {
  value: ProgressState;
  onChange: (value: ProgressState) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  autoSaving?: boolean;
};

const STATUS_OPTIONS = [
  { value: "not_started", label: "Belum dimulai" },
  { value: "reading", label: "Sedang dibaca" },
  { value: "completed", label: "Sudah selesai" },
];

export default function BookProgressPanel({
  value,
  onChange,
  onSubmit,
  saving,
  autoSaving,
}: BookProgressPanelProps) {
  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-sm">
      <div className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Status</label>
          <select
            value={value.status}
            onChange={(event) =>
              onChange({ ...value, status: event.target.value as ProgressState["status"] })
            }
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-sky-300 focus:outline-none"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Halaman terakhir
          <input
            type="number"
            min={1}
            max={10000}
            value={value.lastPage}
            onChange={(event) => onChange({ ...value, lastPage: Number(event.target.value) })}
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-sky-300 focus:outline-none"
          />
        </label>

        <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Catatan / komentar
          <textarea
            value={value.note}
            onChange={(event) => onChange({ ...value, note: event.target.value })}
            rows={3}
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-sky-300 focus:outline-none"
            placeholder="Catatan penting atau highlight dari buku ini..."
          />
        </label>

        {value.updatedAt && (
          <p className="text-xs text-slate-400">
            Terakhir diperbarui {new Date(value.updatedAt).toLocaleString("id-ID")}
          </p>
        )}
        {autoSaving && <p className="text-xs text-slate-400">Menyimpan otomatis...</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
        >
          {saving ? "Menyimpan..." : "Simpan progres"}
        </button>
      </div>
    </form>
  );
}
