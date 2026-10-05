// Adapted from ../../src/lib/diagnostic/logic.ts: original scoring and recommendation rules, 2026-10-05.
import {strictObject,enum as enumSchema,array,minLength,maxLength} from 'zod/mini';
export interface Option {
  value: string;
  label: string;
}

export interface CompanyTypeOption extends Option {}

/**
 * CON-05 (WO-2026-00268): el catálogo eran nueve genéricos que no coincidían
 * con los seis sectores que el sitio declara servir de verdad
 * (`components/sections/industries-strip.tsx` y `/industrias`), así que quien
 * llegaba desde una de esas páginas tenía que elegir «Servicios» u «Otra» para
 * describir su distribuidora de agua o su empresa de paneles solares. Se
 * añaden `agua`, `solar` y `retail`; los valores existentes NO cambian, para
 * no invalidar los leads ya guardados con el valor anterior.
 */
export const COMPANY_TYPES: CompanyTypeOption[] = [
  { value: 'constructora', label: 'Constructora' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'clinica', label: 'Clínica o consultorio' },
  { value: 'ecommerce', label: 'Ecommerce' },
  { value: 'retail', label: 'Moda y retail' },
  { value: 'logistica', label: 'Logística' },
  { value: 'agua', label: 'Distribución de agua' },
  { value: 'solar', label: 'Energía solar' },
  { value: 'restaurante', label: 'Restaurante' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'industria', label: 'Industria' },
  { value: 'otra', label: 'Otra' },
];

export const PROBLEMS: Option[] = [
  { value: 'manual', label: 'Mucho trabajo manual' },
  { value: 'pierdo_clientes', label: 'Pierdo clientes' },
  { value: 'excel', label: 'Todo lo hago en Excel' },
  { value: 'no_sistema', label: 'No tengo sistema' },
  { value: 'pagina_no_vende', label: 'Mi página no vende' },
  { value: 'automatizar', label: 'Necesito automatizar' },
  { value: 'ia', label: 'Necesito IA' },
  { value: 'app', label: 'Quiero una App' },
  { value: 'otro', label: 'Otro' },
];

export const COMPANY_SIZES: Option[] = [
  { value: '1-5', label: '1-5 empleados' },
  { value: '6-20', label: '6-20 empleados' },
  { value: '20-50', label: '20-50 empleados' },
  { value: '50+', label: '50+ empleados' },
];

export const PRIORITIES: Option[] = [
  { value: 'vender_mas', label: 'Vender más' },
  { value: 'ahorrar_tiempo', label: 'Ahorrar tiempo' },
  { value: 'organizar', label: 'Organizar mi empresa' },
  { value: 'automatizar', label: 'Automatizar procesos' },
  { value: 'crear_software', label: 'Crear software' },
];

const SERVICE_LABELS: Record<string, string> = {
  crm: 'CRM personalizado',
  automation_ia: 'Automatización con IA',
  dashboard: 'Dashboard ejecutivo',
  ecommerce: 'Tienda en línea / E-commerce',
  web: 'Sitio web de alto rendimiento',
  app: 'App móvil a medida',
};

// ─── Respuestas del wizard ──────────────────────────────────────────────────

export interface DiagnosticAnswers {
  companyType: string;
  problems: string[];
  companySize: string;
  priority: string;
  name: string;
  email: string;
  phone?: string;
  empresa?: string;
}

export interface DiagnosticResult {
  score: number;
  strengths: string[];
  opportunities: string[];
  recommendedServices: string[];
  timeline: string;
}

const SIZE_BONUS: Record<string, number> = { '1-5': 0, '6-20': 5, '20-50': 10, '50+': 15 };

// Problems that signal LOW digital maturity (penalize score). "automatizar",
// "ia", "app" and "otro" are forward-looking asks, not immaturity signals —
// they don't penalize.
const IMMATURITY_PROBLEMS = new Set(['manual', 'pierdo_clientes', 'excel', 'no_sistema', 'pagina_no_vende']);

const OPPORTUNITY_BY_PROBLEM: Record<string, string> = {
  manual: 'Reducir tareas manuales repetitivas.',
  pierdo_clientes: 'Implementar seguimiento automático de leads y clientes.',
  excel: 'Centralizar información fuera de hojas de cálculo dispersas.',
  no_sistema: 'Adoptar un sistema central (CRM/ERP) para tu operación.',
  pagina_no_vende: 'Optimizar tu sitio web para conversión.',
  automatizar: 'Automatizar procesos clave con integraciones e IA.',
  ia: 'Incorporar IA en atención a clientes y operación.',
  app: 'Desarrollar una app a medida para tu operación.',
  otro: 'Diagnosticar a fondo tu necesidad específica.',
};

