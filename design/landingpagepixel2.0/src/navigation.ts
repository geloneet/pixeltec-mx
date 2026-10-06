import {bi,type Locale,localPath} from './i18n.js';
// Public pixeltec.mx header, observed 2026-10-03. Keep existing URL suffixes.
const publicNavigation=[
 {label:bi('Inicio','Home'),path:'/'},
 {label:bi('Nosotros','About'),path:'/about/'},
 {label:bi('Servicios','Services'),path:'/services/'},
 {label:bi('Industrias','Industries'),path:'/industrias/'},
 {label:bi('Blog','Blog'),path:'/blog/'},
 {label:bi('Contacto','Contact'),path:'/contact/'}
] as const;
// Miguel: hide Home and Blog only from header/drawer, preserving footer and routes.
export const primaryNavigation=publicNavigation.filter(n=>n.path!=='/'&&n.path!=='/blog/');
export const footerNavigationItems=(locale:Locale):string[][]=>publicNavigation.map(n=>[n.label[locale],n.path]);
export const navigationItems=(locale:Locale):string[][]=>primaryNavigation.map(n=>[n.label[locale],n.path]);
export const isCurrentPage=(path:string,target:string):boolean=>target==='/'?path==='/':path.startsWith(target);
export function homeNavigation(locale:Locale,drawer=false):string{
 return primaryNavigation.map(n=>`<a href="${localPath(n.path,locale)}" ${drawer?' onClick="{{ closeMenu }}"':''}>${n.label[locale]}.</a>`).join('');
}
