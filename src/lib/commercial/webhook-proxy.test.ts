import { createServer, type Server, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCommercialWebhookProxy,
  commercialEmailWebhookPath,
} from "./webhook-proxy";

describe("Receptor QA: solo callback POST, sin ampliar acceso al dashboard", () => {
  let target: Server, proxy: Server, origin: string;
  const received: {
    path: string;
    headers: IncomingHttpHeaders;
    body: string;
  }[] = [];
  let targetStatus = 200;
  async function listen(server: Server) {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    return (server.address() as AddressInfo).port;
  }
  beforeAll(async () => {
    target = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        received.push({ path: req.url!, headers: req.headers, body });
        res.writeHead(targetStatus).end('{"private":"not forwarded"}');
      });
    });
    proxy = createCommercialWebhookProxy(await listen(target));
    origin = "http://127.0.0.1:" + (await listen(proxy));
  });
  afterAll(async () => {
    for (const server of [proxy, target]) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    }
  });
  const headers = {
    "svix-id": "test-event",
    "svix-timestamp": "1",
    "svix-signature": "test-signature",
  };
  it("ninguna ruta de interfaz, consulta o método alterno llega a QA", async () => {
    const prior = received.length;
    for (const [path, method] of [
      ["/hoy", "GET"],
      ["/api/commercial", "POST"],
      [commercialEmailWebhookPath, "GET"],
      [commercialEmailWebhookPath + "?x=1", "POST"],
      [commercialEmailWebhookPath + "/", "POST"],
    ]) {
      expect((await fetch(origin + path, { method, headers })).status).toBe(
        404,
      );
    }
    expect(received).toHaveLength(prior);
  });
  it("cabeceras ausentes no tocan el backend", async () => {
    const prior = received.length;
    expect(
      (
        await fetch(origin + commercialEmailWebhookPath, {
          method: "POST",
          body: "{}",
        })
      ).status,
    ).toBe(401);
    expect(received).toHaveLength(prior);
  });
  it("conserva bytes y Svix, elimina cookies/autorización y nunca devuelve contenido privado", async () => {
    const body = '{ "type": "email.received" }\n';
    const result = await fetch(origin + commercialEmailWebhookPath, {
      method: "POST",
      body,
      headers: {
        ...headers,
        cookie: "secret-test-cookie",
        authorization: "Bearer secret-test",
      },
    });
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ ok: true });
    const item = received.at(-1)!;
    expect(item.body).toBe(body);
    expect(item.path).toBe(commercialEmailWebhookPath);
    expect(item.headers["svix-signature"]).toBe(headers["svix-signature"]);
    expect(item.headers.cookie).toBeUndefined();
    expect(item.headers.authorization).toBeUndefined();
  });
  it("un cuerpo mayor a un MB no llega al backend", async () => {
    const prior = received.length;
    expect(
      (
        await fetch(origin + commercialEmailWebhookPath, {
          method: "POST",
          headers,
          body: "x".repeat(1000001),
        })
      ).status,
    ).toBe(413);
    expect(received).toHaveLength(prior);
  });
  it("rechazo de firma del backend se conserva y no se convierte en éxito", async () => {
    targetStatus = 401;
    expect(
      (
        await fetch(origin + commercialEmailWebhookPath, {
          method: "POST",
          headers,
          body: "{}",
        })
      ).status,
    ).toBe(401);
    targetStatus = 200;
  });
});
