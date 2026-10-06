import type { Locale } from './i18n.js';
import { escapeHTML as esc } from './catalog.js';
/** Supplied project screenshots plus explicitly identified AI sector imagery. */
export function industryArt(id:string,locale:Locale):string {
 const x=(es:string,en:string):string=>locale==='es'?es:en;
 const assets:Record<string,{file:string;name:string;concept?:boolean}>={
  salud:{file:'projects/smile-more',name:'Smile More'},
  hoteleria:{file:'projects/villa-nogal',name:'Villa Nogal'},
  logistica:{file:'projects/transportes-sanchez-jr',name:'Transportes Sánchez JR'},
  comercio:{file:'projects/velank',name:'Velank'},
  agua:{file:'industries/water',name:x('Distribución de agua','Water distribution'),concept:true},
  solar:{file:'industries/solar',name:x('Energía solar','Solar energy'),concept:true}
 };
 const asset=assets[id];if(!asset)return '';
 const label=asset.concept?x('Imagen conceptual · IA','Concept image · AI'):x('Proyecto PixelTEC','PixelTEC project');
 const alt=asset.concept?x(`Imagen conceptual generada con IA: ${asset.name}`,`AI-generated conceptual image: ${asset.name}`):x(`Captura del sitio de ${asset.name}`,`${asset.name} website screenshot`);
 return `<figure class="art sector-art sector-${esc(id)} ${asset.concept?'sector-photo':'sector-project'}"><img src="/assets/${asset.file}-640.webp" srcset="/assets/${asset.file}-640.webp 640w, /assets/${asset.file}-1280.webp 1280w" sizes="(max-width:560px) 90vw, (max-width:1440px) 44vw, 620px" width="1280" height="853" loading="lazy" decoding="async" alt="${esc(alt)}"><figcaption><span>${label}</span><strong>${esc(asset.name)}</strong></figcaption></figure>`;
}
