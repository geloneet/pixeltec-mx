export interface Item { title: string; href: string; category: string; visual: string; }
export const services: Item[] = [
  {title:'Automatización con IA',href:'/services/automatizacion/',category:'Flujos · Integraciones · IA',visual:'orbit'},
  {title:'Desarrollo Web & Apps',href:'/services/ecosistemas-web/',category:'Web · Plataformas · Experiencias',visual:'web'},
  {title:'WhatsApp IA',href:'/pixelbot/',category:'Conversación · Atención · Ventas',visual:'chat'},
  {title:'Consultoría & Soporte TI',href:'/services/consultoria/',category:'Estrategia · Procesos · Soporte',visual:'grid'}
];
export const projects: Item[] = [
  {title:'Villa Nogal',href:'/proyectos/villa-nogal/',category:'Web',visual:'hotel'},
  {title:'Pipas Tondoroque',href:'/proyectos/pipas-tondoroque/',category:'Automatización',visual:'dashboard'},
  {title:'Barro Stock',href:'/proyectos/barro-stock/',category:'Web',visual:'store'},
  {title:'Smile More',href:'/proyectos/smile-more/',category:'Plataformas',visual:'clinic'},
  {title:'Materiales de Barro',href:'/proyectos/materiales-de-barro/',category:'Web',visual:'store'}
];
export const industries: Item[] = [
  {title:'Salud dental',href:'/industrias/clinicas-dentales/',category:'Agenda · Expediente · Operación',visual:'clinic'},
  {title:'Hotelería',href:'/industrias/hoteles/',category:'Reservas · Experiencia · Hospitalidad',visual:'hotel'},
  {title:'Logística y transporte',href:'/industrias/#logistica',category:'Coordinación · Procesos',visual:'dashboard'},
  {title:'Distribución de agua',href:'/industrias/#agua',category:'Servicio · Operación',visual:'orbit'},
  {title:'Comercio especializado',href:'/industrias/#comercio',category:'Catálogo · Experiencia',visual:'store'},
  {title:'Energía solar',href:'/industrias/#solar',category:'Información · Contacto',visual:'grid'}
];
export const posts: Item[] = [
  {title:'Sistemas que le devuelven tiempo a tu equipo.',href:'/blog/sistema-administrativo-para-eficientar-tu-pyme-en-mexico/',category:'Operación',visual:'dashboard'},
  {title:'De procesos manuales a una operación conectada.',href:'/blog/como-automatizar-procesos-manuales-en-mi-negocio-guia-real/',category:'Automatización',visual:'orbit'},
  {title:'El criterio humano detrás de la inteligencia artificial.',href:'/blog/que-datos-nunca-deberias-compartir-con-chatgpt-gemini-o-claude-en-tu-empresa/',category:'IA',visual:'grid'},
  {title:'Conversaciones que se convierten en oportunidades.',href:'/blog/agente-de-ia-en-whatsapp-para-mi-negocio/',category:'IA',visual:'chat'},
  {title:'Un punto de partida para transformar tu negocio.',href:'/blog/ia-para-pymes-en-mexico-guia-honesta-para-empezar-sin-quemar-dinero/',category:'Estrategia',visual:'web'}
];
export const nav = [['Servicios','/services/'],['Proyectos','/proyectos/'],['Industrias','/industrias/'],['Nosotros','/about/']] as const;
export const escapeHTML = (s:string):string => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c));
