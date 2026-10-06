// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {initializeDiagnostic} from './diagnostic-client';
import shell from './generated/shell.json';
import {evaluateDiagnostic} from './diagnostic-logic';
import {computeDiagnostic,COMPANY_TYPES,PROBLEMS,COMPANY_SIZES,PRIORITIES} from '@/lib/diagnostic/logic';
function html(n:any):string{if(typeof n==='string')return n;if(!n)return '';return `<${n.tag} ${Object.entries(n.attrs).filter(([k])=>k!=='style').map(([k,v])=>`${k==='className'?'class':k}="${v}"`).join(' ')}>${n.children.map(html).join('')}</${n.tag}>`;}
beforeEach(()=>{document.documentElement.lang='es';document.body.innerHTML=shell.extras.map(html).join('');vi.stubGlobal('matchMedia',()=>({matches:true}));});
describe('public assessment integration',()=>{
 it('validates external answers and uses the existing scoring engine',()=>{
  const input={companyType:COMPANY_TYPES[0].value,problems:[PROBLEMS[0].value],companySize:COMPANY_SIZES[0].value,priority:PRIORITIES[0].value};
  expect(evaluateDiagnostic(input)).toEqual(computeDiagnostic({...input,name:'',email:''}));
  expect(()=>evaluateDiagnostic({...input,companyType:'untrusted'})).toThrow();
  expect(()=>evaluateDiagnostic({...input,problems:[]})).toThrow();
 });
 it('requires answers, advances once after repeated initialization and does not bind followup forms',()=>{
  const card=document.querySelector('.wizard')!;const followup=document.createElement('form');card.append(followup);
  initializeDiagnostic();initializeDiagnostic();
  const form=card.querySelector<HTMLFormElement>('[data-diagnostic-form]')!;
  const next=form.querySelector<HTMLButtonElement>('[data-next]')!;next.click();expect(form.querySelector('[data-wizard-error]')?.textContent).toContain('Selecciona');
  const fields=Array.from(form.querySelectorAll<HTMLFieldSetElement>('[data-step]'));
  for(let i=0;i<fields.length;i++){fields[i].querySelector<HTMLInputElement>('input')!.checked=true;next.click();}
  expect(form.hidden).toBe(true);expect(card.querySelector<HTMLElement>('[data-summary]')?.hidden).toBe(false);
  expect(card.querySelector('[data-score]')?.textContent).toMatch(/\d+%/);
  expect(followup.dataset.initialized).toBeUndefined();
  const event=new Event('submit',{bubbles:true,cancelable:true});followup.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);
  expect(card.querySelector<HTMLAnchorElement>('[data-share-summary]')?.href).toContain('api.whatsapp.com/send');
 });
});
