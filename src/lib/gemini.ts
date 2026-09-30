import { GoogleGenAI } from '@google/genai';

let geminiClient: GoogleGenAI | null = null;

export const GEMINI_PRIMARY_MODEL = 'gemini-3.5-flash-lite';

/** Call the configured model directly; failures are returned to the caller. */
export async function generateGeminiContent(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0]
) {
  return { response: await ai.models.generateContent(params), model: params.model };
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
