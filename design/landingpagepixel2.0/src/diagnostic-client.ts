import {evaluateDiagnostic} from './diagnostic-logic.js';
import {diagnosticLabel} from './diagnostic-labels.js';
import {enter} from './motion.js';
const labelText=(es:string,en:string):string=>document.documentElement.lang.startsWith('en')?en:es;
function initialize():void {
for(const wizard of document.querySelectorAll<HTMLFormElement>('.wizard form')){
if(wizard && !wizard.dataset.initialized){
 wizard.dataset.initialized="true";
  let step=0;
  let transitioning=false;
  const card=wizard.closest<HTMLElement>('.wizard')!;
  const transition=async(change:()=>void,direction=1):Promise<void>=>{
    if(transitioning)return;
    if(!card||matchMedia('(prefers-reduced-motion: reduce)').matches||typeof card.animate!=='function'){change();return;}
    transitioning=true;
    card.setAttribute('aria-busy','true');
    const oldHeight=card.getBoundingClientRect().height;
    const content=wizard.hidden?card.querySelector<HTMLElement>('[data-summary]')??wizard:wizard;
    const outgoing=content.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:`translateX(${-direction*10}px)`}],{duration:140,easing:'ease-in',fill:'forwards'});
    try{
      await outgoing.finished;
      change();
      const newHeight=card.getBoundingClientRect().height;
      outgoing.cancel();
      card.style.overflow='hidden';
      const size=card.animate([{height:`${oldHeight}px`},{height:`${newHeight}px`}],{duration:360,easing:'cubic-bezier(.22,1,.36,1)'});
      const nextContent=wizard.hidden?card.querySelector<HTMLElement>('[data-summary]')??wizard:wizard;
      const incoming=nextContent.animate([{opacity:0,transform:`translateX(${direction*10}px)`},{opacity:1,transform:'translateX(0)'}],{duration:320,easing:'cubic-bezier(.22,1,.36,1)'});
      await Promise.all([size.finished,incoming.finished]);
    }finally{
      outgoing.cancel();card.style.removeProperty('overflow');card.removeAttribute('aria-busy');transitioning=false;
    }
  };
  const fields=Array.from(wizard.querySelectorAll<HTMLFieldSetElement>('[data-step]'));
  const next=wizard.querySelector<HTMLButtonElement>('[data-next]');
  const prev=wizard.querySelector<HTMLButtonElement>('[data-prev]');
  const label=card.querySelector<HTMLElement>('[data-step-label]');
  const progress=card.querySelector<HTMLElement>('[data-progress]');
  const error=wizard.querySelector<HTMLElement>('[data-wizard-error]');
  const summary=card.querySelector<HTMLElement>('[data-summary]');
  const update=():void=>{
    fields.forEach((f,i)=>f.hidden=i!==step);
    if(label)label.textContent=`${labelText('PASO','STEP')} ${String(step+1).padStart(2,'0')} / 04`;
    if(progress)progress.style.width=`${(step+1)*25}%`;
    if(prev)prev.hidden=step===0;
    if(next)next.textContent=step===3?labelText('Ver mi diagnóstico ↗','View my assessment ↗'):labelText('Continuar →','Continue →');
    if(error)error.textContent='';
    const legend=fields[step]?.querySelector('legend');if(legend){legend.tabIndex=-1;legend.focus({preventScroll:true});}
  };
  const advance=():void=>{
    if(!fields[step]?.querySelector('input:checked')){if(error)error.textContent=labelText('Selecciona una opción para continuar.','Choose an option to continue.');return;}
    if(step<3){step++;update();return;}
    const locale=document.documentElement.lang.startsWith('en')?'en':'es';
    const chosen=(index:number):string[]=>Array.from(fields[index]!.querySelectorAll<HTMLInputElement>('input:checked')).map(i=>i.value);
    let result;try{result=evaluateDiagnostic({companyType:chosen(0)[0],problems:chosen(1),companySize:chosen(2)[0],priority:chosen(3)[0]});}catch{if(error)error.textContent=labelText('Revisa tus respuestas antes de continuar.','Review your answers before continuing.');return;}
    const fillList=(selector:string,items:string[]):void=>{const target=summary?.querySelector(selector);if(!target)return;target.replaceChildren(...items.map(text=>{const li=document.createElement('li');li.textContent=diagnosticLabel(text,locale);return li;}));};
    fillList('[data-strengths]',result.strengths);fillList('[data-opportunities]',result.opportunities);fillList('[data-services]',result.recommendedServices);
    const score=summary?.querySelector('[data-score]');if(score)score.textContent=result.score+'%';
    const bar=summary?.querySelector<HTMLElement>('[data-score-bar]');if(bar)bar.style.width=result.score+'%';
    const timeline=summary?.querySelector('[data-timeline]');if(timeline)timeline.textContent=diagnosticLabel(result.timeline,locale);
    wizard.hidden=true;if(summary)summary.hidden=false;
    const list=card.querySelector('[data-summary-list]');
    if(list){list.replaceChildren();fields.forEach(f=>{const dt=document.createElement('dt');dt.textContent=f.querySelector('legend')?.textContent??'';const dd=document.createElement('dd');dd.textContent=Array.from(f.querySelectorAll<HTMLInputElement>('input:checked')).map(i=>i.nextElementSibling?.textContent?.replace('↗','').trim()??i.value).join(', ');list.append(dt,dd);});}
    const share=card.querySelector<HTMLAnchorElement>('[data-share-summary]');
    if(share){const answers=fields.map(f=>(f.querySelector('legend')?.textContent??'')+': '+(Array.from(f.querySelectorAll<HTMLInputElement>('input:checked')).map(i=>i.nextElementSibling?.textContent?.replace('↗','').trim()??i.value).join(', ')));share.href='https://api.whatsapp.com/send?phone=523221378336&text='+encodeURIComponent(labelText('Hola PixelTEC. Este es el punto de partida de mi negocio:','Hello PixelTEC. Here is the starting point for my business:')+'\n\n'+answers.join('\n')+'\n'+labelText('Madurez digital: ','Digital maturity: ')+result.score+'%\n'+result.recommendedServices.map(t=>diagnosticLabel(t,locale)).join(', ')+'\n'+diagnosticLabel(result.timeline,locale));}
    if(label)label.textContent=labelText('DIAGNÓSTICO COMPLETADO','ASSESSMENT COMPLETED');
    const heading=summary?.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  };
  const smoothAdvance=():void=>{if(transitioning)return;if(!fields[step]?.querySelector('input:checked')){advance();return;}void transition(advance);};
  next?.addEventListener('click',smoothAdvance);
  wizard.addEventListener('submit',e=>{e.preventDefault();smoothAdvance();});
  prev?.addEventListener('click',()=>{void transition(()=>{step=Math.max(0,step-1);update();},-1);});
  card.querySelector('[data-restart]')?.addEventListener('click',()=>{void transition(()=>{wizard.reset();wizard.hidden=false;if(summary)summary.hidden=true;step=0;update();},-1);});
}
}
}
if(!document.querySelector('[data-start-diagnostic]'))initialize();
document.addEventListener('click',event=>{const start=(event.target as Element)?.closest('[data-start-diagnostic]');if(!start)return;const card=start.closest('.home-diagnostic-card');const intro=card?.querySelector<HTMLElement>('[data-diagnostic-intro]');const panel=card?.querySelector<HTMLElement>('[data-inline-diagnostic]');if(!panel)return;if(intro)intro.hidden=true;panel.hidden=false;start.setAttribute('aria-expanded','true');initialize();const legend=panel.querySelector('legend');if(legend){legend.tabIndex=-1;legend.focus();}enter(panel);});

