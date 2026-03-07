import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";


export type CrossReference = {
  title: string;
  url?: string;
  source?: string;
  excerpt?: string;
  relation?: string;
  confidence?: number;
};

export type MessageCheckInput = {
  content_text: string;
  credibility_score: number;
  summary: string;
  recommendation: string;

  bias_detected?: string[];
  cross_references?: CrossReference[];
  key_claims?: string[];

  image_present?: boolean;
  image_hash?: string | null;
};
const supabaseUrl = Bun.env.SUPABASE_URL;
const supabaseKey = Bun.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
if (!supabaseKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeText(input: string): string {
  return input.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function hashText(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function validateInput(input: MessageCheckInput) {
  if (!input.content_text?.trim()) throw new Error("content_text is required");
  if (input.credibility_score < 0 || input.credibility_score > 100)
    throw new Error("credibility_score must be between 0 and 100");
  // if (!["safe", "caution", "suspicious"].includes(input.risk_level))
  //   throw new Error("risk_level must be safe, caution, or suspicious");
  if (!input.summary?.trim()) throw new Error("summary is required");
  if (!input.recommendation?.trim()) throw new Error("recommendation is required");
}

export async function postMessageCheck(input: MessageCheckInput) {
  validateInput(input);

  const normalized_text = normalizeText(input.content_text);
  const text_hash = hashText(normalized_text);

  const payload = {
    content_text: input.content_text,
    normalized_text,
    text_hash,

    credibility_score: input.credibility_score,
    // risk_level: input.risk_level,
    summary: input.summary,
    recommendation: input.recommendation,

    bias_detected: input.bias_detected ?? [],
    cross_references: input.cross_references ?? [],
    key_claims: input.key_claims ?? [],

    image_present: input.image_present ?? false,
    image_hash: input.image_hash ?? null,
  };

  const { data, error } = await supabase
    .from("message_checks")
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);

  return data;
}

// ---- quick local test (optional) ----
async function main() {
  try {
    const inserted = await postMessageCheck({
      content_text:
        "Forwarded message claims a vaccine contains tracking chips and hospitals are hiding the truth.",
      credibility_score: 18,
      // risk_level: "suspicious",
      summary:
        "The message makes serious medical claims without reliable evidence and uses fear-based framing.",
      recommendation:
        "Do not forward this message without checking official health sources first.",
      bias_detected: ["fear appeal", "false authority"],
      cross_references: [
        {
          title: "MOH advisory on vaccine misinformation",
          url: "https://example.com/moh-advisory",
          source: "MOH",
          excerpt: "No evidence supports claims that vaccines contain tracking devices.",
          relation: "contradicts",
          confidence: 0.96,
        },
      ],
      key_claims: [
        "Vaccines contain tracking chips",
        "Hospitals are hiding side effects",
      ],
      image_present: false,
      image_hash: null,
    });

    console.log("Inserted row:");
    console.dir(inserted, { depth: null });
  } catch (error) {
    console.error("Failed to insert message check:");
    console.error(error);
  }
}

// main();
