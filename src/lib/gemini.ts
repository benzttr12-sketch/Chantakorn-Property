import { GoogleGenAI } from '@google/genai';

let geminiClient: GoogleGenAI | null = null;

export const GEMINI_PRIMARY_MODEL = 'gemini-3.8-flash';
export const GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash-lite';

function isTemporaryGeminiError(error: unknown): boolean {
  const apiError = error as { status?: number | string; message?: string };
  if (typeof apiError?.status === 'number') {
    return [429, 500, 502, 503, 504].includes(apiError.status);
  }

  return /\b(429|500|502|503|504|RESOURCE_EXHAUSTED|UNAVAILABLE)\b/i.test(
    String(apiError?.message || apiError?.status || '')
  );
}

/** Keep Gemini responses available when the primary model is temporarily busy. */
export async function generateGeminiContent(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0]
) {
  try {
    return { response: await ai.models.generateContent(params), model: params.model };
  } catch (error) {
    if (params.model !== GEMINI_PRIMARY_MODEL || !isTemporaryGeminiError(error)) {
      throw error;
    }

    return {
      response: await ai.models.generateContent({ ...params, model: GEMINI_FALLBACK_MODEL }),
      model: GEMINI_FALLBACK_MODEL,
    };
  }
}

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  return geminiClient;
}
