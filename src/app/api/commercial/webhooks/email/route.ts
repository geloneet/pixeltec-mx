import { verifyCommercialEmailWebhook } from "@/lib/email";
import { processCommercialEmailEvent } from "@/lib/commercial/email-events";
import { CommercialError } from "@/lib/commercial/access";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 1000000)
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  const headers = {
    id: request.headers.get("svix-id") || "",
    timestamp: request.headers.get("svix-timestamp") || "",
    signature: request.headers.get("svix-signature") || "",
  };
  let event: unknown;
  try {
    event = verifyCommercialEmailWebhook(raw, headers);
  } catch {
    return Response.json(
      { error: "invalid_webhook_signature" },
      { status: 401 },
    );
  }
  try {
    return Response.json(await processCommercialEmailEvent(event, headers.id));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof CommercialError
            ? error.code
            : "email_event_processing_failed",
      },
      { status: error instanceof CommercialError ? error.status : 503 },
    );
  }
}
