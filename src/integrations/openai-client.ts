import OpenAI from "openai";

import type { AppConfig } from "../config.js";

/** A direct OpenAI SDK integration with a deliberately pinned model choice. */
export class SupportReplyGenerator {
  private readonly client: OpenAI;

  constructor(config: AppConfig) {
    this.client = new OpenAI({ apiKey: config.openAiApiKey });
  }

  async draftReply(customerMessage: string) {
    const response = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Write a concise, helpful billing support reply." },
        { role: "user", content: customerMessage },
      ],
    });
    return response.choices[0]?.message.content ?? "";
  }

  /**
   * A deliberately simple Chat Completions call for Nomos's verified
   * Chat-Completions-to-Responses maintenance rule. Returning the raw response
   * keeps the vendor-documented endpoint/input rewrite behavior-preserving.
   */
  async createLegacySupportDraft(customerMessage: string) {
    return this.client.chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "user", content: customerMessage }] });
  }
}

/**
 * A real direct-HTTP integration for services that have not adopted the SDK.
 * Keeping this next to the SDK client lets Nomos prove it detects both styles.
 */
export async function draftReplyViaOpenAiRest(
  config: AppConfig,
  customerMessage: string,
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: "Write a concise, helpful billing support reply.",
        },
        { role: "user", content: customerMessage },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI Responses API returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  return payload.output?.[0]?.content?.[0]?.text ?? "";
}
