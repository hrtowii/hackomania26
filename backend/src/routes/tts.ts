import { Elysia } from "elysia";
import { TtsBody, TtsResponse } from "../types";

const SPEACHES_URL = "http://localhost:8000";
const KOKORO_MODEL = "speaches-ai/Kokoro-82M-v1.0-ONNX";

// language codes -> Kokoro voice IDs
const VOICE_MAP: Record<string, string> = {
  en:       "af_heart",   // English (warm female)
  zh:       "zf_xiaobei", // Chinese female
  ms:       "af_heart",   // Malay — fallback to English voice
  ta:       "af_heart",   // Tamil — fallback to English voice
  singlish: "af_heart",
};

export const ttsRoute = new Elysia().post(
  "/text-to-speech",
  async ({ body }) => {
    const voice = VOICE_MAP[body.voice ?? "en"] ?? "af_heart";

    const res = await fetch(`${SPEACHES_URL}/v1/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: KOKORO_MODEL,
        voice,
        input: body.text,
        response_format: "mp3",
        speed: body.speed ?? 1.0,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Speaches TTS error ${res.status}: ${err}`);
    }

    // Convert audio bytes to base64 data URL so frontend can play it directly
    const audioBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString("base64");
    const audio_url = `data:audio/mp3;base64,${base64}`;

    return { audio_url } satisfies typeof TtsResponse.static;
  },
  {
    body: TtsBody,
    response: TtsResponse,
    detail: {
      summary: "Text-to-speech via Kokoro (Speaches Docker)",
      tags: ["Voice"],
    },
  }
);