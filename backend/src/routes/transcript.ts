import { Elysia } from "elysia";
import { TranscriptBody, TranscriptResponse } from "../types";

const SPEACHES_URL = "http://localhost:8000";
const WHISPER_MODEL = "Systran/faster-distil-whisper-medium.en";

export const transcriptRoute = new Elysia().post(
  "/transcript",
  async ({ body }) => {
    // Decode base64 audio into a Blob
    const audioBuffer = Buffer.from(body.audio, "base64");
    const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });

    const form = new FormData();
    form.append("file", audioBlob, "audio.wav");
    form.append("model", WHISPER_MODEL);
    if (body.source_language && body.source_language !== "auto-detect") {
      form.append("language", body.source_language);
    }

    const res = await fetch(`${SPEACHES_URL}/v1/audio/transcriptions`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Speaches STT error ${res.status}: ${err}`);
    }

    const data = await res.json() as { text: string };

    return {
      transcript: data.text,
      detected_language: body.source_language ?? "en",
      analysis: undefined,
    } satisfies typeof TranscriptResponse.static;
  },
  {
    body: TranscriptBody,
    response: TranscriptResponse,
    detail: {
      summary: "Transcribe voice input via Whisper (Speaches Docker)",
      tags: ["Voice"],
    },
  }
);