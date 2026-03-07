import { Elysia } from "elysia";
import { ImageBody, AnalysisAiOutputSchema, AnalysisResponse } from "../types";
import type { TAnalysisAiOutput, TAnalysisResponse } from "../types";
import { callAiImageWithSearch } from "../../functions/call-ai";
import { postMessageCheck } from "../../functions/postMessageCheck";

function normalizeClassification(
  value: unknown
): "legitimate" | "misleading" | "scam" | "suspicious" | "unverified" {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("scam") || text.includes("fraud") || text.includes("phish")) return "scam";
  if (text.includes("mislead") || text.includes("false") || text.includes("fake") || text.includes("hoax")) return "misleading";
  if (text.includes("suspic") || text.includes("dubious") || text.includes("questionable")) return "suspicious";
  if (text.includes("legit") || text.includes("reliable") || text.includes("safe") || text.includes("informational")) return "legitimate";
  return "unverified";
}

const SYSTEM_PROMPT =
  "You are a fact-checking assistant specialised in detecting misinformation, scams, and manipulated media. " +
  "Analyse the provided image(s) for claims, statistics, quotes, and assertions. " +
  "Use exa_search to verify those claims against authoritative sources. " +
  "If any discrepancies exist between what the image states and what credible sources confirm, " +
  "explain each one explicitly: what the image claims, what sources say, and why they conflict. " +
  "Use ONLY these enum values exactly as written:\n" +
  "  • cross_references[].contradiction_level: 'low' | 'medium' | 'high'\n" +
  "For each cross_references entry, set url to the exact URL returned by exa_search.";

export const imageRoute = new Elysia().post(
  "/image",
  async ({ body }) => {
    console.log("image route called, images:", body.images.length);

    const prompt =
      `Analyse the image(s) above for misinformation, scam signals, and factual accuracy. ` +
      `Identify every claim, statistic, name, date, or assertion visible. ` +
      `Use exa_search to cross-reference them, then explain any discrepancies. ` +
      `cross_references[].contradiction_level must be exactly one of: "low", "medium", "high". ` +
      `For each cross_references entry, set url to the exact URL returned by exa_search.` +
      (body.context_url ? `\n\nImage source URL: ${body.context_url}` : "");

    const { text: raw, searchResults } = await callAiImageWithSearch(body.images, prompt, {
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

    console.log("AI raw response:", raw?.slice(0, 300));
    console.log("Exa results:", searchResults.length);

    if (!raw || raw.trim() === "") {
      throw new Error("AI returned empty response");
    }

    let output: TAnalysisAiOutput;
    try {
      output = JSON.parse(raw) as TAnalysisAiOutput;
    } catch (e) {
      console.error("JSON parse failed. Full raw:", raw);
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
        contradiction_level: aiByUrl.get(item.url) ?? ("medium" as const),
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
        content_text: `[image analysis] ${output.summary}`,
        credibility_score: normalizedOutput.credibility_score,
        summary: normalizedOutput.summary,
        recommendation: normalizedOutput.recommendation,
        bias_detected: normalizedOutput.bias_detected,
        cross_references: normalizedOutput.cross_references,
        key_claims: normalizedOutput.key_claims,
        image_present: true,
        image_hash: null,
      });
      db_id = inserted?.id;
    } catch (err) {
      console.error("Failed to insert message_check into DB:", err);
    }

    return {
      ...normalizedOutput,
      analysis_id: db_id ?? crypto.randomUUID(),
    } satisfies TAnalysisResponse;
  },
  {
    body: ImageBody,
    response: AnalysisResponse,
    detail: {
      summary: "Analyse screenshot(s) for misinformation — cross-references image content against web search",
      tags: ["Analysis"],
    },
  }
);
