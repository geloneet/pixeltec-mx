import { createServer, request } from "node:http";

export const commercialEmailWebhookPath = "/api/commercial/webhooks/email";
const maximumBytes = 1000000;

/** Temporary QA ingress. No dashboard, cookies, credentials or configurable host. */
export function createCommercialWebhookProxy(targetPort = 4336) {
  if (
    !Number.isSafeInteger(targetPort) ||
    targetPort < 1024 ||
    targetPort > 65535
  )
    throw new Error("invalid_qa_target_port");
  const server = createServer(
    { requestTimeout: 15000 },
    (incoming, response) => {
      const finish = (status: number) => {
        if (response.writableEnded) return;
        response.writeHead(status, {
          "content-type": "application/json",
          "cache-control": "no-store",
        });
        response.end(JSON.stringify({ ok: status >= 200 && status < 300 }));
      };
      if (
        incoming.method !== "POST" ||
        incoming.url !== commercialEmailWebhookPath
      ) {
        incoming.resume();
        return finish(404);
      }
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      for (const name of ["svix-id", "svix-timestamp", "svix-signature"]) {
        const value = incoming.headers[name];
        if (typeof value !== "string" || !value || value.length > 4096) {
          incoming.resume();
          return finish(401);
        }
        headers[name] = value;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      incoming.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maximumBytes) {
          chunks.length = 0;
          finish(413);
        } else if (!response.writableEnded) chunks.push(chunk);
      });
      incoming.on("error", () => finish(400));
      incoming.on("end", () => {
        if (response.writableEnded) return;
        const upstream = request(
          {
            hostname: "127.0.0.1",
            port: targetPort,
            path: commercialEmailWebhookPath,
            method: "POST",
            headers,
            timeout: 12000,
          },
          (reply) => {
            reply.resume();
            reply.on("error", () => finish(503));
            reply.on("end", () => finish(reply.statusCode || 503));
          },
        );
        upstream.on("timeout", () => upstream.destroy());
        upstream.on("error", () => finish(503));
        upstream.end(Buffer.concat(chunks));
      });
    },
  );
  server.headersTimeout = 5000;
  return server;
}
