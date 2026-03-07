import { Elysia } from "elysia";
import { AnalyzeUrlBody, AnalysisAiOutputSchema, AnalysisResponse } from "../types";
import type { TAnalysisAiOutput, TAnalysisResponse } from "../types";
import { randomUUID } from "crypto";
import { callAiWithSearch } from "../../functions/call-ai";

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

    const raw = await callAiWithSearch(prompt, {
      systemPrompt: SYSTEM_PROMPT,
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "analysis",
          strict: true,
          schema: AnalysisAiOutputSchema as unknown as Record<string, unknown>,
        },
      },
    });

    const output = JSON.parse(raw) as TAnalysisAiOutput;

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
