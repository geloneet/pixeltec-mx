const menu = document.querySelector<HTMLDialogElement>('#site-menu');
const toggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
toggle?.addEventListener('click',()=>{menu?.showModal();toggle.setAttribute('aria-expanded','true');});
document.querySelector('[data-close-menu]')?.addEventListener('click',()=>menu?.close());
menu?.addEventListener('close',()=>{toggle?.setAttribute('aria-expanded','false');toggle?.focus();});
menu?.addEventListener('click',e=>{if(e.target===menu){const r=menu.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right)menu.close();}});
let activeFilter='Todos';
const search=document.querySelector<HTMLInputElement>('[data-search-input]');
function filterCards():void {
  let visible=0;
  const query=(search?.value??'').trim().toLocaleLowerCase('es');
  document.querySelectorAll<HTMLElement>('.work-card').forEach(card=>{
    card.hidden=(activeFilter!=='Todos'&&card.dataset.category!==activeFilter)||!(card.dataset.search??'').includes(query);
    if(!card.hidden)visible++;
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
    const legend=fields[step]?.querySelector('legend');if(legend){legend.tabIndex=-1;legend.focus();}
  };
  const advance=():void=>{
    if(!fields[step]?.querySelector('input:checked')){if(error)error.textContent='Selecciona una opción para continuar.';return;}
    if(step<3){step++;update();return;}
    wizard.hidden=true;if(summary)summary.hidden=false;
    const list=document.querySelector('[data-summary-list]');
    if(list){list.replaceChildren();fields.forEach(f=>{const dt=document.createElement('dt');dt.textContent=f.querySelector('legend')?.textContent??'';const dd=document.createElement('dd');dd.textContent=f.querySelector<HTMLInputElement>('input:checked')?.value??'';list.append(dt,dd);});}
    if(label)label.textContent='RECORRIDO COMPLETADO';
    const heading=summary?.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus();}
  };
  next?.addEventListener('click',advance);
  wizard.addEventListener('submit',e=>{e.preventDefault();advance();});
  prev?.addEventListener('click',()=>{step=Math.max(0,step-1);update();});
  document.querySelector('[data-restart]')?.addEventListener('click',()=>{wizard.reset();wizard.hidden=false;if(summary)summary.hidden=true;step=0;update();});
}
export {};
