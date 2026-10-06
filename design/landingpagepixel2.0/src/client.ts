import './diagnostic-client.js';
import { enter, panelMotion } from './motion.js';
const english=document.documentElement.lang==='en';
const labelText=(es:string,en:string):string=>english?en:es;
const allFilter=labelText('Todos','All');
const menu = document.querySelector<HTMLDialogElement>('#site-menu');
const toggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
let closingMenu = false;
const closeMenu = (): void => {
  if (!menu?.open || closingMenu) return;
  closingMenu = true;
  menu.classList.add('menu-closing');
  const finish = (): void => { menu.close(); closingMenu = false; };
  const animation = panelMotion(menu, false);
  if (animation) void animation.finished.then(finish, finish);
  else finish();
};
toggle?.addEventListener('click',()=>{
  if (!menu || menu.open) return;
  menu.classList.remove('menu-closing');menu.showModal();toggle.setAttribute('aria-expanded','true');panelMotion(menu,true);
});
document.querySelector('[data-close-menu]')?.addEventListener('click',closeMenu);
menu?.addEventListener('cancel',event=>{event.preventDefault();closeMenu();});
menu?.addEventListener('close',()=>{closingMenu=false;toggle?.setAttribute('aria-expanded','false');toggle?.focus();});
menu?.addEventListener('click',event=>{
  if(event.target!==menu)return;
  const r=menu.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeMenu();
});
let activeFilter=allFilter;
const search=document.querySelector<HTMLInputElement>('[data-search-input]');
function filterCards():void {
  let visible=0;
  const query=(search?.value??'').trim().toLocaleLowerCase(english?'en':'es');
  document.querySelectorAll<HTMLElement>('.work-card').forEach(card=>{
    const wasHidden=card.hidden;
    card.hidden=(activeFilter!==allFilter&&card.dataset.category!==activeFilter)||!(card.dataset.search??'').includes(query);
    if(!card.hidden){visible++;if(wasHidden)enter(card, Math.min((visible-1)*45,135));}
  });
  const empty=document.querySelector<HTMLElement>('.empty-state');if(empty)empty.hidden=visible>0;
}
document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
  activeFilter=button.dataset.filter??allFilter;
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  filterCards();
}));
search?.addEventListener('input',filterCards);
document.querySelectorAll<HTMLFormElement>('[data-preview-form]').forEach(form=>form.addEventListener('submit',e=>{
  e.preventDefault();
  if(!form.reportValidity())return;
  const status=form.querySelector<HTMLElement>('.form-message');
  if(status){status.textContent=labelText('Vista previa completada. No se enviaron ni guardaron datos.','Preview completed. No data was sent or saved.');status.setAttribute('tabindex','-1');status.focus();}
}));
export {};

// The shared CTA reuses the existing assessment, without a document navigation.
const diagnosticModal = document.querySelector<HTMLDialogElement>('#diagnostic-modal');
let diagnosticOpener: HTMLElement | null = null;
document.querySelectorAll<HTMLAnchorElement>('[data-open-diagnostic]').forEach(trigger => {
  trigger.addEventListener('click', event => {
    if (!diagnosticModal || typeof diagnosticModal.showModal !== 'function') return;
    event.preventDefault();
    diagnosticOpener = trigger;
    diagnosticModal.showModal();
    const heading = diagnosticModal.querySelector<HTMLElement>('[data-summary]:not([hidden]) h2') ?? diagnosticModal.querySelector<HTMLElement>('fieldset:not([hidden]) legend');
    if (heading) { heading.tabIndex = -1; heading.focus(); }
  });
});
diagnosticModal?.querySelector('[data-close-diagnostic]')?.addEventListener('click', () => diagnosticModal.close());
diagnosticModal?.addEventListener('close', () => diagnosticOpener?.focus());
diagnosticModal?.addEventListener('click', event => {
  if (event.target !== diagnosticModal) return;
  const rect = diagnosticModal.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) diagnosticModal.close();
});
