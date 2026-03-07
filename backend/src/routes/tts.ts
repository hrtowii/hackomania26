import { Elysia } from "elysia";
import { TtsBody, TtsResponse } from "../types";

export const ttsRoute = new Elysia().post(
  "/text-to-speech",
  async ({ body }) => {
    // TODO: call TTS service (e.g. ElevenLabs, Google TTS, or local model)
    const stub: typeof TtsResponse.static = {
      audio_url: `https://example.com/tts/stub.mp3`,
      duration_seconds: undefined,
    };
    void body; // suppress unused warning until implemented
    return stub;
  },
  {
    body: TtsBody,
    response: TtsResponse,
    detail: {
      summary: "Convert text to speech in Singlish or another supported language",
      tags: ["Voice"],
    },
  }
);
