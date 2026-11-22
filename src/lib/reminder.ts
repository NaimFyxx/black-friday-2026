// "Send me my cart at 10:00 on Friday" / "Remind me at 10:00": one email field.
// On submit: identify the visitor in Klaviyo (so their Added to Cart events
// are kept), send their current cart again, and subscribe them with email
// marketing consent to the Klaviyo list in bf_settings.reminder.list_id
// ("Fyxx Friday 2026 - Cart reminder"). The 10:00 email itself is built in
// Klaviyo. Once submitted, this browser is not asked again.

import { identifyKlaviyo, resendKlaviyoCart } from "@/lib/analytics";
import { KLAVIYO_COMPANY_ID } from "@/lib/campaign-config";

const DONE_KEY = "fyxx:reminder";

export function hasReminder(): boolean {
  try {
    return window.localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function markDone() {
  try {
    window.localStorage.setItem(DONE_KEY, "1");
  } catch {
    // private mode: they may be asked again, harmless
  }
  window.dispatchEvent(new Event("fyxx:reminder"));
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Klaviyo client API (public key, browser-safe): subscribe with consent. */
async function subscribe(email: string, listId: string, source: string): Promise<void> {
  const res = await fetch(
    `https://a.klaviyo.com/client/subscriptions/?company_id=${KLAVIYO_COMPANY_ID}`,
    {
      method: "POST",
      headers: { "content-type": "application/vnd.api+json", revision: "2024-10-15" },
      body: JSON.stringify({
        data: {
          type: "subscription",
          attributes: {
            custom_source: source,
            profile: {
              data: {
                type: "profile",
                attributes: {
                  email,
                  subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } },
                },
              },
            },
          },
          relationships: { list: { data: { type: "list", id: listId } } },
        },
      }),
    },
  );
  if (!res.ok && res.status !== 202) throw new Error(`Klaviyo ${res.status}`);
}

export async function submitReminder(
  email: string,
  listId: string,
  source: "cart" | "hero",
): Promise<void> {
  const clean = email.trim().toLowerCase();
  identifyKlaviyo(clean);
  resendKlaviyoCart();
  await subscribe(
    clean,
    listId,
    source === "cart" ? "Fyxx Friday site: cart reminder" : "Fyxx Friday site: remind me",
  );
  markDone();
}
