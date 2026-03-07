import { Elysia } from "elysia";
import { AnalyzeBody, AnalysisResponse } from "../types";
import { randomUUID } from "crypto";

export const analyzeRoute = new Elysia().post(
  "/analyze",
  async ({ body }) => {
    // TODO: implement actual URL fetch + AI analysis
    console.log("analyse called")
    const stub: typeof AnalysisResponse.static = {
      analysis_id: randomUUID(),
      credibility_score: 50,
      risk_level: "caution",
      summary: `Stub analysis for URL: ${body.url}`,
      bias_detected: [],
      cross_references: [],
      key_claims: [],
      recommendation: "No analysis implemented yet.",
    };
    return stub;
  },
  {
    body: AnalyzeBody,
    response: AnalysisResponse,
    detail: {
      summary: "Analyze a URL for credibility and misinformation",
      tags: ["Analysis"],
    },
  }
);
