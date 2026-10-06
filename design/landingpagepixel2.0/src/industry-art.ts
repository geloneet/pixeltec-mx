import type { Locale } from './i18n.js';
import { escapeHTML as esc } from './catalog.js';
/** Conceptual 3D graphics, generated as a coherent visual collection. */
export function industryArt(id:string,locale:Locale):string {
 const labels:Record<string,[string,string]>={salud:['Agenda y atención dental','Dental care and scheduling'],hoteleria:['Hospitalidad y reservas','Hospitality and bookings'],logistica:['Transporte y rutas conectadas','Transport and connected routes'],agua:['Distribución y gestión del agua','Water distribution and management'],comercio:['Moda y comercio digital','Fashion and digital commerce'],solar:['Sistemas de energía solar','Solar energy systems']};
 const label=labels[id];if(!label)return '';
 const alt=(locale==='es'?'Ilustración 3D conceptual: ':'Conceptual 3D illustration: ')+label[locale==='es'?0:1];
 return `<figure class="art sector-art sector-${esc(id)}"><img src="/assets/industries/${id}-3d-640.webp" srcset="/assets/industries/${id}-3d-640.webp 640w, /assets/industries/${id}-3d-1280.webp 1280w" sizes="(max-width:560px) 90vw, (max-width:1440px) 44vw, 620px" width="1536" height="1024" loading="lazy" decoding="async" alt="${esc(alt)}"></figure>`;
}
