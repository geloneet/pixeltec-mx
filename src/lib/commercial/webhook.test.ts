import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUserSession: vi.fn() }));
const processor = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock("@/lib/commercial/email-events", () => ({
  processCommercialEmailEvent: processor,
}));
import { POST } from "@/app/api/commercial/webhooks/email/route";

describe("Webhook Resend: verificación SDK sobre bytes originales", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });
  function request(changed = false, age = 0, missing = false) {
    const secret = randomBytes(32),
      id = "msg_" + randomUUID(),
      timestamp = String(Math.floor(Date.now() / 1000) - age);
    const payload = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: randomUUID() },
    });
    vi.stubEnv("RESEND_API_KEY", "re_sdk_signature_test_only");
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec_" + secret.toString("base64"));
    vi.stubEnv("COMMERCIAL_EMAIL_WEBHOOK_ENABLED", "true");
    const signature =
      "v1," +
      createHmac("sha256", secret)
        .update(`${id}.${timestamp}.${payload}`)
        .digest("base64");
    return new Request(
      "https://example.invalid/api/commercial/webhooks/email",
      {
        method: "POST",
        body: changed ? payload + " " : payload,
        headers: missing
          ? {}
          : {
              "svix-id": id,
              "svix-timestamp": timestamp,
              "svix-signature": signature,
            },
      },
    );
  }
  it("firma válida entra al procesador una vez", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(processor).toHaveBeenCalledOnce();
  });
  it.each([
    [true, 0, false],
    [false, 601, false],
    [false, 0, true],
  ])(
    "cuerpo alterado, firma vencida o cabeceras ausentes no tocan negocio",
    async (changed, age, missing) => {
      expect((await POST(request(changed, age, missing))).status).toBe(401);
      expect(processor).not.toHaveBeenCalled();
    },
  );
  it("recepción sin configuración falla cerrada", async () => {
    const r = request();
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
    expect((await POST(r)).status).toBe(401);
    expect(processor).not.toHaveBeenCalled();
  });
});
