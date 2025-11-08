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

export async function generatePsychotestQuestions(
  params: GenerationParams
): Promise<PsychotestQuestion[]> {
  const apiKeys = resolveApiKeys();
  if (!apiKeys.length) {
    throw new GeminiUnavailableError("Gemini API key is not configured.");
  }

  const modelCandidates = ["models/gemini-2.5-pro"];
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
        const parsed = questionArraySchema.parse(JSON.parse(text));
        if (parsed.length) {
          return parsed
            .slice(0, params.count)
            .map((item) => ({
              ...item,
              options: item.options.map<QuestionOption>((option) => ({
                label: option.label,
                text: option.text,
              })),
            })) as PsychotestQuestion[];
        }
      } catch (error) {
        lastError = error;
        console.error(
          `Gemini generation error for key ****${apiKey.slice(-4)} model ${modelName}, trying next key/model:`,
          error
        );
      }
    }
  }

  throw new GeminiUnavailableError(
    "Layanan Gemini sedang penuh. Coba lagi dalam beberapa saat.",
    lastError
  );
}
