import {company} from './content.js';
import {escapeHTML as esc} from './catalog.js';
import type {Locale} from './i18n.js';
export function whatsappFloat(locale:Locale):string {
 const en=locale==='en',message=en?'Hi, I would like more information.':'Hola, quiero más información.';
 const url=new URL(company.whatsapp);url.searchParams.set('text',message);
 return `<aside class="wa-float" aria-label="WhatsApp"><div class="wa-bubble"><button class="wa-dismiss" type="button" aria-label="${en?'Hide suggestions':'Ocultar sugerencias'}">×</button><a class="wa-message" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer"><span class="wa-caption">${en?'LET’S TALK ABOUT YOUR IDEA':'HABLEMOS DE TU IDEA'}</span><strong data-wa-text>${esc(message)}</strong><span class="wa-action">${en?'Continue on WhatsApp':'Continuar en WhatsApp'} ↗</span></a></div><a class="wa-launch" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer" aria-label="${en?'Contact PixelTEC on WhatsApp':'Contactar a PixelTEC por WhatsApp'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20.5 11.6a8.5 8.5 0 0 1-12.7 7.5L3 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.6Z"/><path d="M8 7.5c-.8.7-.2 3.1 1.8 5.2s4.5 2.8 5.3 2l1-1.1-2.5-1.4-.9.9c-1.4-.6-2.5-1.7-3.1-3.1l.9-.9L9 6.7Z"/></svg><span>WhatsApp</span><i aria-hidden="true"></i></a></aside>`;
}
