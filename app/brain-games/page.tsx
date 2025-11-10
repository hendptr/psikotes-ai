import SpeedArithmeticRush from "@/components/brain-games/speed-arithmetic-rush";
import MemoryGridRotation from "@/components/brain-games/memory-grid-rotation";
import SequenceEcho from "@/components/brain-games/sequence-echo";
import ReverseRecall from "@/components/brain-games/reverse-recall";

export const dynamic = "force-dynamic";

export default function BrainGamesPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Brain games</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Latihan otak santai</h1>
        <p className="mt-3 text-sm text-slate-600">
          Pemanasan ringan untuk menjaga fokus dan memori. Skormu disimpan lokal agar kamu bisa
          memantau progres personal.
        </p>
      </section>

      <SpeedArithmeticRush />
      <MemoryGridRotation />
      <SequenceEcho />
      <ReverseRecall />
    </div>
  );
}
