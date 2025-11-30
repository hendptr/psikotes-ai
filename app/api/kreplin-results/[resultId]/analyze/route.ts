import { NextResponse, type NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getCurrentUser } from "@/lib/auth";
import { getKreplinResult, saveKreplinAnalysis } from "@/lib/kreplin";

function resolveApiKeys(): string[] {
  const raw =
    process.env.GEMINI_API_KEYS ??
    process.env.GEMINI_API_KEY ??
    "";
  return raw
    .split(/[,|\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveModels(): string[] {
  const raw = process.env.GEMINI_MODELS;
  if (!raw) return ["models/gemini-2.5-pro", "models/gemini-2.5-flash"];
  const parsed = raw
    .split(/[,|\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
  return parsed.length ? parsed : ["models/gemini-2.5-pro", "models/gemini-2.5-flash"];
}

async function analyzeWithGemini(prompt: string) {
  const apiKeys = resolveApiKeys();
  if (!apiKeys.length) {
    throw new Error("Gemini API key is not configured.");
  }
  const models = resolveModels();
  let lastError: unknown = null;

  for (const key of apiKeys) {
    for (const modelName of models) {
      try {
        const client = new GoogleGenerativeAI(key);
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.6,
          },
        });
        const response = await model.generateContent(prompt);
        const text = response.response.text();
        if (!text) {
          throw new Error("Model tidak mengembalikan analisis.");
        }
        return { text, model: modelName };
      } catch (error) {
        lastError = error;
        console.error("[Gemini][kreplin-analysis] error", error);
      }
    }
  }

  const reason = lastError instanceof Error ? lastError.message : "Model gagal dipanggil.";
  throw new Error(reason);
}

function buildPrompt(data: {
  mode: string;
  durationSeconds: number;
  totalAnswered: number;
  totalCorrect: number;
  totalIncorrect: number;
  accuracy: number;
  perSectionStats: { index: number; correct: number; total: number }[];
  speedTimeline: { index: number; correct: number; total: number }[];
}) {
  const sectionSummary = data.perSectionStats
    .map((s) => `Kolom ${s.index}: ${s.correct}/${s.total}`)
    .join("; ");
  const speedSummary = data.speedTimeline
    .map((b) => `Menit ${b.index + 1}: ${b.correct}/${b.total}`)
    .join("; ");

  const perMinuteAccuracies = data.speedTimeline
    .map((b) => ({
      minute: b.index + 1,
      acc: b.total > 0 ? (b.correct / b.total) * 100 : null,
      volume: b.total,
    }))
    .filter((item) => item.acc != null) as { minute: number; acc: number; volume: number }[];

  const avgAcc =
    perMinuteAccuracies.reduce((sum, item) => sum + item.acc, 0) /
    (perMinuteAccuracies.length || 1);
  const firstHalfAcc =
    perMinuteAccuracies
      .filter((item) => item.minute <= perMinuteAccuracies.length / 2)
      .reduce((sum, item) => sum + item.acc, 0) /
      (Math.max(1, perMinuteAccuracies.filter((item) => item.minute <= perMinuteAccuracies.length / 2).length));
  const secondHalfAcc =
    perMinuteAccuracies
      .filter((item) => item.minute > perMinuteAccuracies.length / 2)
      .reduce((sum, item) => sum + item.acc, 0) /
      (Math.max(1, perMinuteAccuracies.filter((item) => item.minute > perMinuteAccuracies.length / 2).length));
  const best = perMinuteAccuracies.reduce(
    (prev, item) => (item.acc > prev.acc ? item : prev),
    { minute: 0, acc: -Infinity, volume: 0 }
  );
  const worst = perMinuteAccuracies.reduce(
    (prev, item) => (item.acc < prev.acc ? item : prev),
    { minute: 0, acc: Infinity, volume: 0 }
  );

  const sectionAccuracies = data.perSectionStats
    .map((s) => ({
      section: s.index,
      acc: s.total > 0 ? (s.correct / s.total) * 100 : null,
      volume: s.total,
      correct: s.correct,
    }))
    .filter((item) => item.acc != null) as { section: number; acc: number; volume: number; correct: number }[];

  const sectionAvg =
    sectionAccuracies.reduce((sum, item) => sum + item.acc, 0) /
    (sectionAccuracies.length || 1);
  const sectionBest = sectionAccuracies.reduce(
    (prev, item) => (item.acc > prev.acc ? item : prev),
    { section: 0, acc: -Infinity, volume: 0, correct: 0 }
  );
  const sectionWorst = sectionAccuracies.reduce(
    (prev, item) => (item.acc < prev.acc ? item : prev),
    { section: 0, acc: Infinity, volume: 0, correct: 0 }
  );

  const startAcc = perMinuteAccuracies[0]?.acc ?? null;
  const endAcc = perMinuteAccuracies[perMinuteAccuracies.length - 1]?.acc ?? null;

  return `
Anda adalah psikolog industri dan organisasi yang menilai hasil Tes Koran/Kraepelin untuk seleksi karyawan.
Berikan analisis ringkas (maks 160 kata) dalam bahasa Indonesia, dengan fokus pada ketahanan, konsistensi ritme, dan akurasi.
Gunakan format:
- Ringkasan
- Ketahanan & ritme (sertakan data numerik tren per menit)
- Kesalahan & risiko (cantumkan menit/kolom terburuk)
- Rekomendasi latihan (spesifik dan terukur)
- Keputusan singkat (fit / perlu latihan / tidak disarankan)

Data numerik:
- Mode: ${data.mode}
- Durasi: ${Math.round(data.durationSeconds / 60)} menit
- Total dijawab: ${data.totalAnswered}
- Benar: ${data.totalCorrect}, Salah: ${data.totalIncorrect}, Akurasi: ${data.accuracy.toFixed(1)}%
- Rata-rata akurasi per menit: ${avgAcc.toFixed(1)}%
- Paruh pertama vs kedua: ${firstHalfAcc.toFixed(1)}% vs ${secondHalfAcc.toFixed(1)}%
- Menit terbaik: ${best.minute} (${best.acc.toFixed(1)}%, ${best.volume} soal), terburuk: ${worst.minute} (${worst.acc.toFixed(1)}%, ${worst.volume} soal)
- Tren awal-akhir: ${startAcc != null && endAcc != null ? `${startAcc.toFixed(1)}% -> ${endAcc.toFixed(1)}%` : "tidak tersedia"}
- Rata akurasi per kolom: ${sectionAvg.toFixed(1)}% | Kolom terbaik: ${sectionBest.section} (${sectionBest.acc.toFixed(1)}%, ${sectionBest.correct}/${sectionBest.volume}) | Terburuk: ${sectionWorst.section} (${sectionWorst.acc.toFixed(1)}%, ${sectionWorst.correct}/${sectionWorst.volume})
- Benar per kolom (raw): ${sectionSummary || "tidak tersedia"}
- Benar per menit (speed timeline): ${speedSummary || "tidak tersedia"}

Berikan interpretasi kuantitatif (misal delta akurasi awal-akhir, tren turun/naik), lalu simpulkan implikasi ketahanan & fokus kerja.
`;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ resultId: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { resultId } = await context.params;

  const result = await getKreplinResult(user.id, resultId);
  if (!result) {
    return NextResponse.json({ error: "Hasil tidak ditemukan." }, { status: 404 });
  }

  if (result.aiAnalysis?.text) {
    return NextResponse.json({ error: "Analisis sudah pernah dibuat." }, { status: 400 });
  }

  try {
    const prompt = buildPrompt(result);
    const { text, model } = await analyzeWithGemini(prompt);
    const saved = await saveKreplinAnalysis(user.id, resultId, { text, model });
    if (!saved) {
      return NextResponse.json({ error: "Analisis sudah pernah dibuat." }, { status: 400 });
    }
    return NextResponse.json({ aiAnalysis: saved.aiAnalysis });
  } catch (error) {
    console.error("Kreplin analysis error:", error);
    return NextResponse.json(
      { error: "Gagal membuat analisis AI. Coba lagi nanti." },
      { status: 500 }
    );
  }
}
