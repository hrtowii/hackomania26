import { OpenAI } from "openai";
import type { ChatMessage } from "../src/types";
import { exaSearch } from "./search";

export { type ChatMessage };

export const openai_client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: Bun.env.OPENROUTER_API_KEY,
});

export const DEFAULT_MODEL = "google/gemini-3.1-flash-lite-preview";
export const IMG_MODEL = "google/gemini-3.1-flash-lite-preview";

export type CallAiWithSearchOptions = {
  model?: string;
  responseFormat?: Record<string, unknown>;
  systemPrompt?: string;
};

export async function callAiOneShot(
  prompt: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const res = await openai_client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
  });
  return res.choices[0].message.content ?? "";
}

export async function callAiChat(
  pastMessages: ChatMessage[],
  currentMessage: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const res = await openai_client.chat.completions.create({
    model,
    messages: [
      ...(pastMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[]),
      { role: "user", content: currentMessage },
    ],
  });
  return res.choices[0].message.content ?? "";
}

export async function callAiImage(
  imageBase64: string,
  prompt: string,
  model: string = IMG_MODEL
): Promise<string> {
  const res = await openai_client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  return res.choices[0].message.content ?? "";
}

const EXA_SEARCH_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "exa_search",
    description: "Search the web for up-to-date information.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        num_results: { type: "number" },
      },
      required: ["query"],
    },
  },
};

/**
 * Chat call with Exa web search tool. Optionally pass a JSON Schema object
 * as `responseFormat` to get structured output on the final answer.
 */
export async function callAiWithSearch(
  prompt: string,
  options: CallAiWithSearchOptions = {}
): Promise<string> {
  const { model = DEFAULT_MODEL, responseFormat, systemPrompt } = options;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt } as const] : []),
    { role: "user", content: prompt },
  ];

  const first = await openai_client.chat.completions.create({
    model,
    messages,
    tools: [EXA_SEARCH_TOOL],
    tool_choice: "auto",
  });

  const firstMsg = first.choices[0].message;

  if (first.choices[0].finish_reason !== "tool_calls" || !firstMsg.tool_calls?.length) {
    if (!responseFormat) return firstMsg.content ?? "";

    const structured = await openai_client.chat.completions.create({
      model,
      messages,
      response_format: responseFormat as unknown as OpenAI.ResponseFormatJSONSchema,
    });

    return structured.choices[0].message.content ?? "";
  }

  const toolCall = firstMsg.tool_calls[0];
  if (toolCall.type !== "function") return firstMsg.content ?? "";

  const { query, num_results } = JSON.parse(toolCall.function.arguments) as {
    query: string;
    num_results?: number;
  };

  const searchResults = await exaSearch(query, num_results ?? 1);

  const second = await openai_client.chat.completions.create({
    model,
    messages: [
      ...messages,
      firstMsg,
      { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(searchResults) },
    ],
    ...(responseFormat ? { response_format: responseFormat as unknown as OpenAI.ResponseFormatJSONSchema } : {}),
  });

  return second.choices[0].message.content ?? "";
}
