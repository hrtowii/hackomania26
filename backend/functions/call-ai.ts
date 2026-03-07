import { OpenAI } from "openai";
import type { ChatMessage } from "../src/types";
import { exaSearch } from "./search";
import type { ExaResult } from "./search";

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

export type CallAiWithSearchResult = {
  text: string;
  searchResults: ExaResult[];
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

const RESPONSE_HEALING_PLUGIN = [{ id: "response-healing" }];

/**
 * Chat call with Exa web search tool. Optionally pass a JSON Schema object
 * as `responseFormat` to get structured output on the final answer.
 *
 * Returns `{ text, searchResults }` where `searchResults` is the list of Exa
 * results from the tool call (empty array if no tool call happened).
 */
export async function callAiWithSearch(
  prompt: string,
  options: CallAiWithSearchOptions = {}
): Promise<CallAiWithSearchResult> {
  const { model = DEFAULT_MODEL, responseFormat, systemPrompt } = options;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt } as const] : []),
    { role: "user", content: prompt },
  ];

  const firstCallParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages,
    tools: [EXA_SEARCH_TOOL],
    tool_choice: "auto",
    stream: false,
    ...(responseFormat
      ? {
          response_format: responseFormat as unknown as OpenAI.ResponseFormatJSONSchema,
          plugins: RESPONSE_HEALING_PLUGIN,
        }
      : {}),
  };

  const first = await openai_client.chat.completions.create(firstCallParams);
  const firstMsg = first.choices[0].message;

  // Model answered directly without calling the tool
  if (first.choices[0].finish_reason !== "tool_calls" || !firstMsg.tool_calls?.length) {
    return { text: firstMsg.content ?? "", searchResults: [] };
  }

  const toolCall = firstMsg.tool_calls[0];
  if (toolCall.type !== "function") {
    return { text: firstMsg.content ?? "", searchResults: [] };
  }

  const { query, num_results } = JSON.parse(toolCall.function.arguments) as {
    query: string;
    num_results?: number;
  };

  const searchResults = await exaSearch(query, num_results ?? 5);

  const secondCallParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model,
    stream: false,
    messages: [
      ...messages,
      firstMsg,
      { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(searchResults) },
    ],
    ...(responseFormat
      ? {
          response_format: responseFormat as unknown as OpenAI.ResponseFormatJSONSchema,
          plugins: RESPONSE_HEALING_PLUGIN,
        }
      : {}),
  };

  const second = await openai_client.chat.completions.create(secondCallParams);

  return {
    text: second.choices[0].message.content ?? "",
    searchResults,
  };
}
