import { Elysia } from "elysia";
import { TranscriptBody, TranscriptResponse } from "../types";

export const transcriptRoute = new Elysia().post(
  "/transcript",
  async ({ body }) => {
    // TODO: decode base64 audio, run Whisper / multilingual ASR
    const stub: typeof TranscriptResponse.static = {
      transcript: "Stub transcript — audio processing not yet implemented.",
      detected_language: body.source_language ?? "en",
      analysis: undefined,
    };
    return stub;
  },
  {
    body: TranscriptBody,
    response: TranscriptResponse,
    detail: {
      summary: "Transcribe voice input (Singlish / multilingual) and optionally analyze",
      tags: ["Voice"],
    },
  }
);
