import { createClient } from "@supabase/supabase-js";
import crypto, { randomUUID } from "crypto";
import { MessageCheckCrossReference, MessageCheckInput } from "../src/types";
const supabaseUrl = Bun.env.SUPABASE_URL;
const supabaseKey = Bun.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
if (!supabaseKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeText(input: string): string {
  return input.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function hashText(input: string): string {
  // return crypto.createHash("sha256").update(input).digest("hex");
  return randomUUID();
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
  const embedding = await embedText(normalized_text); // number[]

  await supabase
    .from("message_check_embeddings")
    .upsert(
      { message_check_id: data.id, embedding },
      { onConflict: "message_check_id" }
    );
  
  return data;
}

