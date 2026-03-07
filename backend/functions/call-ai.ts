import { OpenAI } from "openai";
import type { ChatMessage } from "../src/types";

export { type ChatMessage };

export const openai_client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: Bun.env.OPENROUTER_API_KEY,
});

export const DEFAULT_MODEL = "inception/mercury-2";


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
  const messages: ChatMessage[] = [
    ...pastMessages,
    { role: "user", content: currentMessage },
  ];

  const res = await openai_client.chat.completions.create({
    model,
    messages: messages as Parameters<
      typeof openai_client.chat.completions.create
    >[0]["messages"],
  });

  return res.choices[0].message.content ?? "";
}


export async function callAiImage(
  imageBase64: string,
  prompt: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const res = await openai_client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  return res.choices[0].message.content ?? "";
}