const DEFAULT_OPPORTUNITIES = [
  'Centralizar información.',
  'Reducir tareas manuales.',
  'Automatizar seguimiento de clientes.',
];

/** Deterministic scoring + recommendation engine. Same input ⇒ same output. */
export function computeDiagnostic(answers: DiagnosticAnswers): DiagnosticResult {
  const problems = answers.problems ?? [];

  // ── Score (0-100, "madurez digital") ──
  let score = 70;
  for (const p of problems) {
    if (IMMATURITY_PROBLEMS.has(p)) score -= 8;
  }
  score += SIZE_BONUS[answers.companySize] ?? 0;
  score = Math.max(5, Math.min(95, score));

  // ── Strengths ──
  const strengths: string[] = [];
  if (!problems.includes('no_sistema')) {
    strengths.push('Ya utilizas herramientas digitales.');
  }
  if (!problems.includes('excel')) {
    strengths.push('No dependes por completo de hojas de cálculo dispersas.');
  }
  if (answers.companySize === '20-50' || answers.companySize === '50+') {
    strengths.push('Tu equipo tiene el tamaño suficiente para justificar automatización a escala.');
  }
  if (answers.priority === 'automatizar' || answers.priority === 'crear_software') {
    strengths.push('Ya identificas con claridad hacia dónde quieres llevar tu operación.');
  }
  if (strengths.length === 0) {
    strengths.push('Diste el primer paso al evaluar la madurez digital de tu empresa.');
  }
  if (strengths.length === 1) {
    strengths.push('Existe una oportunidad clara de automatización en tu operación.');
  }

  // ── Opportunities ──
  const opportunities = Array.from(
    new Set(problems.filter((p) => p !== 'otro').map((p) => OPPORTUNITY_BY_PROBLEM[p]).filter((value):value is string=>typeof value==='string'))
  ).slice(0, 4);
  if (opportunities.length === 0) opportunities.push(...DEFAULT_OPPORTUNITIES);

  // ── Recommended services ──
  const services = new Set<string>();
  if (problems.includes('pierdo_clientes') || problems.includes('no_sistema')) services.add('crm');
  if (problems.includes('manual') || problems.includes('automatizar') || problems.includes('ia')) {
    services.add('automation_ia');
  }
  if (problems.includes('excel') || problems.includes('no_sistema')) services.add('dashboard');
  // `retail` entra aquí con `ecommerce` (CON-05): una tienda de moda o comercio
  // especializado necesita vender en línea igual que un ecommerce puro. El
  // resto del scoring no distingue por tipo de empresa, así que los demás
  // valores nuevos (`agua`, `solar`) no alteran ningún resultado existente.
  if (answers.companyType === 'ecommerce' || answers.companyType === 'retail') services.add('ecommerce');
  if (problems.includes('pagina_no_vende')) services.add('web');
  if (problems.includes('app') || answers.priority === 'crear_software') services.add('app');
  if (services.size === 0) {
    services.add('crm');
    services.add('automation_ia');
    services.add('dashboard');
  }
  const recommendedServices = Array.from(services)
    .slice(0, 4)
    .map((key) => SERVICE_LABELS[key]!).filter((value):value is string=>typeof value==='string');

  // ── Timeline ──
  let timeline = '6-8 semanas';
  if (recommendedServices.length >= 4 || answers.companySize === '50+') {
    timeline = '8-12 semanas';
  } else if (recommendedServices.length <= 2 && (answers.companySize === '1-5' || answers.companySize === '6-20')) {
    timeline = '4-6 semanas';
  }

  return { score, strengths, opportunities, recommendedServices, timeline };
}


export const diagnosticSchema=strictObject({companyType:enumSchema(COMPANY_TYPES.map(o=>o.value)),problems:array(enumSchema(PROBLEMS.map(o=>o.value))).check(minLength(1),maxLength(PROBLEMS.length)),companySize:enumSchema(COMPANY_SIZES.map(o=>o.value)),priority:enumSchema(PRIORITIES.map(o=>o.value))});
export function evaluateDiagnostic(input:unknown):DiagnosticResult {const answers=diagnosticSchema.parse(input);return computeDiagnostic({...answers,problems:[...new Set(answers.problems)],name:'',email:''});}
