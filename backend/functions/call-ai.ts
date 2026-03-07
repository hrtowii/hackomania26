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

/**
 * One-shot multimodal call with Exa web search tool.
 * Passes all images alongside the text prompt in a single user message.
 * The model may call exa_search if it needs to verify claims.
 */
export async function callAiImageWithSearch(
  imagesBase64: string[],
  prompt: string,
  options: CallAiWithSearchOptions = {}
): Promise<CallAiWithSearchResult> {
  const { model = IMG_MODEL, responseFormat, systemPrompt } = options;

  const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = imagesBase64.map(
    (b64) => ({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${b64}` },
    })
  );

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt } as const] : []),
    {
      role: "user",
      content: [...imageContent, { type: "text", text: prompt }],
    },
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
