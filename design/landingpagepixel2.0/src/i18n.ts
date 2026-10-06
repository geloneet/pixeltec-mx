export type Locale = 'es' | 'en';
export interface Bilingual {es:string; en:string;}
export const bi = (es:string,en:string):Bilingual=>({es,en});
export const text = (value:Bilingual,locale:Locale):string=>value[locale];
export const localPath = (path:string,locale:Locale):string => {
  if(!path.startsWith('/')||path.startsWith('//')||/\.[a-z0-9]+(?:[?#]|$)/i.test(path))return path;
  return locale==='en'?'/en'+path:path;
};
export const languages:readonly Locale[]=['es','en'];
export const langSwitch=(path:string,locale:Locale):string=>`<a class="language-link" href="${localPath(path,locale==='es'?'en':'es')}" lang="${locale==='es'?'en':'es'}" hreflang="${locale==='es'?'en':'es-MX'}" aria-label="${locale==='es'?'Read this page in English':'Leer esta página en español'}">${locale==='es'?'EN':'ES'}<span aria-hidden="true">↗</span></a>`;
