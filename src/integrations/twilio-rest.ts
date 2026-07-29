import type { AppConfig } from "../config.js";

/**
 * A real REST integration used by a service that has not adopted the Twilio
 * SDK yet. Nomos should inventory it independently from ReceiptMessenger.
 */
export async function sendReceiptViaTwilioRest(
  config: AppConfig,
  to: string,
  paymentId: string,
) {
  const body = new URLSearchParams({
    To: to,
    From: config.twilioFromNumber,
    Body: `Your payment ${paymentId} was received.`,
  });
  const credentials = Buffer.from(
    `${config.twilioAccountSid}:${config.twilioAuthToken}`,
  ).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  if (!response.ok) {
    throw new Error(`Twilio Messages API returned ${response.status}`);
  }
  return response.json();
}
