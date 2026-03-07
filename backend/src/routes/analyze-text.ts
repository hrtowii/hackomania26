import { Elysia } from "elysia";
import { AnalyzeTextBody, AnalysisResponse, CrossReference } from "../types";
import type { TAnalysisResponse } from "../types";
import { t } from "elysia";
import { randomUUID } from "crypto";
import { callAiWithSearch } from "../../functions/call-ai";

// TypeBox schema for the model-generated fields only (no analysis_id / audio_url)
const AnalysisOutputSchema = t.Object({
  credibility_score: t.Number({ minimum: 0, maximum: 100 }),
  risk_level: t.Union([t.Literal("safe"), t.Literal("caution"), t.Literal("suspicious")]),
  summary: t.String(),
  bias_detected: t.Array(t.String()),
  cross_references: t.Array(CrossReference),
  key_claims: t.Array(t.String()),
  recommendation: t.String(),
});

type TAnalysisOutput = typeof AnalysisOutputSchema.static;

const SYSTEM_PROMPT =
  "You are a fact-checking assistant. Identify the key claims in the text, " +
  "use exa_search to find sources that confirm or contradict them, " +
  "then return your structured analysis.";

export const analyzeTextRoute = new Elysia().post(
  "/analyze/text",
  async ({ body }) => {
    const prompt =
      `${SYSTEM_PROMPT}\n\n` +
      `${body.source_url ? `Source URL: ${body.source_url}\n` : ""}` +
      `Text:\n\n${body.text}`;

    const raw = await callAiWithSearch(prompt, undefined, {
      type: "json_schema",
      json_schema: {
        name: "analysis",
        strict: true,
        schema: AnalysisOutputSchema as unknown as Record<string, unknown>,
      },
    });

    const output = JSON.parse(raw) as TAnalysisOutput;

    return { ...output, analysis_id: randomUUID() } satisfies TAnalysisResponse;
  },
  {
    body: AnalyzeTextBody,
    response: AnalysisResponse,
    detail: {
      summary: "Analyze text for credibility and misinformation",
      tags: ["Analysis"],
    },
  }
);
