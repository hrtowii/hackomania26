import { OpenAI } from "openai";

export const openai_client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: Bun.env.OPENROUTER_API_KEY,
});

// Pick an embeddings model available on OpenRouter.
// If this errors, try "text-embedding-3-small" (if supported) or another embeddings model on OpenRouter.
export const DEFAULT_EMBED_MODEL = "openai/text-embedding-3-small";

// Your DB vector dimension MUST match this.
// If your DB uses vector(1536), keep 1536.
// If you changed DB to vector(384), use a local model instead (not OpenAI embeddings).
export const EMBEDDING_DIMS = 1536;

export type CallEmbeddingOptions = {
  model?: string;
  dimensions?: number;
};

/**
 * Returns an embedding vector (number[]) for a given text.
 * Uses OpenRouter embeddings endpoint via OpenAI SDK.
 */
export async function embedText(
  text: string,
  options: CallEmbeddingOptions = {}
): Promise<number[]> {
  const { model = DEFAULT_EMBED_MODEL, dimensions = EMBEDDING_DIMS } = options;

  const input = (text ?? "").trim();
  if (!input) throw new Error("embedText: text is empty");

  // OpenAI SDK supports embeddings via client.embeddings.create(...)
  // OpenRouter exposes compatible endpoints for supported models.
  const res = await openai_client.embeddings.create({
    model,
    input,
    // Some embedding models accept dimensions (e.g. OpenAI text-embedding-3-*).
    // If the model doesn't support it, OpenRouter/provider may ignore or error.
    ...(dimensions ? { dimensions } : {}),
  } as any);

  const vec = res.data?.[0]?.embedding;
  if (!vec || !Array.isArray(vec)) {
    throw new Error("embedText: missing embedding in response");
  }

  // Optional sanity check if you expect fixed dims
  if (dimensions && vec.length !== dimensions) {
    throw new Error(`embedText: expected ${dimensions} dims, got ${vec.length}`);
  }

  return vec as number[];
}