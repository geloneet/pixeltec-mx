#!/usr/bin/env node
/**
 * Respuesta del Supervisor al chat local, escrita directo en estado.json
 * (la página la muestra en ≤3 s sin recargar).
 *
 *   node responder.mjs "texto de la respuesta"
 *   echo "texto" | node responder.mjs
 *   node responder.mjs --check s2-1 --on     (marca un paso; --off lo desmarca)
 */
import { readFile, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const ESTADO = join(DIR, "estado.json");
const args = process.argv.slice(2);

const st = JSON.parse(await readFile(ESTADO, "utf8"));
st.checks = st.checks || {};
st.messages = st.messages || [];

const checkIdx = args.indexOf("--check");
if (checkIdx >= 0) {
  const id = args[checkIdx + 1];
  const on = !args.includes("--off");
  if (!/^s\d-\d+$/.test(id || "")) { console.error("id inválido (ej. s2-1)"); process.exit(2); }
  st.checks[id] = on;
  console.log(`${id} → ${on ? "hecho" : "pendiente"}`);
} else {
  let text = args.join(" ").trim();
  if (!text) text = (await new Promise((r) => { let d = ""; process.stdin.on("data", (c) => (d += c)); process.stdin.on("end", () => r(d)); })).trim();
  if (!text) { console.error("falta el texto"); process.exit(2); }
  st.messages.push({ id: "sup" + Date.now().toString(36), from: "supervisor", text, at: new Date().toISOString() });
  console.log(`respuesta guardada (${text.length} caracteres)`);
}
st.updatedAt = new Date().toISOString();
await writeFile(ESTADO + ".tmp", JSON.stringify(st, null, 1), "utf8");
await rename(ESTADO + ".tmp", ESTADO);
