/**
 * Callback dispatcher — POSTs delivery events back to the CRM.
 * Includes retry logic with exponential backoff (200ms, 400ms, 800ms).
 */

interface CallbackPayload {
  recipientId: string;
  eventType: string;
  occurredAt: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a callback to the CRM receipt endpoint with retry logic.
 * Retries up to 3 times with exponential backoff on failure.
 */
export async function dispatchCallback(
  callbackUrl: string,
  payload: CallbackPayload,
  maxRetries: number = 3
): Promise<boolean> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log(`  📩 Callback sent: ${payload.eventType} for ${payload.recipientId}`);
        return true;
      }

      console.warn(`  ⚠️  Callback attempt ${attempt + 1} got ${response.status}`);
    } catch (err: any) {
      console.warn(`  ⚠️  Callback attempt ${attempt + 1} failed: ${err.message}`);
    }

    if (attempt < maxRetries) {
      const backoffMs = 200 * Math.pow(2, attempt); // 200ms, 400ms, 800ms
      console.log(`  ⏳ Retrying in ${backoffMs}ms...`);
      await sleep(backoffMs);
    }
  }

  console.error(`  ❌ Callback failed after ${maxRetries + 1} attempts for ${payload.recipientId}`);
  return false;
}
