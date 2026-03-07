import { Elysia } from "elysia";
import { AnalyzeTextBody, AnalysisAiOutputSchema, AnalysisResponse } from "../types";
import type { TAnalysisAiOutput, TAnalysisResponse } from "../types";
import { randomUUID } from "crypto";
import { callAiWithSearch } from "../../functions/call-ai";
import { postMessageCheck } from "../../functions/postMessageCheck";
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  zh: "Simplified Chinese (中文)",
  ms: "Malay (Bahasa Melayu)",
  ta: "Tamil (தமிழ்)",
};
const SYSTEM_PROMPT =
  "You are a fact-checking assistant specialised in Singapore misinformation, scam messages, and digital fraud. " +
  "Identify the key claims in the text, use exa_search to find sources that confirm or contradict them, " +
  "then return your structured analysis.\n\n" +
  "Use ONLY these enum values exactly as written:\n" +
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
    const LangChosen = LANGUAGE_NAMES[body.preferred_language ?? "en"] ?? "English";

    console.log("📥 [1/4] Request received:", {
      textLength: body.text.length,
      language: LangChosen,
      source: body.source_url || "none",
    });

    const prompt =
      `IMPORTANT: Write ALL text fields (summary, recommendation, key_claims, bias_detected) ` +
      `in ${LangChosen}. Do not use English unless ${LangChosen} is English.\n\n` +
      `cross_references contradiction_level must be exactly one of: "low", "medium", "high". Never use "none".\n\n` +
      `${body.source_url ? `Source URL: ${body.source_url}\n` : ""}` +
      `${body.preferred_language ? `Respond in language: ${body.preferred_language}\n` : ""}` +
      `Text:\n\n${body.text}`;

    console.log("🔍 [2/4] Calling AI with web search...");
    const start = Date.now();

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

    console.log(`✅ [3/4] AI responded in ${((Date.now() - start) / 1000).toFixed(1)}s`);
    console.log("📄 Raw length:", raw?.length ?? 0);
    console.log("📄 Raw preview:", raw?.slice(0, 200));

    if (!raw || raw.trim() === "") {
      throw new Error("AI returned empty response");
    }

    let output: TAnalysisAiOutput;
    try {
      output = JSON.parse(raw) as TAnalysisAiOutput;
    } catch (e) {
      console.error("❌ JSON parse failed. Full raw:", raw);
      throw new Error(`JSON parse failed: ${e}`);
    }

    const CONTRADICTION_MAP: Record<string, "low" | "medium" | "high"> = {
      "none": "low",
      "minimal": "low",
      "moderate": "medium",
      "severe": "high",
      "strong": "high",
    };

    const normalizedCrossReferences = output.cross_references.map((ref) => ({
      ...ref,
      contradiction_level: (CONTRADICTION_MAP[ref.contradiction_level] ?? ref.contradiction_level) as "low" | "medium" | "high",
    }));

    console.log("🎉 [4/4] Done. score:", output.credibility_score);
    let db_id: string | undefined;

    try {
      const inserted = await postMessageCheck({
        content_text: body.text,
        credibility_score: output.credibility_score,
        summary: output.summary,
        recommendation: output.recommendation,
        bias_detected: output.bias_detected,
        cross_references: output.cross_references,
        key_claims: output.key_claims,
        image_present: false,
        image_hash: null,
      });

      db_id = inserted?.id;
    } catch (err) {
      console.error("Failed to insert message_check into DB:", err);
    }
    return {
      ...output,
      cross_references: normalizedCrossReferences,
      analysis_id: randomUUID(),
    } satisfies TAnalysisResponse;
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
