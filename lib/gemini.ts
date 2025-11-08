import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import type { PsychotestQuestion, QuestionOption } from "./models";

const questionSchema = z.object({
  category: z.string(),
  difficulty: z.string(),
  questionType: z.string(),
  questionText: z.string(),
  options: z
    .array(
      z.object({
        label: z.string(),
        text: z.string(),
      })
    )
    .min(2),
  correctOptionLabel: z.string(),
  explanation: z.string(),
});

const questionArraySchema = z.array(questionSchema);
const chunkSizeRaw = process.env.GEMINI_CHUNK_SIZE?.trim();
const chunkSizeNumber = chunkSizeRaw ? Number(chunkSizeRaw) : NaN;
const DEFAULT_CHUNK_SIZE = Math.max(
  1,
  Number.isFinite(chunkSizeNumber) && chunkSizeNumber > 0 ? chunkSizeNumber : 10
);
const MAX_CHUNK_ATTEMPTS = Math.max(
  1,
  Number(
    process.env.GEMINI_CHUNK_ATTEMPTS?.trim() ?? 3
  )
);

const CATEGORY_INSTRUCTIONS: Record<string, string> = {
  perbandingan_senilai_berbalik: `
Jenis soal: PERBANDINGAN SENILAI & BERBALIK NILAI (cerita).
- Setiap soal wajib berupa cerita kontekstual yang relevan dengan keseharian (tokoh, objek, situasi).
- Jelaskan apakah kasus termasuk perbandingan senilai atau berbalik nilai dan tekankan di explanation.
- Selaraskan satuan terlebih dahulu (misal meter ke sentimeter, liter ke mililiter) sebelum menghitung perbandingan.
- Gunakan proporsi langsung untuk kasus perbandingan senilai (variabel bertambah seiring).
- Gunakan proporsi terbalik untuk kasus perbandingan berbalik nilai (satu variabel naik, lainnya turun).
- Field "questionType" harus eksplisit menyebut jenisnya, misalnya "Perbandingan Senilai" atau "Perbandingan Berbalik Nilai".
- Explanation harus memuat perhitungan sederhana yang mendukung jawaban benar.
`.trim(),
};

export class GeminiUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "GeminiUnavailableError";
  }
}

export type GenerationParams = {
  userType: string;
  category: string;
  difficulty: string;
  count: number;
};

function buildPrompt(params: GenerationParams) {
  const categoryHint = CATEGORY_INSTRUCTIONS[params.category];

  return `
Anda adalah asisten yang membuat soal latihan psikotes bergaya Bappenas.
Kembalikan array JSON murni tanpa teks lain.
Schema tiap item:
{
  "category": string,
  "difficulty": string,
  "questionType": string,
  "questionText": string,
  "options": [{ "label": string, "text": string }],
  "correctOptionLabel": string,
  "explanation": string
}

Konteks:
- userType: ${params.userType}
- category: ${params.category}
- difficulty: ${params.difficulty}
- jumlah soal: ${params.count}

Ketentuan:
- Tulis pertanyaan dan opsi dalam bahasa Indonesia ringkas.
- Gunakan label opsi huruf kapital A-D.
- Explanation harus berisi pembahasan singkat.
- Jangan bungkus JSON dalam blok kode atau penjelasan.
${categoryHint ? `\nFokus kategori:\n${categoryHint}\n` : ""}
`;
}

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
  if (!raw) {
    return ["models/gemini-2.5-pro", "models/gemini-2.5-flash"];
  }
  const parsed = raw
    .split(/[,|\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
  return parsed.length ? parsed : ["models/gemini-2.5-pro", "models/gemini-2.5-flash"];
}

async function requestQuestionsWithFallback(
  params: GenerationParams,
  apiKeys: string[],
  modelCandidates: string[],
  chunkLabel: string
): Promise<PsychotestQuestion[]> {
  let lastError: unknown = null;

  for (const apiKey of apiKeys) {
    for (const modelName of modelCandidates) {
      try {
        const client = new GoogleGenerativeAI(apiKey);
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
          },
        });

        const response = await model.generateContent(buildPrompt(params));
        const text = response.response.text();
        const questions = normalizeQuestionsFromText(text, chunkLabel, modelName);

        return questions.slice(0, params.count).map((item) => ({
          ...item,
          options: item.options.map<QuestionOption>((option) => ({
            label: option.label,
            text: option.text,
          })),
        })) as PsychotestQuestion[];
      } catch (error) {
        lastError = error;
        console.error(
          `[Gemini][${chunkLabel}] error key ****${apiKey.slice(-4)} model ${modelName}, mencoba opsi berikutnya:`,
          error
        );
      }
    }
  }

  const reason =
    lastError instanceof Error ? lastError.message : "Model tidak merespons.";
  throw new GeminiUnavailableError(`[${chunkLabel}] ${reason}`, lastError);
}

export async function generatePsychotestQuestions(
  params: GenerationParams
): Promise<PsychotestQuestion[]> {
  const apiKeys = resolveApiKeys();
  if (!apiKeys.length) {
    throw new GeminiUnavailableError("Gemini API key is not configured.");
  }

  const modelCandidates = resolveModels();
  const chunkSize = Math.max(1, Math.min(DEFAULT_CHUNK_SIZE, params.count));
  const results: PsychotestQuestion[] = [];
  let chunkIndex = 0;

  while (results.length < params.count) {
    const remaining = params.count - results.length;
    const batchSize = Math.min(chunkSize, remaining);
    chunkIndex += 1;
    const chunkLabel = `chunk-${chunkIndex}`;
    const chunkParams: GenerationParams = {
      ...params,
      count: batchSize,
    };

    let chunk: PsychotestQuestion[] | null = null;
    let attempts = 0;
    while (!chunk && attempts < MAX_CHUNK_ATTEMPTS) {
      attempts += 1;
      try {
        chunk = await requestQuestionsWithFallback(
          chunkParams,
          apiKeys,
          modelCandidates,
          `${chunkLabel}-try${attempts}`
        );
      } catch (error) {
        if (attempts >= MAX_CHUNK_ATTEMPTS) {
          throw error;
        }
        console.warn(`[Gemini][${chunkLabel}] percobaan ${attempts} gagal:`, error);
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * attempts)
        );
      }
    }

    if (!chunk) {
      throw new GeminiUnavailableError(`[${chunkLabel}] tidak bisa mendapatkan soal.`, null);
    }

    results.push(...chunk);
  }

  return results.slice(0, params.count);
}

function normalizeQuestionsFromText(
  text: string | undefined,
  chunkLabel: string,
  modelName: string
) {
  if (!text?.trim()) {
    throw new Error(`[${chunkLabel}] Model ${modelName} mengembalikan respon kosong.`);
  }

  const trimmed = text.trim();
  let parsedSource = trimmed;

  // attempt to extract JSON array between first '[' and last ']'
  if (!(trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    const firstBracket = trimmed.indexOf("[");
    const lastBracket = trimmed.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      parsedSource = trimmed.slice(firstBracket, lastBracket + 1);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(parsedSource);
  } catch (parseError) {
    console.error(
      `[Gemini][${chunkLabel}] JSON.parse gagal untuk model ${modelName}. Cuplikan:`,
      trimmed.slice(0, 2000)
    );
    throw new Error(`[${chunkLabel}] Respon AI tidak valid (JSON gagal di-parse).`);
  }

  const questions = questionArraySchema.parse(parsed);
  if (!questions.length) {
    throw new Error(`[${chunkLabel}] Respon AI tidak berisi soal.`);
  }
  return questions;
}
