import {evaluateDiagnostic} from './diagnostic-logic.js';
import {diagnosticLabel} from './diagnostic-labels.js';
import {enter} from './motion.js';
const labelText=(es:string,en:string):string=>document.documentElement.lang.startsWith('en')?en:es;
function initialize():void {
const wizard=document.querySelector<HTMLFormElement>('#diagnostic-form');
if(wizard && !wizard.dataset.initialized){
 wizard.dataset.initialized="true";
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
    if(label)label.textContent=`${labelText('PASO','STEP')} ${String(step+1).padStart(2,'0')} / 04`;
    if(progress)progress.style.width=`${(step+1)*25}%`;
    if(prev)prev.hidden=step===0;
    if(next)next.textContent=step===3?labelText('Ver mi diagnóstico ↗','View my assessment ↗'):labelText('Continuar →','Continue →');
    if(error)error.textContent='';
    const legend=fields[step]?.querySelector('legend');if(legend){legend.tabIndex=-1;legend.focus();}enter(fields[step]);
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
    const list=document.querySelector('[data-summary-list]');
    if(list){list.replaceChildren();fields.forEach(f=>{const dt=document.createElement('dt');dt.textContent=f.querySelector('legend')?.textContent??'';const dd=document.createElement('dd');dd.textContent=Array.from(f.querySelectorAll<HTMLInputElement>('input:checked')).map(i=>i.nextElementSibling?.textContent?.replace('↗','').trim()??i.value).join(', ');list.append(dt,dd);});}
    const share=document.querySelector<HTMLAnchorElement>('[data-share-summary]');
    if(share){const answers=fields.map(f=>(f.querySelector('legend')?.textContent??'')+': '+(Array.from(f.querySelectorAll<HTMLInputElement>('input:checked')).map(i=>i.nextElementSibling?.textContent?.replace('↗','').trim()??i.value).join(', ')));share.href='https://api.whatsapp.com/send?phone=523221378336&text='+encodeURIComponent(labelText('Hola PixelTEC. Este es el punto de partida de mi negocio:','Hello PixelTEC. Here is the starting point for my business:')+'\n\n'+answers.join('\n')+'\n'+labelText('Madurez digital: ','Digital maturity: ')+result.score+'%\n'+result.recommendedServices.map(t=>diagnosticLabel(t,locale)).join(', ')+'\n'+diagnosticLabel(result.timeline,locale));}
    if(label)label.textContent=labelText('DIAGNÓSTICO COMPLETADO','ASSESSMENT COMPLETED');
    const heading=summary?.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus();}enter(summary);
  };
  next?.addEventListener('click',advance);
  wizard.addEventListener('submit',e=>{e.preventDefault();advance();});
  prev?.addEventListener('click',()=>{step=Math.max(0,step-1);update();});
  document.querySelector('[data-restart]')?.addEventListener('click',()=>{wizard.reset();wizard.hidden=false;if(summary)summary.hidden=true;step=0;update();});
}
}
if(!document.querySelector('[data-start-diagnostic]'))initialize();
document.addEventListener('click',event=>{const start=(event.target as Element)?.closest('[data-start-diagnostic]');if(!start)return;const card=start.closest('.home-diagnostic-card');const intro=card?.querySelector<HTMLElement>('[data-diagnostic-intro]');const panel=card?.querySelector<HTMLElement>('[data-inline-diagnostic]');if(!panel)return;if(intro)intro.hidden=true;panel.hidden=false;start.setAttribute('aria-expanded','true');initialize();const legend=panel.querySelector('legend');if(legend){legend.tabIndex=-1;legend.focus();}enter(panel);});
