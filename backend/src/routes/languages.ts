import { Elysia } from "elysia";
import { LanguagesResponse } from "../types";

const SUPPORTED_LANGUAGES: typeof LanguagesResponse.static = {
  languages: [
    { code: "en", label: "English", tts_available: true },
    { code: "zh", label: "Chinese (Simplified)", tts_available: true },
    { code: "ms", label: "Malay", tts_available: true },
    { code: "ta", label: "Tamil", tts_available: true },
    { code: "singlish", label: "Singlish", tts_available: true },
  ],
};

export const languagesRoute = new Elysia().get(
  "/languages",
  () => SUPPORTED_LANGUAGES,
  {
    response: LanguagesResponse,
    detail: {
      summary: "List all supported languages and TTS voice options",
      tags: ["Utility"],
    },
  }
);
