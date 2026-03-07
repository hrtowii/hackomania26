import { Elysia } from "elysia";
import { SummaryBody, AnalysisResponse } from "../types";
import { randomUUID } from "crypto";

export const summaryRoute = new Elysia().post(
  "/summary",
  async ({ body }) => {
    // TODO: run text through fact-check / credibility AI pipeline
    const stub: typeof AnalysisResponse.static = {
      analysis_id: randomUUID(),
      credibility_score: 50,
      risk_level: "caution",
      summary: `Stub analysis for text: "${body.text.slice(0, 60)}…"`,
      bias_detected: [],
      cross_references: [],
      key_claims: [body.text.slice(0, 100)],
      recommendation: "No text analysis implemented yet.",
    };
    return stub;
  },
  {
    body: SummaryBody,
    response: AnalysisResponse,
    detail: {
      summary: "Analyze highlighted text for credibility",
      tags: ["Analysis"],
    },
  }
);
