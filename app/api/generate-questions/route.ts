import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  AnswerSnapshot,
  SessionRecord,
  SessionConfig,
  getSession,
  setSession,
} from "@/lib/session-store";

export const runtime = "nodejs";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

type Category =
  | "padanan_kata"
  | "sinonim_antonim"
  | "hafalan_kata"
  | "deret_matematika"
  | "perbandingan_senilai_berbalik"
  | "mixed";

type PsychotestQuestion = {
  category: string;
  difficulty: string;
  questionType: string;
  questionText: string;
  options: Array<{ label: string; text: string }>;
  correctOptionLabel: string;
  explanation: string;
};

type GenerateQuestionsBody = {
  category?: Category;
  difficulty?: string;
  userType?: string;
  count?: number;
  sessionId?: string;
};

type GenerateQuestionsResponse = {
  sessionId: string;
  questions: PsychotestQuestion[];
  progress: {
    answers: Record<number, AnswerSnapshot>;
    currentIndex: number;
    completed: boolean;
  };
  config: SessionConfig;
  source: "resume" | "cache" | "fresh";
};

const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes
const questionCache = new Map<
  string,
  { timestamp: number; data: PsychotestQuestion[] }
>();

function buildCategoryInstruction(category: Category): string {
  switch (category) {
    case "padanan_kata":
      return `
Jenis soal: PADANAN KATA (hubungan arti).
- Berikan pasangan kata utama, lalu beberapa pasangan kata sebagai pilihan.
- Peserta diminta memilih pasangan yang hubungan katanya PALING MIRIP dengan pasangan utama.
- Contoh gaya (jangan digunakan persis): "Dokter : Rumah Sakit = ...".
`;
    case "sinonim_antonim":
      return `
Jenis soal: SINONIM / ANTONIM.
- Berikan satu kata utama.
- Tentukan apakah soal meminta SINONIM atau ANTONIM (pilih salah satu).
- Tuliskan jelas di soal, misalnya: "Pilih SINONIM yang paling tepat untuk kata berikut".
- Sediakan 4 sampai 5 pilihan jawaban.
`;
    case "hafalan_kata":
      return `
Jenis soal: HAFALAN KATA.
- Di awal soal, tampilkan 8 sampai 12 kata acak (boleh dibagi beberapa baris).
- Setelah itu beri pertanyaan yang menguji ingatan, misalnya:
  - "Kata mana yang TIDAK ada dalam daftar di atas?"
  - atau "Pasangan kata mana yang muncul berurutan di daftar?"
- Sediakan 4 sampai 5 pilihan jawaban.
`;
    case "deret_matematika":
      return `
Jenis soal: DERET MATEMATIKA SULIT.
- Fokus pada deret yang butuh penalaran, bukan hanya pola sederhana.
- Gunakan pola campuran: aritmetika, geometri, pola selang-seling, kombinasi huruf dan angka, atau operasi berbeda di posisi ganjil/genap.
- Boleh gunakan lebih dari satu titik kosong, misalnya: 3, 6, __, 24, __, 96, ...
- Boleh pakai huruf untuk mewakili posisi (A,B,C) selama jelas.
- Pilihan jawaban harus berupa isi titik kosong yang benar (boleh satu nilai, boleh dua nilai seperti "8 dan 48").
`;
    case "perbandingan_senilai_berbalik":
      return `
Jenis soal: PERBANDINGAN SENILAI & BERBALIK NILAI (cerita).
- Setiap soal harus berupa cerita kontekstual (tokoh, objek, situasi) yang relevan dengan kehidupan sehari-hari.
- Tentukan apakah masalahnya termasuk perbandingan senilai atau berbalik nilai dan tekankan di pembahasan.
- Jika ada satuan berbeda (m, cm, liter, kg, dst.), selaraskan terlebih dahulu sebelum menghitung perbandingan.
- Untuk perbandingan senilai, gunakan proporsi langsung (misalnya jumlah barang berbanding lurus dengan harga total).
- Untuk perbandingan berbalik nilai, gunakan proporsi terbalik (misalnya waktu kerja berbanding terbalik dengan jumlah pekerja).
- Tuliskan "questionType" yang mencerminkan tipe soal, misalnya "Perbandingan Senilai" atau "Perbandingan Berbalik Nilai".
- Pastikan jawaban benar didukung perhitungan sederhana yang dijelaskan di "explanation".
`;
    case "mixed":
    default:
      return `
Kategori CAMPURAN:
- Untuk setiap soal, pilih secara acak salah satu dari:
  - padanan_kata
  - sinonim_antonim
  - hafalan_kata
  - deret_matematika (sulit)
  - perbandingan_senilai_berbalik (cerita)
- Pastikan field "category" di JSON mencerminkan kategori aktual tiap soal.
`;
  }
}

