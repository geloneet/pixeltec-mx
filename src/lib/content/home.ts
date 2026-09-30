/**
 * Copy y metadata SEO de la portada (WO-2026-00343).
 *
 * Módulo puro (sin React, sin `next`) para que el test lo importe sin arrastrar
 * `src/app/page.tsx`, que carga server actions y la base de datos. Todo texto
 * del primer viewport y de «Nosotros» sale de aquí; los componentes solo lo
 * pintan. Textos aprobados por Miguel el 2026-09-14 (gate copy-verdict).
 */

export const HOME_SEO = {
  /**
   * 63 caracteres: Miguel eligió (2026-09-14) «Automatización con IA» completo
   * en vez de la variante corta de 59. Si Google lo recorta, lo hace por el
   * final —después de la geo—, así que intención y ciudad sobreviven.
   * La raíz NO recibe el template `%s | PixelTEC` del layout (Next no aplica el
   * template al mismo segmento que lo declara): este texto sale tal cual.
   */
  title: 'Desarrollo Web, Apps y Automatización con IA en Puerto Vallarta',
  /** ≤ 155. */
  description:
    'Desarrollo web y apps, software a medida y automatización con IA y WhatsApp para pymes de Puerto Vallarta, Bahía de Banderas, Guadalajara y México.',
} as const;

export const HOME_HERO = {
  title1: 'Desarrollo Web, Apps y Software',
  title2: 'Automatización para empresas',
  subtitle:
    'Creamos páginas web, aplicaciones y software a la medida. Automatizamos procesos con IA, WhatsApp e integraciones para que tu empresa opere mejor y pierda menos tiempo en tareas repetitivas.',
} as const;

export const HOME_ABOUT = {
  headingLead: 'Arquitectos de tu transformación digital',
  headingAccent: 'desde Puerto Vallarta',
  paragraph:
    'No somos una agencia tradicional de desarrollo web. En PixelTEC la tecnología es un medio, no el fin: combinamos consultoría TI, inteligencia artificial y desarrollo de software a la medida para que pymes y empresas de Puerto Vallarta, Guadalajara y todo México operen y escalen sin fricción.',
} as const;

/** Párrafo bajo el H2 de Servicios; solo se aplica si no hay conflicto con el PR #136. */
export const HOME_SERVICES_INTRO =
  'Desde una página web o una app a la medida hasta un agente de IA en WhatsApp: tres servicios para pymes y empresas que quieren operar sin fricción y crecer con control.';