// Delegation supports the asynchronously mounted home header as well as interior CTAs.
let diagnosticOpener: HTMLElement | null = null;
document.addEventListener('click',event=>{
 const trigger=(event.target as Element)?.closest<HTMLElement>('[data-open-diagnostic]');
 const modal=document.querySelector<HTMLDialogElement>('#diagnostic-modal');
 if(!trigger||!modal||typeof modal.showModal!=='function')return;
 if(event instanceof MouseEvent&&(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey))return;
 event.preventDefault();diagnosticOpener=trigger;initialize();modal.showModal();
 const heading=modal.querySelector<HTMLElement>('[data-summary]:not([hidden]) h2')??modal.querySelector<HTMLElement>('fieldset:not([hidden]) legend');
 if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
});
const diagnosticModal=document.querySelector<HTMLDialogElement>('#diagnostic-modal');
diagnosticModal?.querySelector('[data-close-diagnostic]')?.addEventListener('click',()=>diagnosticModal.close());
diagnosticModal?.addEventListener('close',()=>diagnosticOpener?.focus({preventScroll:true}));
diagnosticModal?.addEventListener('click',event=>{
 if(event.target!==diagnosticModal)return;
 const r=diagnosticModal.getBoundingClientRect();
 if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)diagnosticModal.close();
});
