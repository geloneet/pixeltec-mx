import {escapeHTML as esc} from './catalog.js';
import {localPath,type Locale} from './i18n.js';

export const canonicalPath=(path:string):string=>path==='/'?'':path.replace(/\/$/,'');
export const canonicalURL=(path:string):string=>'https://pixeltec.mx'+canonicalPath(path);
const excluded=new Set(['/login/','/reset-password/','/metodologia/','/guias-transformacion/','/404/','/mapa/']);
const completeEnglish=new Set(['/','/services/','/services/automatizacion/','/services/ecosistemas-web/','/services/consultoria/','/pixelbot/','/about/','/equipo/','/proyectos/','/industrias/','/industrias/clinicas-dentales/','/industrias/hoteles/','/blog/','/contact/','/diagnostico/']);
export const englishComplete=(path:string):boolean=>completeEnglish.has(path)||path.startsWith('/proyectos/');
export function indexPolicy(path:string,locale:Locale):{eligible:boolean;reason:string} {
 if(excluded.has(path))return {eligible:false,reason:'Private, utility or existing editorial exclusion'};
 if(locale==='en'&&!englishComplete(path))return {eligible:false,reason:'Full English translation pending'};
 return {eligible:true,reason:'SEO candidate; release requires content and functional gates'};
}
export function languageAlternates(path:string):string {
 if(!indexPolicy(path,'es').eligible||!indexPolicy(path,'en').eligible)return '';
 return [['es-MX',path],['en',localPath(path,'en')],['x-default',path]].map(([lang,p])=>`<link rel="alternate" hreflang="${lang}" href="${canonicalURL(p!)}">`).join('');
}
export function pageDescription(body:string,title:string,locale:Locale):string {
 const intro=body.match(/class="hero-bottom"><p>([\s\S]*?)<\/p>/)?.[1];
 if(intro)return intro.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&');
 const text:Record<string,[string,string]>={
  'Diagnóstico':['Cuatro preguntas para ordenar las necesidades de tu negocio y preparar una conversación con PixelTEC.','Four questions to organize your business needs and prepare a conversation with PixelTEC.'],
  'Assessment':['Cuatro preguntas para ordenar las necesidades de tu negocio.','Four questions to organize your business needs and prepare a conversation with PixelTEC.']
 };
 return text[title]?.[locale==='es'?0:1]??(locale==='es'?`${title}: información y recursos de PixelTEC.`:`${title}: information and resources from PixelTEC.`);
}
export function socialMetadata(title:string,description:string,path:string,locale:Locale):string {
 return `<meta property="og:type" content="website"><meta property="og:site_name" content="PixelTEC"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonicalURL(path)}"><meta property="og:locale" content="${locale==='es'?'es_MX':'en_US'}"><meta property="og:image" content="https://pixeltec.mx/og-image.png"><meta name="twitter:card" content="summary_large_image">`;
}
