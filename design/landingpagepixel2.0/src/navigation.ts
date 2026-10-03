import {bi,type Locale,localPath} from './i18n.js';
// Public pixeltec.mx header, observed 2026-10-03. Keep existing URL suffixes.
export const primaryNavigation=[
 {label:bi('Inicio','Home'),path:'/'},
 {label:bi('Nosotros','About'),path:'/about/'},
 {label:bi('Servicios','Services'),path:'/services/'},
 {label:bi('Industrias','Industries'),path:'/industrias/'},
 {label:bi('Blog','Blog'),path:'/blog/'},
 {label:bi('Contacto','Contact'),path:'/contact/'}
] as const;
export const navigationItems=(locale:Locale):string[][]=>primaryNavigation.map(n=>[n.label[locale],n.path]);
export const isCurrentPage=(path:string,target:string):boolean=>target==='/'?path==='/':path.startsWith(target);
export function homeNavigation(locale:Locale,drawer=false):string{
 return primaryNavigation.map(n=>`<a href="${localPath(n.path,locale)}" ${n.path==='/'?'aria-current="page"':''}${drawer?' onClick="{{ closeMenu }}"':''}>${n.label[locale]}.</a>`).join('');
}
