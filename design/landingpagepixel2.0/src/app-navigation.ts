/** Progressive navigation: native history/URLs, no intercepted clicks or injected documents. */
const arrivalKey='pixeltec:arrival';
try {
 const stamp=Number(sessionStorage.getItem(arrivalKey));
 sessionStorage.removeItem(arrivalKey);
 if(stamp>0&&Date.now()-stamp<15000)document.documentElement.dataset.routeArrival='true';
} catch { /* Navigation remains available with storage disabled. */ }
const connection=(navigator as Navigator & {connection?:{saveData?:boolean;effectiveType?:string}}).connection;
const hinted=new Set<string>();
let hintTimer=0;
let busyTimer=0;
function destination(target:EventTarget|null):URL|null {
 if(!(target instanceof Element))return null;
 const a=target.closest<HTMLAnchorElement>('a[href]');
 if(!a||a.hasAttribute('download')||(a.target&&a.target!=='_self')||a.rel.includes('external'))return null;
 const u=new URL(a.href,location.href);
 if(u.origin!==location.origin||u.search||!u.pathname.endsWith('/')||u.pathname===location.pathname)return null;
 // Only links emitted by this public prototype; never prefetch authentication/actions.
 if(/\/(login|reset-password|api|logout)(\/|$)/.test(u.pathname))return null;
 return u;
}
function hint(target:EventTarget|null):void {
 clearTimeout(hintTimer);
 const u=destination(target);
 if(!u||connection?.saveData||/2g/.test(connection?.effectiveType??'')||hinted.size>=6||hinted.has(u.pathname))return;
 hintTimer=window.setTimeout(()=>{
  hinted.add(u.pathname);
  const link=document.createElement('link');link.rel='prefetch';link.as='document';link.href=u.origin+u.pathname;
  document.head.append(link);
 },100);
}
document.addEventListener('pointerover',e=>hint(e.target),{passive:true});
document.addEventListener('focusin',e=>hint(e.target));
document.addEventListener('pointerout',()=>clearTimeout(hintTimer),{passive:true});
function reset():void {clearTimeout(busyTimer);delete document.documentElement.dataset.navigating;}
document.addEventListener('click',e=>{
 if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||!destination(e.target))return;
 try{sessionStorage.setItem(arrivalKey,String(Date.now()));}catch{}
 document.documentElement.dataset.navigating='true';
 // A cancelled navigation cannot leave the feedback running indefinitely.
 busyTimer=window.setTimeout(reset,8000);
});
window.addEventListener('pageshow',reset);
window.addEventListener('pagehide',reset);
type TransitionEvent=Event & {viewTransition?:{ready:Promise<void>;finished:Promise<void>}};
function trackTransition(event:Event):void {
 const transition=(event as TransitionEvent).viewTransition;
 if(!transition)return;
 void transition.ready.then(()=>{document.documentElement.dataset.routeTransition='active';},()=>{document.documentElement.dataset.routeTransition='skipped';});
 void transition.finished.then(()=>{document.documentElement.dataset.routeTransition='complete';},()=>{});
}
window.addEventListener('pagereveal',trackTransition);
window.addEventListener('pageswap',event=>{
 trackTransition(event);
 reset();
 document.querySelector<HTMLDialogElement>('dialog[open]')?.close();
});
// Keep the static first paint until React has actually committed the matching header + hero.
function ready():boolean {
 if(!document.querySelector('#dc-root header')||!document.querySelector('#dc-root h1'))return false;
 document.getElementById('home-first-paint')?.remove();return true;
}
if(document.getElementById('home-first-paint')&&!ready()){
 const mount=new MutationObserver(()=>{if(ready())mount.disconnect();});
 mount.observe(document.body,{childList:true,subtree:true});
 window.addEventListener('pagehide',()=>mount.disconnect(),{once:true});
}
export {};
