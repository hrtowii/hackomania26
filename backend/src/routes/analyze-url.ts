import { Elysia } from "elysia";
import { AnalyzeUrlBody, AnalysisAiOutputSchema, AnalysisResponse } from "../types";
import type { TAnalysisAiOutput, TAnalysisResponse } from "../types";
import { callAiWithSearch } from "../../functions/call-ai";
import { postMessageCheck } from "../../functions/postMessageCheck";

function normalizeClassification(value: unknown): "legitimate" | "misleading" | "scam" | "suspicious" | "unverified" {
  const text = String(value ?? "").toLowerCase();

  if (text.includes("scam") || text.includes("fraud") || text.includes("phish")) return "scam";
  if (text.includes("mislead") || text.includes("false") || text.includes("fake") || text.includes("hoax")) return "misleading";
  if (text.includes("suspic") || text.includes("dubious") || text.includes("questionable")) return "suspicious";
  if (text.includes("legit") || text.includes("reliable") || text.includes("safe") || text.includes("informational")) return "legitimate";
  return "unverified";
}
import { postMessageCheck } from "../../functions/postMessageCheck";

function normalizeClassification(value: unknown): "legitimate" | "misleading" | "scam" | "suspicious" | "unverified" {
  const text = String(value ?? "").toLowerCase();

  if (text.includes("scam") || text.includes("fraud") || text.includes("phish")) return "scam";
  if (text.includes("mislead") || text.includes("false") || text.includes("fake") || text.includes("hoax")) return "misleading";
  if (text.includes("suspic") || text.includes("dubious") || text.includes("questionable")) return "suspicious";
  if (text.includes("legit") || text.includes("reliable") || text.includes("safe") || text.includes("informational")) return "legitimate";
  return "unverified";
}

const SYSTEM_PROMPT =
  "You are a credibility and scam-detection assistant specialised in Singapore cybercrime patterns. " +
  "You will be given the content of a webpage. Identify key claims, check for scam signals " +
  "(impersonation of SG government agencies, local bank phishing, job scams, investment scams, " +
  "fake e-commerce, urgency tactics, typosquatted .gov.sg / .com.sg domains), " +
  "use exa_search to cross-reference claims against credible sources, " +
  "then return your structured analysis.\n\n" +
  "Use ONLY these enum values exactly as written:\n" +
  "  • cross_references[].contradiction_level: 'low' | 'medium' | 'high'\n" +
  "For each cross_references entry, set url to the exact URL returned by exa_search.";

export const analyzeUrlRoute = new Elysia().post(
  "/analyze/url",
  async ({ body }) => {
    console.log("analyze url called");
    console.log(body);

    const jinaRes = await fetch(`https://r.jina.ai/${body.url}`, {
      headers: { Accept: "text/markdown" },
    });
    const pageMarkdown = jinaRes.ok ? await jinaRes.text() : "(page content unavailable)";
    console.log(pageMarkdown);

    const prompt =
      `URL: ${body.url}\n\n` +
      `cross_references[].contradiction_level must be exactly one of: "low", "medium", "high". Never use "none".\n` +
      `For each cross_references entry, set url to the exact URL returned by exa_search.\n\n` +
      `Page content:\n\n${pageMarkdown.slice(0, 12000)}`; // cap to ~12k chars

    const { text: raw, searchResults } = await callAiWithSearch(prompt, {
      systemPrompt: SYSTEM_PROMPT,
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "analysis",
          strict: true,
          schema: JSON.parse(JSON.stringify(AnalysisAiOutputSchema)),
          schema: JSON.parse(JSON.stringify(AnalysisAiOutputSchema)),
        },
      },
    });

    console.log(raw);
    console.log("🔗 Exa results:", searchResults.length);

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

    const normalizedOutput = {
      ...output,
      classification: normalizeClassification(output.classification),
      cross_references,
    };

    let db_id: string | undefined;
    try {
      const inserted = await postMessageCheck({
        content_text: body.url,
        credibility_score: normalizedOutput.credibility_score,
        summary: normalizedOutput.summary,
        recommendation: normalizedOutput.recommendation,
        bias_detected: normalizedOutput.bias_detected,
        cross_references: normalizedOutput.cross_references,
        key_claims: normalizedOutput.key_claims,
        image_present: false,
        image_hash: null,
      });
      db_id = inserted?.id;
    } catch (err) {
      console.error("Failed to insert message_check into DB:", err);
    }

    return { ...normalizedOutput, analysis_id: db_id ?? crypto.randomUUID() } satisfies TAnalysisResponse;
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
