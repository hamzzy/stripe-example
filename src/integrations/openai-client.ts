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

// Direct-host evidence for the HTTP detector. This fixture never invokes it.
export async function openAiHealthProbe() {
  return fetch("https://api.openai.com/v1/models");
}
