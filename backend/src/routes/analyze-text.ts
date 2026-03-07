import { Elysia } from "elysia";
import { AnalyzeTextBody, AnalysisResponse, CrossReference, WhatsAppClassification } from "../types";
import type { TAnalysisResponse } from "../types";
import { t } from "elysia";
import { randomUUID } from "crypto";
import { callAiWithSearch } from "../../functions/call-ai";

const AnalysisOutputSchema = t.Object({
  credibility_score: t.Number({ minimum: 0, maximum: 100 }),
  risk_level: t.Union([t.Literal("safe"), t.Literal("caution"), t.Literal("suspicious")]),
  classification: WhatsAppClassification,
  summary: t.String(),
  bias_detected: t.Array(t.String()),
  cross_references: t.Array(CrossReference),
  key_claims: t.Array(t.String()),
  recommendation: t.String(),
});

type TAnalysisOutput = typeof AnalysisOutputSchema.static;

const SYSTEM_PROMPT =
  "You are a fact-checking assistant specialised in Singapore misinformation, scam messages, and digital fraud. " +
  "Identify the key claims in the text, use exa_search to find sources that confirm or contradict them, " +
  "then return your structured analysis.\n\n" +
  "Use ONLY these enum values exactly as written:\n" +
  "  • risk_level: 'safe' | 'caution' | 'suspicious'\n" +
  "  • cross_references[].contradiction_level: 'low' | 'medium' | 'high'\n\n" +
  "For the 'classification' field, choose exactly one of:\n" +
  "  • 'legitimate'  – content is verified accurate\n" +
  "  • 'misleading'  – partially false, manipulative framing, or missing key context\n" +
  "  • 'scam'        – financial fraud, phishing attempt, or known scam pattern\n" +
  "  • 'suspicious'  – likely false or problematic but cannot be fully confirmed\n" +
  "  • 'unverified'  – insufficient evidence to make a determination\n\n" +
  "Singapore-specific patterns to watch: CPF/SingPass/MAS impersonation, local bank phishing (DBS/OCBC/UOB), " +
  "job scams, investment scams, love scams, Carousell/Shopee fraud, SingPost parcel scams.";

export const analyzeTextRoute = new Elysia().post(
  "/analyze/text",
  async ({ body }) => {
    const prompt =
      `${SYSTEM_PROMPT}\n\n` +
      `${body.source_url ? `Source URL: ${body.source_url}\n` : ""}` +
      `${body.preferred_language ? `Respond in language: ${body.preferred_language}\n` : ""}` +
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
