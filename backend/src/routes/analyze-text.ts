import { Elysia } from "elysia";
import { AnalyzeTextBody, AnalysisResponse } from "../types";
import { randomUUID } from "crypto";
export const analyzeTextRoute = new Elysia().post(
  "/analyze/text",
  async ({ body }) => {
    // TODO: run text through fact-check / credibility AI pipeline
    console.log("analyze/text called");
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
    body: AnalyzeTextBody,
    response: AnalysisResponse,
    detail: {
      summary: "Analyze text for credibility and misinformation",
      tags: ["Analysis"],
    },
  }
);
