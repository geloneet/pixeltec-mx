#!/usr/bin/env node
/**
 * Validación del esquema «pixeltec-cierre/v2» de proyecto.json.
 * Las reglas de la UI viven también aquí: un proyecto.json llenado a mano
 * que las rompa no arranca el servidor.
 *
 *   node validar.mjs [ruta/proyecto.json]   → exit 0 si es válido; lista de errores y exit 1 si no.
 *   import { validarProyecto } from "./validar.mjs"  → { errores: string[] }
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TIPOS = ["accion", "verificacion", "decision", "externo"];
const DUENOS = ["miguel", "worker", "meta"];
const PRE_ESTADOS = ["ok", "parcial", "en-espera", "falta"];

export function validarProyecto(p) {
  const e = [];
  const str = (v) => typeof v === "string" && v.trim().length > 0;
  if (!p || typeof p !== "object") return { errores: ["proyecto.json no es un objeto"] };
  if (p.schema !== "pixeltec-cierre/v2") e.push(`schema debe ser "pixeltec-cierre/v2" (hay: ${JSON.stringify(p.schema)})`);
  if (!p.proyecto || !str(p.proyecto.nombre)) e.push("proyecto.nombre es obligatorio");
  if (!p.proyecto || !str(p.proyecto.objetivo)) e.push("proyecto.objetivo es obligatorio");
  if (!Array.isArray(p.parametros)) e.push("parametros debe ser una lista (puede ir vacía)");
  else p.parametros.forEach((x, i) => { if (!str(x.k) || !str(x.v)) e.push(`parametros[${i}] necesita k y v`); });
  if (!Array.isArray(p.prerrequisitos)) e.push("prerrequisitos debe ser una lista (puede ir vacía)");
  else p.prerrequisitos.forEach((x, i) => {
    if (!str(x.id) || !str(x.titulo) || !str(x.quien)) e.push(`prerrequisitos[${i}] necesita id, titulo y quien`);
    if (!PRE_ESTADOS.includes(x.estado)) e.push(`prerrequisitos[${i}] (${x.id}): estado debe ser ${PRE_ESTADOS.join("|")}`);
  });
  if (!p.hero || !str(p.hero.titulo)) e.push("hero.titulo es obligatorio");
  if (p.hero && Array.isArray(p.hero.tiles)) p.hero.tiles.forEach((t, i) => { if (!str(t.k) || !str(t.v)) e.push(`hero.tiles[${i}] necesita k y v`); });
  if (!Array.isArray(p.fases) || !p.fases.length) { e.push("fases debe ser una lista con al menos una fase"); return { errores: e }; }
  const faseIds = new Set(), pasoIds = new Set();
  p.fases.forEach((f, fi) => {
    const fid = f.id || `fases[${fi}]`;
    if (!str(f.id)) e.push(`fases[${fi}] necesita id`);
    else if (faseIds.has(f.id)) e.push(`fase ${f.id}: id repetido`); else faseIds.add(f.id);
    if (!str(f.titulo)) e.push(`fase ${fid}: titulo obligatorio`);
    if (!f.dod || !str(f.dod.inicio) || !str(f.dod.fin)) e.push(`fase ${fid}: dod.inicio y dod.fin (definición de terminado) obligatorios`);
    if (!str(f.contingencia)) e.push(`fase ${fid}: contingencia obligatoria`);
    if (!Array.isArray(f.pasos) || !f.pasos.length) { e.push(`fase ${fid}: necesita al menos un paso`); return; }
    f.pasos.forEach((s, si) => {
      const sid = s.id || `${fid}.pasos[${si}]`;
      if (!str(s.id) || !/^s\d+-\d+$/.test(s.id)) e.push(`paso ${sid}: id con forma s<fase>-<n> (ej. s1-2)`);
      else if (pasoIds.has(s.id)) e.push(`paso ${s.id}: id repetido`); else pasoIds.add(s.id);
      if (!TIPOS.includes(s.tipo)) e.push(`paso ${sid}: tipo debe ser ${TIPOS.join("|")}`);
      if (!str(s.titulo)) e.push(`paso ${sid}: titulo obligatorio`);
      if (!DUENOS.includes(s.dueno)) e.push(`paso ${sid}: dueno debe ser ${DUENOS.join("|")}`);
      if (typeof s.estimado_min !== "number" || s.estimado_min < 0) e.push(`paso ${sid}: estimado_min numérico (minutos)`);
      if (!str(s.verifica)) e.push(`paso ${sid}: «verifica» obligatorio (sin criterio no se puede marcar hecho)`);
      if (!str(s.rollback)) e.push(`paso ${sid}: rollback obligatorio (escribe «No aplica.» si no hay)`);
      if (s.tipo === "decision" && !(Array.isArray(s.opciones) && s.opciones.length >= 2 && s.opciones.every(str))) e.push(`paso ${sid}: una decisión necesita al menos 2 opciones`);
      if (s.tipo !== "decision" && s.opciones) e.push(`paso ${sid}: opciones solo aplica a tipo decision`);
      if (s.tipo === "externo" && (!s.externo || typeof s.externo !== "object")) e.push(`paso ${sid}: un paso externo necesita el bloque externo {enviado, eta, consultado, quien_decide}`);
      if (s.comando != null && typeof s.comando !== "string") e.push(`paso ${sid}: comando debe ser texto o null`);
    });
  });
  p.fases.forEach((f) => {
    if (f.gate_requiere != null) {
      if (!faseIds.has(f.gate_requiere)) e.push(`fase ${f.id}: gate_requiere apunta a una fase inexistente (${f.gate_requiere})`);
      if (f.gate_requiere === f.id) e.push(`fase ${f.id}: gate_requiere no puede apuntar a sí misma`);
    }
  });
  (p.decisiones || []).forEach((d, i) => {
    if (!str(d.id) || !str(d.texto)) e.push(`decisiones[${i}] necesita id y texto`);
    if (d.paso != null && !pasoIds.has(d.paso)) e.push(`decisión ${d.id}: paso ${d.paso} no existe`);
    if (d.estado && !["pendiente", "hecha"].includes(d.estado)) e.push(`decisión ${d.id}: estado debe ser pendiente|hecha`);
  });
  (p.post_arranque || []).forEach((r, i) => {
    if (!str(r.id) || !str(r.cuando) || !str(r.que)) e.push(`post_arranque[${i}] necesita id, cuando y que`);
  });
  const postIds = (p.post_arranque || []).map((r) => r.id);
  if (new Set(postIds).size !== postIds.length) e.push("post_arranque: ids repetidos");
  return { errores: e };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const ruta = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "proyecto.json");
  let p;
  try { p = JSON.parse(await readFile(ruta, "utf8")); } catch (err) { console.error(`✗ ${ruta}: ${err.message}`); process.exit(1); }
  const { errores } = validarProyecto(p);
  if (errores.length) { console.error(`✗ ${ruta}: ${errores.length} error(es)`); errores.forEach((x) => console.error("  - " + x)); process.exit(1); }
  const pasos = p.fases.reduce((a, f) => a + f.pasos.length, 0);
  console.log(`✓ ${ruta}: válido · ${p.fases.length} fases · ${pasos} pasos · ${(p.decisiones || []).length} decisiones`);
}