function buildModeHint(userType: string): string {
  switch (userType) {
    case "simulasi":
      return "Mode ini seperti simulasi tes kerja sungguhan. Soal boleh dibuat agak menekan waktu dan menguji konsentrasi.";
    case "serius":
      return "Mode ini fokus untuk belajar serius dan memperkuat konsep psikotes.";
    case "tantangan":
      return "Mode ini adalah mode tantangan. Tingkatkan tingkat kesulitan soal dan dorong peserta untuk berpikir cepat dengan variasi pola yang tidak terduga.";
    default:
      return "Mode ini lebih santai, tapi tetap gunakan gaya soal psikotes resmi (bukan kuis santai).";
  }
}

function buildCacheKey(config: SessionConfig) {
  return JSON.stringify([
    config.userType,
    config.category,
    config.difficulty,
    config.count,
  ]);
}

async function generateQuestions(
  prompt: string
): Promise<PsychotestQuestion[]> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            category: { type: "STRING" },
            difficulty: { type: "STRING" },
            questionType: { type: "STRING" },
            questionText: { type: "STRING" },
            options: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  label: { type: "STRING" },
                  text: { type: "STRING" },
                },
                required: ["label", "text"],
              },
            },
            correctOptionLabel: { type: "STRING" },
            explanation: { type: "STRING" },
          },
          required: [
            "category",
            "difficulty",
            "questionType",
            "questionText",
            "options",
            "correctOptionLabel",
            "explanation",
          ],
        },
      },
    },
  });

  const jsonText = response.text;
  if (!jsonText) {
    throw new Error("Respons kosong dari Gemini.");
  }

  const parsed = JSON.parse(jsonText) as PsychotestQuestion[];
  if (!Array.isArray(parsed)) {
    throw new Error("Format respons Gemini tidak sesuai.");
  }

  return parsed;
}

function buildPrompt(
  config: SessionConfig,
  categoryInstruction: string,
  modeHint: string
) {
  return `
Kamu adalah generator soal psikotes kerja di Indonesia.

Mode latihan: ${config.userType}.
${modeHint}

Jumlah soal yang HARUS kamu buat: ${config.count} soal.
Kategori: ${config.category}.
Tingkat kesulitan keseluruhan: ${config.difficulty}.

${categoryInstruction}

Aturan umum setiap soal:
- Harus terasa seperti soal psikotes resmi (rekrutmen perusahaan).
- Gunakan bahasa Indonesia yang baku atau semi-baku, jelas, dan rapi.
- Selalu sediakan 4 atau 5 pilihan jawaban berlabel "A", "B", "C", "D" dan jika perlu "E".
- HANYA ada satu jawaban yang benar.
- "questionText" cukup ringkas tetapi jelas.
- "explanation" jelaskan:
  - Kenapa jawaban yang benar itu benar.
  - Kenapa pilihan lainnya salah atau kurang tepat.

Return hasil sebagai ARRAY JSON dengan PERSIS ${config.count} objek, TANPA teks lain di luar JSON.

Format tiap item:

{
  "category": string,
  "difficulty": string,
  "questionType": string,
  "questionText": string,
  "options": [
    { "label": "A", "text": string },
    { "label": "B", "text": string },
    ...
  ],
  "correctOptionLabel": string,
  "explanation": string
}
`;
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY belum di-set di environment." },
      { status: 500 }
    );
  }

  let body: GenerateQuestionsBody;
  try {
    body = (await req.json()) as GenerateQuestionsBody;
  } catch {
    return NextResponse.json(
      { error: "Payload tidak valid." },
      { status: 400 }
    );
  }

  const category: Category = body.category ?? "mixed";
  const difficulty: string = body.difficulty ?? "sulit";
  const userType: string = body.userType ?? "santai";

  let count: number = Number(body.count ?? 10);
  if (Number.isNaN(count)) count = 10;
  count = Math.max(1, Math.min(50, count));

  const config: SessionConfig = {
    category,
    difficulty,
    userType,
    count,
  };

  if (body.sessionId) {
    const existing = await getSession(body.sessionId);
    if (existing) {
      return NextResponse.json<GenerateQuestionsResponse>({
        sessionId: existing.sessionId,
        questions: existing.questions as PsychotestQuestion[],
        progress: {
          answers: existing.answers,
          currentIndex: existing.currentIndex,
          completed: existing.completed,
        },
        config: existing.config,
        source: "resume",
      });
    }
  }

  const cacheKey = buildCacheKey(config);
  const cached = questionCache.get(cacheKey);
  let questions: PsychotestQuestion[];
  let source: "cache" | "fresh" = "fresh";

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    questions = cached.data;
    source = "cache";
  } else {
    try {
      questions = await generateQuestions(
        buildPrompt(config, buildCategoryInstruction(category), buildModeHint(userType))
      );
      questionCache.set(cacheKey, { timestamp: Date.now(), data: questions });
    } catch (error: unknown) {
      console.error("Gemini error:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Gagal generate soal dari Gemini.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const sessionId = randomUUID();

  const sessionRecord: SessionRecord = {
    sessionId,
    questions,
    answers: {},
    currentIndex: 0,
    completed: false,
    config,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };

  await setSession(sessionRecord);

  return NextResponse.json<GenerateQuestionsResponse>({
    sessionId,
    questions,
    progress: {
      answers: {},
      currentIndex: 0,
      completed: false,
    },
    config,
    source,
  });
}
