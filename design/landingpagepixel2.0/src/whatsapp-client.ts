const widget=document.querySelector<HTMLElement>('.wa-float');
if(widget){
 const en=document.documentElement.lang.startsWith('en');
 const messages=en?['Hi, I would like more information.','Hi, I want to automate my business.','I have an idea for a website or app.','Let’s talk about my project.']:['Hola, quiero más información.','Hola, me interesa automatizar mi negocio.','Tengo una idea para una web o app.','Quiero platicar sobre mi proyecto.'];
 const text=widget.querySelector<HTMLElement>('[data-wa-text]')!;
 const links=widget.querySelectorAll<HTMLAnchorElement>('a');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let index=0,timer=0,closed=false;
 const stop=():void=>{clearTimeout(timer);widget.classList.remove('wa-changing');};
 const schedule=():void=>{stop();if(closed||document.hidden||reduced.matches||widget.matches(':hover')||widget.contains(document.activeElement))return;timer=window.setTimeout(()=>{widget.classList.add('wa-changing');timer=window.setTimeout(()=>{index=(index+1)%messages.length;text.textContent=messages[index]!;links.forEach(a=>{const u=new URL(a.href);u.searchParams.set('text',messages[index]!);a.href=u.href;});widget.classList.remove('wa-changing');schedule();},260);},6500);};
 widget.querySelector('button')?.addEventListener('click',()=>{closed=true;widget.classList.add('wa-quiet');stop();});
 widget.addEventListener('pointerenter',stop);widget.addEventListener('pointerleave',schedule);widget.addEventListener('focusin',stop);widget.addEventListener('focusout',()=>{queueMicrotask(schedule);});
 document.addEventListener('visibilitychange',schedule);reduced.addEventListener('change',schedule);window.addEventListener('pagehide',stop);window.addEventListener('pageshow',schedule);schedule();
}
export {};
