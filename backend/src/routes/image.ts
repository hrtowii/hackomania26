import { Elysia } from "elysia";
import { ImageBody, AnalysisResponse } from "../types";
import { randomUUID } from "crypto";

export const imageRoute = new Elysia().post(
  "/image",
  async ({ body }) => {
    // TODO: decode base64 image, run vision model analysis
    const stub: typeof AnalysisResponse.static = {
      analysis_id: randomUUID(),
      credibility_score: 50,
      summary: "Stub analysis for uploaded image.",
      bias_detected: [],
      cross_references: [],
      key_claims: [],
      recommendation: "No image analysis implemented yet.",
      ...(body.context_url ? {} : {}),
    };
    return stub;
  },
  {
    body: ImageBody,
    response: AnalysisResponse,
    detail: {
      summary: "Analyze a screenshot or image for misinformation",
      tags: ["Analysis"],
    },
  }
);
