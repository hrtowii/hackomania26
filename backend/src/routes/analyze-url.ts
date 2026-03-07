import { Elysia } from "elysia";
import { AnalyzeUrlBody, AnalysisResponse, CrossReference } from "../types";
import type { TAnalysisResponse } from "../types";
import { t } from "elysia";
import { randomUUID } from "crypto";
import { callAiWithSearch } from "../../functions/call-ai";

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
  "You are a credibility and scam-detection assistant specialised in Singapore cybercrime patterns. " +
  "You will be given the content of a webpage. Identify key claims, check for scam signals " +
  "(impersonation of SG government agencies, local bank phishing, job scams, investment scams, " +
  "fake e-commerce, urgency tactics, typosquatted .gov.sg / .com.sg domains), " +
  "use exa_search to cross-reference claims against credible sources, " +
  "then return your structured analysis.";

export const analyzeUrlRoute = new Elysia().post(
  "/analyze/url",
  async ({ body }) => {
    const jinaRes = await fetch(`https://r.jina.ai/${body.url}`, {
      headers: { Accept: "text/markdown" },
    });
    const pageMarkdown = jinaRes.ok ? await jinaRes.text() : "(page content unavailable)";

    const prompt =
      `${SYSTEM_PROMPT}\n\n` +
      `URL: ${body.url}\n\n` +
      `Page content:\n\n${pageMarkdown.slice(0, 12000)}`; // cap to ~12k chars

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
    body: AnalyzeUrlBody,
    response: AnalysisResponse,
    detail: {
      summary: "Analyze a URL for credibility, misinformation and scam signals",
      tags: ["Analysis"],
    },
  }
);
