import { Elysia } from "elysia";
import { AnalyzeTextBody, AnalysisAiOutputSchema, AnalysisResponse } from "../types";
import type { TAnalysisAiOutput, TAnalysisResponse } from "../types";
import { callAiWithSearch } from "../../functions/call-ai";
import { embedText } from "../../functions/embeddings";
import {randomUUID} from "crypto"
 import { postMessageCheck } from "../../functions/postMessageCheck";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Bun.env.SUPABASE_URL!,
  (Bun.env.SUPABASE_SERVICE_ROLE_KEY ?? Bun.env.SUPABASE_ANON_KEY)!
);

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

    console.log("[1/4] Request received:", {
      textLength: body.text.length,
      language: LangChosen,
      source: body.source_url || "none",
    });

    const prompt =
      `IMPORTANT: Write ALL text fields (summary, recommendation, key_claims, bias_detected) ` +
      `in ${LangChosen}. Do not use English unless ${LangChosen} is English.\n\n` +
      `cross_references[].contradiction_level must be exactly one of: "low", "medium", "high". Never use "none".\n` +
      `For each cross_references entry, set url to the exact URL returned by exa_search.\n\n` +
      `${body.source_url ? `Source URL: ${body.source_url}\n` : ""}` +
      `${body.preferred_language ? `Respond in language: ${body.preferred_language}\n` : ""}` +
      `Text:\n\n${body.text}`;
    console.log("🔍 [2/5] Comparing with scams in the database...");
    const embeddings = await embedText(body.text);
    // ADD embedding search here and return the 5 closest matches (debug)
    console.log("🧠 embedding length:", embeddings.length);
    
    try {
      const { data: matches, error } = await supabase.rpc("match_message_checks", {
        query_embedding: embeddings,
        match_count: 5,
        min_similarity: 0.01, // tune later (0.82–0.90)
      });
      if (error) {
        console.error("Embedding RPC error:", error.message);
      } else {
        const results = (matches ?? []) as Array<{
          message_check_id: string;
          similarity: number;
          credibility_score: number;
          summary: string;
          recommendation: string;
          content_text: string;
        }>;

        // Flag “known scam/misinfo” candidates: high similarity + low credibility
        const suspicious = results.filter(
          (m) => m.similarity >= 0.00 && (m.credibility_score ?? 100) <= 90
        );

        if (suspicious.length > 0) {
          const best = suspicious[0];

          console.log("🚨 Similar scam/misinfo found in DB:", {
            id: best.message_check_id,
            similarity: best.similarity,
            credibility: best.credibility_score,
          });

          // Return early: reuse stored analysis (skip AI)
          return {
            credibility_score: best.credibility_score,
            summary: best.summary,
            recommendation: best.recommendation,
            bias_detected: [], // optional: you can store these in DB and return them too
            key_claims: [],
            cross_references: [],
            analysis_id: randomUUID(),
          } satisfies TAnalysisResponse;
        }
      }
    } catch (e) {
      console.error("Embedding search failed:", e);
    }

    console.log("🔍 [3/5] Calling AI with web search...");
    const start = Date.now();

    const { text: raw, searchResults } = await callAiWithSearch(prompt, {
      systemPrompt: SYSTEM_PROMPT,
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "analysis",
          strict: true,
          schema: JSON.parse(JSON.stringify(AnalysisAiOutputSchema)),
        },
      },
    });

    console.log(`[4/5] AI responded in ${((Date.now() - start) / 1000).toFixed(1)}s`);
    // console.log("📄 Raw length:", raw?.length ?? 0);
    // console.log("📄 Raw preview:", raw?.slice(0, 200));
    // console.log("🔗 Exa results:", searchResults.length);

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

    // Build cross_references deterministically from Exa results.
    // AI-assigned contradiction_level values are mapped back by URL (best-effort).
    const aiByUrl = new Map<string, "low" | "medium" | "high">(
      (output.cross_references ?? [])
        .filter((ref) => ref.url?.startsWith("http"))
        .map((ref) => [ref.url, ref.contradiction_level])
    );

    const cross_references = searchResults.map((item) => {
      let source = "External source";
      try {
        source = new URL(item.url).hostname.replace(/^www\./, "");
      } catch { }
      return {
        title: item.title?.trim() || source,
        source,
        url: item.url,
        contradiction_level: aiByUrl.get(item.url) ?? "medium" as const,
      };
    });

    console.log("🎉 [5/5] Done. score:", output.credibility_score);
    let db_id: string | undefined;
    try {
      const inserted = await postMessageCheck({
        content_text: body.text,
        credibility_score: output.credibility_score,
        summary: output.summary,
        recommendation: output.recommendation,
        bias_detected: output.bias_detected,
        cross_references,
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
      cross_references,
      analysis_id: db_id ?? crypto.randomUUID(),
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
