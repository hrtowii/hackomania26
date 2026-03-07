/**
 * Shared TypeBox schemas and inferred TypeScript types for TruthLens API.
 *
 * Using Elysia's re-export of TypeBox (`t`) keeps everything consistent —
 * the same schema object drives both runtime validation AND the TypeScript type.
 */

import { t } from "elysia";


export const Language = t.Union(
  [
    t.Literal("en"),
    t.Literal("zh"),
    t.Literal("ms"),
    t.Literal("ta"),
    t.Literal("singlish"),
  ],
  { default: "en" }
);

export const PreferredLanguageField = t.Optional(
  t.Union([
    t.Literal("en"),
    t.Literal("zh"),
    t.Literal("ms"),
    t.Literal("ta"),
    t.Literal("singlish"),
  ])
);

// ─── Analysis response (shared by /analyze/url, /analyze/text, /image) ──────

export const CrossReference = t.Object({
  source: t.String(),
  contradiction_level: t.Union([
    t.Literal("low"),
    t.Literal("medium"),
    t.Literal("high"),
  ]),
  url: t.String(),
});

/**
 * WhatsApp / message-level classification.
 * More granular than risk_level — used for the FactCheck panel badge.
 */
export const WhatsAppClassification = t.Union([
  t.Literal("legitimate"),
  t.Literal("misleading"),
  t.Literal("scam"),
  t.Literal("suspicious"),
  t.Literal("unverified"),
]);

export const AnalysisResponse = t.Object({
  analysis_id: t.String({ description: "UUID of the stored analysis" }),
  credibility_score: t.Number({ minimum: 0, maximum: 100 }),
  risk_level: t.Union([
    t.Literal("safe"),
    t.Literal("caution"),
    t.Literal("suspicious"),
  ]),
  /** Granular FactCheck classification (especially for WhatsApp messages) */
  classification: t.Optional(WhatsAppClassification),
  summary: t.String(),
  bias_detected: t.Array(t.String()),
  cross_references: t.Array(CrossReference),
  key_claims: t.Array(t.String()),
  recommendation: t.String(),
  audio_url: t.Optional(t.String()),
});

export type TAnalysisResponse = typeof AnalysisResponse.static;

// ─── POST /analyze/url ────────────────────────────────────────────────────────

export const AnalyzeUrlBody = t.Object({
  url: t.String({ description: "The URL to analyze" }),
  user_id: t.Optional(t.String()),
  preferred_language: PreferredLanguageField,
});

export type TAnalyzeUrlBody = typeof AnalyzeUrlBody.static;

// ─── POST /image ──────────────────────────────────────────────────────────────

export const ImageBody = t.Object({
  image: t.String({ description: "Base64-encoded image or file content" }),
  context_url: t.Optional(t.String()),
  preferred_language: PreferredLanguageField,
});

export type TImageBody = typeof ImageBody.static;

// ─── POST /analyze/text ───────────────────────────────────────────────────────

export const AnalyzeTextBody = t.Object({
  text: t.String({ minLength: 1, description: "Highlighted text content" }),
  source_url: t.Optional(t.String()),
  preferred_language: PreferredLanguageField,
});

export type TAnalyzeTextBody = typeof AnalyzeTextBody.static;

// ─── POST /transcript ─────────────────────────────────────────────────────────

export const TranscriptBody = t.Object({
  audio: t.String({ description: "Base64-encoded audio file" }),
  source_language: t.Optional(t.String({ default: "auto-detect" })),
  task: t.Optional(
    t.Union([t.Literal("transcribe"), t.Literal("analyze")], {
      default: "transcribe",
    })
  ),
});

export type TTranscriptBody = typeof TranscriptBody.static;

export const TranscriptResponse = t.Object({
  transcript: t.String(),
  detected_language: t.Optional(t.String()),
  analysis: t.Optional(AnalysisResponse),
});

export type TTranscriptResponse = typeof TranscriptResponse.static;

// ─── POST /text-to-speech ─────────────────────────────────────────────────────

export const TtsVoice = t.Union([
  t.Literal("singlish"),
  t.Literal("en"),
  t.Literal("zh"),
  t.Literal("ms"),
  t.Literal("ta"),
]);

export const TtsBody = t.Object({
  text: t.String({ minLength: 1 }),
  voice: t.Optional(TtsVoice),
  speed: t.Optional(t.Number({ minimum: 0.5, maximum: 2.0, default: 1.0 })),
});

export type TTtsBody = typeof TtsBody.static;

export const TtsResponse = t.Object({
  audio_url: t.String(),
  duration_seconds: t.Optional(t.Number()),
});

export type TTtsResponse = typeof TtsResponse.static;

// ─── POST /feedback ───────────────────────────────────────────────────────────

export const FeedbackBody = t.Object({
  analysis_id: t.String(),
  user_id: t.String(),
  vote: t.Union([t.Literal("upvote"), t.Literal("downvote")]),
  reason: t.Optional(t.String()),
});

export type TFeedbackBody = typeof FeedbackBody.static;

export const FeedbackResponse = t.Object({
  success: t.Boolean(),
  upvotes: t.Number(),
  downvotes: t.Number(),
});

export type TFeedbackResponse = typeof FeedbackResponse.static;

// ─── GET /feedback/:analysis_id ───────────────────────────────────────────────

export const FeedbackCountResponse = t.Object({
  analysis_id: t.String(),
  upvotes: t.Number(),
  downvotes: t.Number(),
});

export type TFeedbackCountResponse = typeof FeedbackCountResponse.static;

// ─── GET /languages ───────────────────────────────────────────────────────────

export const LanguageEntry = t.Object({
  code: t.String(),
  label: t.String(),
  tts_available: t.Boolean(),
});

export const LanguagesResponse = t.Object({
  languages: t.Array(LanguageEntry),
});

export type TLanguagesResponse = typeof LanguagesResponse.static;

// ─── GET /health ──────────────────────────────────────────────────────────────

export const HealthResponse = t.Object({
  status: t.Literal("ok"),
  uptime_seconds: t.Number(),
  version: t.String(),
});

export type THealthResponse = typeof HealthResponse.static;

// ─── POST /scam-detect ──────────────────────────────────────────────────────────

export const ScamDetectBody = t.Object({
  target_url: t.Optional(t.String({ description: "Destination URL (link href or form action)" })),
  page_url: t.String({ description: "Current page URL" }),
  button_text: t.Optional(t.String({ description: "Visible text of the clicked element" })),
  page_title: t.Optional(t.String({ description: "Document title of the current page" })),
  preferred_language: PreferredLanguageField,
});

export type TScamDetectBody = typeof ScamDetectBody.static;

export const ScamDetectResponse = t.Object({
  safety_score: t.Number({ minimum: 0, maximum: 100, description: "0 = definite scam, 100 = completely safe" }),
  is_scam: t.Boolean(),
  summary: t.String({ description: "One-line plain-English summary of the risk" }),
  risk_level: t.Union([t.Literal("safe"), t.Literal("caution"), t.Literal("suspicious")]),
});

export type TScamDetectResponse = typeof ScamDetectResponse.static;

// ─── AI chat message types (used by functions/call-ai.ts) ────────────────────

export type SystemMessage = { role: "system"; content: string };
export type UserMessage = { role: "user"; content: string };
export type AssistantMessage = {
  role: "assistant";
  content: string | null;
  reasoning_details?: unknown;
};

export type ChatMessage = SystemMessage | UserMessage | AssistantMessage;
