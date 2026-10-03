import { enter, panelMotion } from './motion.js';
const menu = document.querySelector<HTMLDialogElement>('#site-menu');
const toggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
let closingMenu = false;
const closeMenu = (): void => {
  if (!menu?.open || closingMenu) return;
  closingMenu = true;
  const finish = (): void => { menu.close(); closingMenu = false; };
  const animation = panelMotion(menu, false);
  if (animation) void animation.finished.then(finish, finish);
  else finish();
};
toggle?.addEventListener('click',()=>{
  if (!menu || menu.open) return;
  menu.showModal();toggle.setAttribute('aria-expanded','true');panelMotion(menu,true);
});
document.querySelector('[data-close-menu]')?.addEventListener('click',closeMenu);
menu?.addEventListener('cancel',event=>{event.preventDefault();closeMenu();});
menu?.addEventListener('close',()=>{closingMenu=false;toggle?.setAttribute('aria-expanded','false');toggle?.focus();});
menu?.addEventListener('click',event=>{
  if(event.target!==menu)return;
  const r=menu.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeMenu();
});
let activeFilter='Todos';
const search=document.querySelector<HTMLInputElement>('[data-search-input]');
function filterCards():void {
  let visible=0;
  const query=(search?.value??'').trim().toLocaleLowerCase('es');
  document.querySelectorAll<HTMLElement>('.work-card').forEach(card=>{
    const wasHidden=card.hidden;
    card.hidden=(activeFilter!=='Todos'&&card.dataset.category!==activeFilter)||!(card.dataset.search??'').includes(query);
    if(!card.hidden){visible++;if(wasHidden)enter(card, Math.min((visible-1)*45,135));}
  });
  const empty=document.querySelector<HTMLElement>('.empty-state');if(empty)empty.hidden=visible>0;
}
document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
  activeFilter=button.dataset.filter??'Todos';
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  filterCards();
}));
search?.addEventListener('input',filterCards);
document.querySelectorAll<HTMLFormElement>('[data-preview-form]').forEach(form=>form.addEventListener('submit',e=>{
  e.preventDefault();
  if(!form.reportValidity())return;
  const status=form.querySelector<HTMLElement>('.form-message');
  if(status){status.textContent='Vista previa completada. No se enviaron ni guardaron datos.';status.setAttribute('tabindex','-1');status.focus();}
}));
const wizard=document.querySelector<HTMLFormElement>('#diagnostic-form');
if(wizard){
  let step=0;
  const fields=Array.from(wizard.querySelectorAll<HTMLFieldSetElement>('[data-step]'));
  const next=wizard.querySelector<HTMLButtonElement>('[data-next]');
  const prev=wizard.querySelector<HTMLButtonElement>('[data-prev]');
  const label=document.querySelector<HTMLElement>('[data-step-label]');
  const progress=document.querySelector<HTMLElement>('[data-progress]');
  const error=wizard.querySelector<HTMLElement>('[data-wizard-error]');
  const summary=document.querySelector<HTMLElement>('[data-summary]');
  const update=():void=>{
    fields.forEach((f,i)=>f.hidden=i!==step);
    if(label)label.textContent=`PASO ${String(step+1).padStart(2,'0')} / 04`;
    if(progress)progress.style.width=`${(step+1)*25}%`;
    if(prev)prev.hidden=step===0;
    if(next)next.textContent=step===3?'Ver mi recorrido ↗':'Continuar →';
    if(error)error.textContent='';
    const legend=fields[step]?.querySelector('legend');if(legend){legend.tabIndex=-1;legend.focus();}enter(fields[step]);
  };
  const advance=():void=>{
    if(!fields[step]?.querySelector('input:checked')){if(error)error.textContent='Selecciona una opción para continuar.';return;}
    if(step<3){step++;update();return;}
    wizard.hidden=true;if(summary)summary.hidden=false;
    const list=document.querySelector('[data-summary-list]');
    if(list){list.replaceChildren();fields.forEach(f=>{const dt=document.createElement('dt');dt.textContent=f.querySelector('legend')?.textContent??'';const dd=document.createElement('dd');dd.textContent=f.querySelector<HTMLInputElement>('input:checked')?.value??'';list.append(dt,dd);});}
    if(label)label.textContent='RECORRIDO COMPLETADO';
    const heading=summary?.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus();}enter(summary);
  };
  next?.addEventListener('click',advance);
  wizard.addEventListener('submit',e=>{e.preventDefault();advance();});
  prev?.addEventListener('click',()=>{step=Math.max(0,step-1);update();});
  document.querySelector('[data-restart]')?.addEventListener('click',()=>{wizard.reset();wizard.hidden=false;if(summary)summary.hidden=true;step=0;update();});
}
export {};
