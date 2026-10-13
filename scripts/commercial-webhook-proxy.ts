import { createCommercialWebhookProxy } from "../src/lib/commercial/webhook-proxy";
const server = createCommercialWebhookProxy();
server.listen(4338, "127.0.0.1", () => {
  console.log(
    "Receptor QA limitado a POST /api/commercial/webhooks/email en 127.0.0.1:4338.",
  );
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => server.close());
