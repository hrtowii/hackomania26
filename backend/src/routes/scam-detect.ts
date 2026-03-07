import { Elysia } from "elysia";
import { ScamDetectBody, ScamDetectResponse } from "../types";
import { callAiOneShot } from "../../functions/call-ai";

/**
 * POST /scam-detect
 *
 * Accepts context about a link/button/form the user is about to interact with
 * and returns a safety score + one-line summary using AI, tuned for Singapore
 * scam patterns (SPF advisories, local bank phishing, job scams, etc.).
 *
 * safety_score 0–100: 0 = definite scam, 100 = completely safe
 * If safety_score < 50 the extension will show the warning popup.
 */
export const scamDetectRoute = new Elysia().post(
  "/scam-detect",
  async ({ body }) => {
    const { target_url, page_url, button_text, page_title } = body;

    const prompt = `You are a scam-detection AI specialised in Singapore cybercrime patterns.
Analyse the following click action and determine the scam risk.

Context:
- Current page URL    : ${page_url}
- Current page title  : ${page_title ?? "Unknown"}
- Clicked element text: ${button_text ?? "(unknown)"}
- Target URL          : ${target_url ?? "(not available)"}

Singapore-specific scam patterns to consider:
• Impersonation of SG government agencies: SPF, MAS, CPF Board, MOH, IRAS, HDB, ICA, Singpass / MyInfo
• Phishing of local banks: DBS/POSB, OCBC, UOB, Standard Chartered SG, Maybank SG
• Job scams — unrealistic work-from-home pay, "agent" / "part-time liker" roles
• Investment scams — guaranteed high returns, unlicensed investment platforms
• Love / romance scams leading to fund transfers
• Fake e-commerce on Carousell, Shopee, Lazada — requests to pay outside platform
• Parcel delivery scams impersonating SingPost or Ninja Van
• URLs that typosquat .gov.sg or .com.sg domains (e.g. "singpass-verify.com")
• Urgency tactics: arrest warrants, CPF account suspension, prize redemption deadlines

Respond ONLY with a valid JSON object — no markdown, no extra text:
{
  "safety_score": <integer 0–100; 100 = completely safe, 0 = definite scam>,
  "is_scam": <true if safety_score < 50, else false>,
  "summary": "<one plain-English sentence ≤ 15 words explaining the risk or confirming safety>",
  "risk_level": "<safe | caution | suspicious>"
}`;

    try {
      const raw = await callAiOneShot(prompt);

      // Extract the first JSON object from the response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in AI response");

      const parsed = JSON.parse(jsonMatch[0]);

      const safetyScore = Math.min(100, Math.max(0, Number(parsed.safety_score ?? 75)));
      const validRiskLevels = ["safe", "caution", "suspicious"] as const;
      const rawRisk = parsed.risk_level ?? (safetyScore >= 70 ? "safe" : safetyScore >= 50 ? "caution" : "suspicious");
      const riskLevel = validRiskLevels.includes(rawRisk) ? rawRisk : "caution";

      return {
        safety_score: safetyScore,
        is_scam: safetyScore < 50,
        summary: String(parsed.summary ?? "Unable to determine risk."),
        risk_level: riskLevel,
      } as const;
    } catch {
      // Fallback: don't block the user if AI is unavailable
      return {
        safety_score: 75,
        is_scam: false,
        summary: "Analysis unavailable — proceed with caution.",
        risk_level: "caution" as const,
      };
    }
  },
  {
    body: ScamDetectBody,
    response: ScamDetectResponse,
    detail: {
      summary: "Detect scam risk for a click / form-submit action (Singapore context)",
      tags: ["Scam Detection"],
    },
  }
);
