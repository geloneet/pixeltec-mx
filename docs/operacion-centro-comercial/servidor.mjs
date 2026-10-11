#!/usr/bin/env node
/**
 * Servidor local de la plantilla de cierre «pixeltec-cierre/v2».
 * Sin dependencias. Sirve index.html (renderer), proyecto.json (datos del
 * proyecto) y persiste el estado en estado.json (pasos, chat, resumen,
 * bitácora, retro). El archivo es la fuente de verdad: la sesión del
 * Supervisor responde escribiendo en él con responder.mjs.
 *
 *   node servidor.mjs            → http://localhost:4870
 *   PORT=4871 node servidor.mjs  → otro puerto
 *   DEEPSEEK_API_KEY=…           → supervisor de proyecto (DeepSeek) en el chat
 *                                  (también desde un archivo .env junto a este servidor)
 *
 * Cada mensaje que DeepSeek decide pasar al Supervisor se anota en eventos.log
 * (una línea JSON): la sesión de Claude Code vigila ese archivo y despierta.
 */
import { createServer } from "node:http";
import { readFile, writeFile, rename, appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validarProyecto } from "./validar.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));

/** `.env` junto al servidor (DEEPSEEK_API_KEY=…): nunca en git, nunca en el chat. */
try {
  const env = await readFile(join(DIR, ".env"), "utf8");
  for (const line of env.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith("#") && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const ESTADO = join(DIR, "estado.json");
const PROYECTO = join(DIR, "proyecto.json");
const EVENTOS = join(DIR, "eventos.log");
const EXPORT_DIR = join(DIR, "export");
const PORT = Number(process.env.PORT || 4870);
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
const DEEPSEEK_MODEL = process.env.AI_MODEL || "deepseek-v4-flash";
const ESTADOS = ["pendiente", "hecho", "bloqueado", "omitido"];
const EVIDENCIA_TIPOS = ["verificado", "declarado", "documentado"];
const TZ = "America/Mexico_City";

/** Fecha/hora local (un solo huso en bitácora, exportación y nombres de archivo). */
function local(iso, withSeconds = false) {
  const d = iso ? new Date(iso) : new Date();
  const o = { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
  if (withSeconds) o.second = "2-digit";
  return new Intl.DateTimeFormat("es-MX", o).format(d);
}
function stampArchivo() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t) => parts.find((x) => x.type === t).value;
  return `${g("year")}-${g("month")}-${g("day")}-${g("hour")}${g("minute")}${g("second")}`;
}

// Validación al arrancar: un proyecto.json roto no sirve páginas a medias.
{
  let p;
  try { p = JSON.parse(await readFile(PROYECTO, "utf8")); } catch (e) { console.error(`✗ proyecto.json ilegible: ${e.message}`); process.exit(1); }
  const { errores } = validarProyecto(p);
  if (errores.length) {
    console.error(`✗ proyecto.json no cumple el esquema pixeltec-cierre/v2 (${errores.length} error(es)); el servidor no arranca:`);
    errores.forEach((x) => console.error("  - " + x));
    process.exit(1);
  }
}

const RULES =
  "Eres el supervisor de proyecto (DeepSeek) del checklist de cierre de PixelTEC. Atiendes a Miguel, el dueño, en español de México: breve y directo: la respuesta cabe en 120 palabras como máximo (salvo que pida un comando o una lista) y nunca se corta a la mitad. Detrás de ti está el Supervisor General, una sesión de Claude Code en el Mac mini que puede ejecutar acciones, verificar código, infraestructura y el vault, y tomar registro. Tu trabajo es decidir a quién le toca cada mensaje y contestar tú lo que puedas.\n\nRespondes SOLO con JSON: {\"destino\": \"deepseek\" | \"supervisor\", \"respuesta\": \"texto para Miguel\"}.\n\ndestino \"deepseek\" (lo resuelves tú, sin molestar al Supervisor): preguntas sobre el contenido del checklist (estado de pasos, qué sigue, comandos, qué verifica cada paso, decisiones pendientes, explicaciones de términos que aparecen ahí), dudas del proyecto que se responden con lo que dice el checklist, y charla ligera.\n\ndestino \"supervisor\" (lo pasas a Claude Code): órdenes o acciones (haz, cambia, corrige, despliega, mergea, abre un WO, actualiza la página o el checklist, corre algo, revisa el código), decisiones que Miguel comunica (GO, apruebo, elijo la opción X, merge hecho), salidas de terminal o errores pegados, cualquier cosa que exija verificar en código, infraestructura o el vault, lo que no esté en el checklist, cualquier mención explícita a Claude Code, al Supervisor o a la sesión, y todo caso de duda. Cuando el destino sea supervisor, la respuesta debe decir en una o dos frases que lo pasas al Supervisor General (Claude Code) y, si el checklist lo permite, el paso o contexto relacionado; no prometas resultados ni inventes que ya se hizo.\n\nReglas de contenido: tu única fuente es el CHECKLIST; nunca inventes estados, hashes ni fechas; los estados de cada paso vienen marcados ([hecho], [pendiente], [bloqueado], [omitido]); si Miguel habla de «el paso 9» sin fase, usa el número global entre paréntesis. Texto plano en la respuesta: sin Markdown, sin asteriscos ni almohadillas, sin encabezados.";

let writing = Promise.resolve();
let typing = false;

async function leer() {
  try {
    const st = JSON.parse(await readFile(ESTADO, "utf8"));
    st.pasos = st.pasos || {};
    st.messages = st.messages || [];
    st.bitacora = st.bitacora || [];
    st.retro = st.retro || {};
    st.post = st.post || {};
    st.updatedAt = st.updatedAt || "";
    return st;
  } catch {
    return { v: 2, pasos: {}, messages: [], bitacora: [], retro: {}, post: {}, updatedAt: "" };
  }
}

async function leerProyecto() {
  return JSON.parse(await readFile(PROYECTO, "utf8"));
}

/** Escritura atómica y serializada (tmp + rename). */
function guardar(st) {
  writing = writing.then(async () => {
    st.v = 2;
    st.updatedAt = new Date().toISOString();
    const tmp = ESTADO + ".tmp";
    await writeFile(tmp, JSON.stringify(st, null, 1), "utf8");
    await rename(tmp, ESTADO);
  });
  return writing;
}

function id(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function bitacora(st, tipo, texto) {
  st.bitacora.push({ at: new Date().toISOString(), tipo, texto });
}

/**
 * Llamada a DeepSeek con el razonamiento apagado: V4 Flash «piensa» antes de
 * escribir y ese razonamiento consume max_tokens. Si la API rechaza el
 * parámetro, reintenta sin él con un margen mayor.
 */
async function chatDeepSeek(messages, opts = {}) {
  const base = { model: DEEPSEEK_MODEL, messages, stream: false, temperature: opts.temperature ?? 0.2, max_tokens: opts.max_tokens ?? 1200 };
  if (opts.response_format) base.response_format = opts.response_format;
  const call = (payload) => fetch(`${DEEPSEEK_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45_000),
  });
  let res = await call({ ...base, thinking: { type: "disabled" } });
  if (res.status === 400) res = await call({ ...base, max_tokens: Math.max(base.max_tokens, 4000) });
  if (!res.ok) throw new Error(`DeepSeek respondió ${res.status}`);
  const json = await res.json();
  return (json.choices?.[0]?.message?.content || "").trim();
}

/** Triaje + respuesta: DeepSeek decide si lo atiende o lo pasa al Supervisor (Claude Code). */
async function triaje(context, messages) {
  if (!DEEPSEEK_KEY) return null;
  const turns = [{ role: "system", content: RULES + "\n\nCHECKLIST (estado actual):\n" + (context || "") }];
  for (const m of messages.slice(-9)) {
    if (m.from === "miguel") turns.push({ role: "user", content: m.text });
    else if (m.from === "deepseek" || m.from === "haiku") turns.push({ role: "assistant", content: JSON.stringify({ destino: m.route || "deepseek", respuesta: m.text }) });
    else turns.push({ role: "user", content: "[El Supervisor General (Claude Code) escribió]: " + m.text });
  }
  if (turns[turns.length - 1].role !== "user") turns.push({ role: "user", content: "Continúa." });
  const raw = await chatDeepSeek(turns, { max_tokens: 1400, response_format: { type: "json_object" } });
  const clean = raw.replace(/^```(?:json)?\s*|\s*```$/g, "");
  let parsed = null;
  try { parsed = JSON.parse(clean); } catch {
    const d = /"destino"\s*:\s*"(deepseek|supervisor)"/.exec(clean);
    const r = /"respuesta"\s*:\s*"([\s\S]*)$/.exec(clean);
    parsed = { destino: d ? d[1] : "supervisor", respuesta: r ? r[1].replace(/"\s*\}?\s*$/, "").replace(/\\n/g, "\n").replace(/\\"/g, '"') : clean };
  }
  const destino = parsed && parsed.destino === "deepseek" ? "deepseek" : "supervisor";
  const respuesta = String((parsed && parsed.respuesta) || clean || "").trim();
  return { destino, respuesta };
}

/** Mini resumen del avance (≤45 palabras). Generado: nunca es la fuente del progreso. */
async function resumenAvance(context) {
  if (!DEEPSEEK_KEY) return null;
  const text = await chatDeepSeek([
    { role: "system", content: "Eres el supervisor de proyecto de PixelTEC. Con el CHECKLIST que te doy (cada paso trae su estado: hecho, pendiente, bloqueado u omitido), escribe un mini resumen de avance para Miguel en español de México, máximo 45 palabras, texto plano sin listas ni Markdown, en tres ideas: dónde vamos (fase y paso actual), qué quedó hecho, qué falta para cerrar. Sin inventar estados. Responde solo con el resumen, sin título ni preámbulo." },
    { role: "user", content: "CHECKLIST:\n" + (context || "") },
  ], { max_tokens: 400 });
  return text.replace(/[*#]/g, "") || null;
}

/** Atajos explícitos de Miguel: «@claude» / «@supervisor» fuerzan el paso; «@deepseek» lo retiene. */
function atajo(text) {
  const t = text.trim().toLowerCase();
  if (/^@(claude|supervisor|cc)\b/.test(t)) return "supervisor";
  if (/^@deepseek\b/.test(t)) return "deepseek";
  return null;
}

async function avisarSupervisor(m) {
  await appendFile(EVENTOS, JSON.stringify({ at: m.at, id: m.id, from: "miguel", text: m.text }) + "\n");
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function notFound(res) {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("no encontrado");
}

function body(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 300_000) req.destroy(); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

/** Bitácora + estado de la corrida como Markdown (para el vault, a mano: Modelo B). */
function exportarMarkdown(proyecto, st) {
  const fmt = (iso) => (iso ? local(iso) : "—");
  const lines = [];
  const todos = proyecto.fases.flatMap((f) => f.pasos);
  const hechos = todos.filter((p) => (st.pasos[p.id] || {}).estado === "hecho");
  const porTipo = (t) => hechos.filter((p) => ((st.pasos[p.id] || {}).evidencia || {}).tipo === t).length;
  lines.push(`# Bitácora de cierre — ${proyecto.proyecto.nombre}`, "", `> ${proyecto.proyecto.objetivo}`, "", `Exportado: ${fmt(new Date().toISOString())} (${TZ}) · fuente: estado.json (plantilla ${proyecto.schema})`, "", `Avance: ${hechos.length}/${todos.length} hechos — verificados ${porTipo("verificado")} · declarados ${porTipo("declarado")} · documentados ${porTipo("documentado")}.`, "");
  for (const f of proyecto.fases) {
    const total = f.pasos.length;
    const hechos = f.pasos.filter((p) => (st.pasos[p.id] || {}).estado === "hecho").length;
    lines.push(`## ${f.titulo} — ${hechos}/${total}`, "");
    lines.push(`| Paso | Tipo | Dueño | Estado | Evidencia | Decisión |`, `|---|---|---|---|---|---|`);
    for (const p of f.pasos) {
      const e = st.pasos[p.id] || { estado: "pendiente" };
      const ev = e.evidencia ? `[${e.evidencia.tipo || "declarado"}] ${e.evidencia.quien || ""} · ${fmt(e.evidencia.cuando)} · ${e.evidencia.ref || ""}` : "";
      const extra = e.estado === "bloqueado" || e.estado === "omitido" ? ` (${e.motivo || "sin motivo"})` : "";
      lines.push(`| ${p.id} · ${p.titulo} | ${p.tipo} | ${p.dueno} | ${e.estado}${extra} | ${ev.replace(/\|/g, "/")} | ${e.decision || ""} |`);
    }
    lines.push("");
  }
  lines.push("## Bitácora cronológica", "");
  for (const b of st.bitacora) lines.push(`- ${fmt(b.at)} · **${b.tipo}** · ${b.texto}`);
  lines.push("", "## Post-arranque (día 1 a día 7)", "");
  for (const r of proyecto.post_arranque || []) {
    const fechas = (st.post || {})[r.id] || [];
    lines.push(`- ${r.cuando} · ${r.que}${r.comando ? " · `" + r.comando.replace(/\n/g, " ") + "`" : ""} — revisado: ${fechas.length ? fechas.join(", ") : "nunca"}`);
  }
  lines.push("", "## Retro de la plantilla", "");
  const retroKeys = { sobraron: "Pasos que sobraron", faltaron: "Pasos que faltaron", estimados: "Estimados que fallaron", notas: "Notas" };
  for (const [k, label] of Object.entries(retroKeys)) lines.push(`- **${label}:** ${(st.retro || {})[k] || "—"}`);
  if ((st.retro || {}).at) lines.push(`- Guardada: ${fmt(st.retro.at)}`);
  lines.push("", "## Chat (últimos 30 mensajes)", "");
  for (const m of st.messages.slice(-30)) lines.push(`- ${fmt(m.at)} · **${m.from}** · ${String(m.text).replace(/\n/g, " ")}`);
  return lines.join("\n") + "\n";
}

const ASSET_TYPES = { png: "image/png", svg: "image/svg+xml", ico: "image/x-icon", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", woff: "font/woff", woff2: "font/woff2" };

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(await readFile(join(DIR, "index.html")));
      return;
    }
    const asset = /^\/((?:fonts\/)?[a-z0-9._-]+\.(png|svg|ico|webp|jpg|jpeg|css|js|woff2?))$/i.exec(url.pathname);
    if (req.method === "GET" && asset) {
      try {
        const data = await readFile(join(DIR, asset[1]));
        res.writeHead(200, { "content-type": ASSET_TYPES[asset[2].toLowerCase()] || "application/octet-stream", "cache-control": "public, max-age=3600" });
        res.end(data);
      } catch { notFound(res); }
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/proyecto") {
      json(res, 200, await leerProyecto());
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/estado") {
      json(res, 200, { ...(await leer()), typing });
      return;
    }
    // Cambio de estado de un paso: hecho exige «Verifica» y evidencia (quién/cuándo se
    // completan aquí) y, en decisiones, la opción elegida; bloqueado/omitido exigen motivo.
    if (req.method === "POST" && url.pathname === "/api/paso") {
      const b = await body(req);
      const pid = String(b.id || "");
      if (!/^s\d-\d+$/.test(pid) || !ESTADOS.includes(b.estado)) return json(res, 400, { error: "paso/estado inválido" });
      const proyecto = await leerProyecto();
      const paso = proyecto.fases.flatMap((f) => f.pasos).find((p) => p.id === pid);
      if (!paso) return json(res, 404, { error: "paso desconocido" });
      const st = await leer();
      const prev = st.pasos[pid] || { estado: "pendiente" };
      const next = { ...prev, estado: b.estado };
      delete next.nota;
      if (b.estado === "hecho") {
        if (!paso.verifica) return json(res, 422, { error: "El paso no tiene criterio «Verifica»: no se puede marcar hecho." });
        if (paso.tipo === "decision" && !(b.decision && (paso.opciones || []).includes(b.decision))) return json(res, 422, { error: "Elige la opción antes de marcar la decisión." });
        if (prev.estado !== "hecho" || b.ref !== undefined) {
          const tipo = EVIDENCIA_TIPOS.includes(b.tipo) ? b.tipo : ((prev.evidencia || {}).tipo || "declarado");
          next.evidencia = { tipo, quien: String(b.quien || "Miguel").slice(0, 60), cuando: prev.estado === "hecho" && prev.evidencia ? prev.evidencia.cuando : new Date().toISOString(), ref: String(b.ref ?? (prev.evidencia || {}).ref ?? "").slice(0, 400) };
        }
        if (paso.tipo === "decision") next.decision = b.decision;
        delete next.motivo;
      } else if (b.estado === "bloqueado" || b.estado === "omitido") {
        if (!String(b.motivo || "").trim()) return json(res, 422, { error: "Indica el motivo." });
        next.motivo = String(b.motivo).slice(0, 300);
      } else {
        delete next.motivo;
      }
      if (paso.tipo === "externo" && b.externo && typeof b.externo === "object") next.externo = { ...(prev.externo || {}), ...b.externo };
      st.pasos[pid] = next;
      if (b.estado !== prev.estado) {
        const tail = b.estado === "hecho" ? (next.decision ? ` · decisión: ${next.decision}` : "") + (next.evidencia ? ` · ${next.evidencia.tipo}` : "") + (next.evidencia && next.evidencia.ref ? ` · ${next.evidencia.ref}` : "") : next.motivo ? ` · ${next.motivo}` : "";
        bitacora(st, b.estado === "hecho" ? "hecho" : b.estado === "bloqueado" ? "bloqueo" : b.estado === "omitido" ? "omitido" : "reabierto", `${pid} · ${paso.titulo} — ${b.quien || "Miguel"}${tail}`);
      } else if (b.externo) {
        bitacora(st, "externo", `${pid} · ${paso.titulo} — seguimiento: ${Object.entries(b.externo).map(([k, v]) => `${k}=${v || "—"}`).join(", ")}`);
      }
      await guardar(st);
      json(res, 200, { ...st, typing });
      return;
    }
    // Post-arranque: cada ítem guarda las fechas en que se revisó (marcar/desmarcar hoy).
    if (req.method === "POST" && url.pathname === "/api/post") {
      const b = await body(req);
      const pid = String(b.id || "");
      const proyecto = await leerProyecto();
      const item = (proyecto.post_arranque || []).find((r) => r.id === pid);
      if (!item) return json(res, 404, { error: "ítem desconocido" });
      const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(b.dia || "")) ? b.dia : stampArchivo().slice(0, 10);
      const st = await leer();
      const fechas = new Set(st.post[pid] || []);
      if (b.hecho === false) fechas.delete(dia); else fechas.add(dia);
      st.post[pid] = [...fechas].sort();
      bitacora(st, "post-arranque", `${pid} · ${item.que.slice(0, 80)} — ${b.hecho === false ? "desmarcado" : "revisado"} ${dia}`);
      await guardar(st);
      json(res, 200, { ...st, typing });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/retro") {
      const b = await body(req);
      const st = await leer();
      st.retro = { sobraron: String(b.sobraron || "").slice(0, 2000), faltaron: String(b.faltaron || "").slice(0, 2000), estimados: String(b.estimados || "").slice(0, 2000), notas: String(b.notas || "").slice(0, 2000), at: new Date().toISOString() };
      bitacora(st, "retro", "Retro de la plantilla actualizada");
      await guardar(st);
      json(res, 200, { ...st, typing });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/exportar") {
      const proyecto = await leerProyecto();
      const st = await leer();
      await mkdir(EXPORT_DIR, { recursive: true });
      const name = `bitacora-${proyecto.proyecto.nombre}-${stampArchivo()}.md`;
      await writeFile(join(EXPORT_DIR, name), exportarMarkdown(proyecto, st), "utf8");
      // Exportar no es un evento de la corrida: no entra en la bitácora.
      json(res, 200, { ...st, typing, archivo: `export/${name}` });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/resumen") {
      const { context, sig, force } = await body(req);
      const st = await leer();
      if (!DEEPSEEK_KEY || typeof sig !== "string" || (!force && st.resumen && st.resumen.sig === sig)) return json(res, 200, { ...st, typing });
      try {
        const text = await resumenAvance(context);
        const fresh = await leer();
        if (text) { fresh.resumen = { text, sig, at: new Date().toISOString() }; await guardar(fresh); }
        json(res, 200, { ...fresh, typing });
      } catch (e) {
        console.error("[resumen]", e.message);
        json(res, 200, { ...(await leer()), typing });
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/mensaje") {
      const { text, context } = await body(req);
      const t = String(text || "").trim().slice(0, 2000);
      if (!t) return json(res, 400, { error: "vacío" });
      const st = await leer();
      const m = { id: id("m"), from: "miguel", text: t, at: new Date().toISOString() };
      const forzado = atajo(t);
      if (!DEEPSEEK_KEY || forzado === "supervisor") {
        m.route = "supervisor";
        st.messages.push(m);
        await guardar(st);
        await avisarSupervisor(m);
        json(res, 200, { ...st, typing: false, quick: DEEPSEEK_KEY ? "supervisor" : "sin-key" });
        return;
      }
      m.route = "pendiente";
      st.messages.push(m);
      await guardar(st);
      typing = true;
      json(res, 200, { ...st, typing, quick: "deepseek" });
      triaje(context, st.messages)
        .then(async (r) => {
          const destino = forzado === "deepseek" ? "deepseek" : (r ? r.destino : "supervisor");
          const fresh = await leer();
          const mine = fresh.messages.find((x) => x.id === m.id);
          if (mine) mine.route = destino;
          if (r && r.respuesta) fresh.messages.push({ id: id("d"), from: "deepseek", text: r.respuesta, at: new Date().toISOString(), route: destino });
          await guardar(fresh);
          if (destino === "supervisor") await avisarSupervisor(m);
        })
        .catch(async (e) => {
          console.error("[deepseek]", e.message);
          const fresh = await leer();
          const mine = fresh.messages.find((x) => x.id === m.id);
          if (mine) mine.route = "supervisor";
          fresh.messages.push({ id: id("d"), from: "deepseek", text: "No pude atenderlo ahora; lo paso al Supervisor General (Claude Code).", at: new Date().toISOString(), route: "supervisor" });
          await guardar(fresh);
          await avisarSupervisor(m);
        })
        .finally(() => { typing = false; });
      return;
    }
    notFound(res);
  } catch (e) {
    console.error(e);
    json(res, 500, { error: "servidor" });
  }
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log(`El checklist ya está corriendo: abre http://localhost:${PORT}`);
    console.log(`(si quieres otra instancia: PORT=${PORT + 1} node servidor.mjs)`);
    process.exit(0);
  }
  throw e;
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`checklist local → http://localhost:${PORT}  (estado: ${ESTADO})`);
  console.log(DEEPSEEK_KEY ? `supervisor de proyecto: DeepSeek ${DEEPSEEK_MODEL}` : "supervisor de proyecto: apagado (sin DEEPSEEK_API_KEY); todo va al Supervisor");
});
