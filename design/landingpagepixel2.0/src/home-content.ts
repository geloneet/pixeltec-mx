import {languageAlternates,socialMetadata} from './seo-policy.js';
import {brandMark} from './brand.js';
import {homeNavigation} from './navigation.js';
import {company,serviceContent,caseStudies,industryContent,editorial,method} from './content.js';
import {langSwitch,localPath,type Locale} from './i18n.js';
import {escapeHTML as esc} from './catalog.js';
const en:Record<string,string>={
 'Desarrollo Web y Apps. Automatización con IA. Desde Puerto Vallarta para todo México.':'Web and apps. AI automation. From Puerto Vallarta, for businesses across Mexico.',
 'Somos arquitectos de tu transformación digital. Combinamos consultoría TI, inteligencia artificial y desarrollo a la medida para que tu empresa opere y escale sin fricción.':'We design your digital transformation. IT consulting, artificial intelligence and custom development, built around the way your business works.',
 'Tecnología confiable, escalable y segura, diseñada para que tu empresa opere con eficiencia y se adapte rápido.':'Technology designed around your operations, with the expertise and support your business needs to evolve.',
 'Ideas, guías y casos reales sobre IA, desarrollo y transformación digital para que tu empresa decida con claridad.':'Ideas, guides and real cases on AI, development and digital transformation to help your business make informed decisions.',
 'Cuéntanos qué está frenando tu operación y lo resolvemos juntos.':'Tell us what is slowing your business down. Let’s work on it together.',
 'Responde 4 preguntas y comparte tus datos: revisamos tu caso y te proponemos un siguiente paso claro, sin soluciones genéricas.':'Answer four questions to organize your starting point, then choose whether to share your summary with our team.',
 'En menos de 3 minutos analizaremos tu situación actual y prepararemos una sesión mucho más productiva.':'A few minutes of context make the next conversation more useful.',
 'Consultoría TI, inteligencia artificial y desarrollo a la medida para que pymes y empresas de todo México operen y escalen sin fricción.':'IT consulting, artificial intelligence and custom development for businesses across Mexico.',
 'Desarrollo web, apps y automatización con IA para pymes y empresas de Puerto Vallarta, Guadalajara y todo México.':'Websites, apps and AI automation for businesses in Puerto Vallarta, Guadalajara and across Mexico.',
 '// Ayudamos a empresas a operar y crecer con tecnología.':'// Technology that supports real business operations.',
 'Empresas que ya escalaron con nosotros':'Businesses that have grown with us',
 '© 2026 PixelTEC. Todos los derechos reservados.':'© 2026 PixelTEC. All rights reserved.',
 'Ver todos los servicios':'Explore all services','Más sobre nosotros →':'More about us →','Hablar con un especialista':'Talk to a specialist','Iniciar diagnóstico':'Start an assessment',
 '¿Tienes un proyecto en mente?':'Have a project in mind?','Diagnóstico inteligente':'Business assessment',
 'Software a la medida':'Custom software','Apps a la medida':'Custom apps','Transformación digital':'Digital transformation','Desarrollo Web &amp; Apps':'Web &amp; Apps','Automatización con IA':'AI automation','Automatización IA':'AI automation','WhatsApp IA':'WhatsApp AI','Consultoría TI':'IT consulting','Soporte TI':'IT support','Desarrollo Web':'Web development',
 'Nuestros servicios':'Our services','Enlaces rápidos':'Quick links','Sobre PixelTEC':'About PixelTEC','WhatsApp directo':'WhatsApp direct','Aviso de Privacidad':'Privacy notice',
 'Explorar todas las páginas ↗':'Explore all pages ↗','Guías y presencia local':'Guides & local presence','Acceso de clientes':'Client access','Metodología':'Our process','Equipo':'Team','Términos':'Terms',
 'Servicios.':'Services.','Proyectos.':'Work.','Industrias.':'Industries.','Nosotros.':'About.','Contacto.':'Contact.',
 '>Diagnóstico<':'>Assessment<','>Servicios<':'>Services<','>Nosotros<':'>About<','>Proyectos<':'>Work<','>Contacto<':'>Contact<','>Oficina<':'>Office<','>Blog<':'>Journal<','>Hablemos<':'>Let’s talk<',
 '>Soluciones<':'>Technology<','>Tecnológicas<':'>that works<','Por qué<br>nosotros':'Why<br>PixelTEC','VER TODOS':'VIEW ALL','Comenzar →':'Get started →',
 'Puerto Vallarta, Jalisco, México':'Puerto Vallarta, Jalisco, Mexico','>México<':'>Mexico<',
 'aria-label="Menú"':'aria-label="Menu"','aria-label="Cerrar menú"':'aria-label="Close menu"','5 de 5 estrellas':'5 out of 5 stars',
 'Desarrollador de PixelTEC sosteniendo una pantalla de código':'PixelTEC character holding a screen of code',
 "'Ver testimonios '":"'View testimonials '","'Proyectos'":"'Work'"
};
export function homeContent(home:string,locale:Locale):string {
 const x=(a:string,b:string):string=>locale==='es'?a:b;
 home=home.replace(/<p([^>]*)>(<span[^>]*>Somos arquitectos[\s\S]*?<\/span>)<\/p>/,'<h2$1>$2</h2>');

 const replaceArray=(key:string,items:unknown[],next:string):void=>{
  const start=home.indexOf('      '+key+': [');const end=home.indexOf('      '+next+':',start);
  if(start<0||end<0)throw new Error('Home content anchor missing: '+key);
  home=home.slice(0,start)+'      '+key+': '+JSON.stringify(items)+',\n'+home.slice(end);
 };
 replaceArray('aboutCards',[
 {n:'001.',t:x('Un aliado estratégico','A strategic partner'),d:company.about[locale]},
 {n:'002.',t:x('Entender antes de construir','Understand before building'),d:x('Combinamos consultoría empresarial con desarrollo de software. Primero entendemos la operación, después elegimos la tecnología.','We combine business consulting and software development. We understand the operation first, then choose the technology.')},
 {n:'003.',t:x('El equipo que tu proyecto necesita','The team your project needs'),d:company.team[locale]}
 ],'cubeRef');
 replaceArray('svc',serviceContent.map((s,i)=>({n:'0'+(i+1),href:localPath(s.path,locale),t:s.title[locale],d:s.description[locale],tags:s.category[locale].split(' · '),symbol:['⌘','</>','↗','◎'][i]})),'whyCols');
 replaceArray('whyStats',[
 {n:'01',suf:'',label:x('Arquitecto líder por proyecto','Lead architect per project')},
 {n:'06',suf:'',label:x('Industrias con experiencia publicada','Industries with published experience')},
 {n:'MX',suf:'',label:x('Desde Vallarta para todo México','From Vallarta, across Mexico')}
 ],'whyItems');
 replaceArray('whyItems',method.map(f=>({t:f.title[locale],d:f.body[locale]})),'footCols');
 const cases=caseStudies.map(c=>({href:localPath(c.path,locale),id:c.id,name:c.name,tags:[c.category[locale]],short:c.scope[locale],label:c.category[locale],headline:c.id==='villa-nogal'?x('Una experiencia de reserva propia.','A booking experience of their own.'):c.id==='pipas-tondoroque'?x('Pedidos que siguen su curso.','Orders that keep moving.'):c.id==='barro-stock'?x('Cada pieza, en su lugar.','Every piece in its place.'):c.id==='smile-more'?x('Más control. Mejor atención.','More control. Better care.'):x('Tradición que evoluciona.','Tradition that evolves.')}));
 replaceArray('projTop',cases.slice(0,2),'projBottom');replaceArray('projBottom',cases.slice(2),'projects');replaceArray('projects',cases,'nlColumns');
 replaceArray('posts',editorial.slice(0,4).map(p=>({href:localPath(p.path,locale),cat:p.category[locale],date:new Intl.DateTimeFormat(locale==='es'?'es-MX':'en-US',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(p.date+'T12:00:00Z')),title:p.title[locale],excerpt:p.description[locale]})),'industries');
 const quotes=caseStudies.map(c=>({text:c.quote[locale],name:c.person,role:c.role[locale],title:c.name}));
 home=home.replace(/  quotes = \[[\s\S]*?\n  \];/,'  quotes = '+JSON.stringify(quotes)+';');
 home=home.replace(/const ind = \[[^\n]+\];/,'const ind = '+JSON.stringify(industryContent.map(i=>i.title[locale]))+';');
 // Root-relative resource URL is required for the /en/ homepage.
 home=home.replace("new URL('./cubo.js', document.baseURI)","new URL('/cubo.js', document.baseURI)");
 const cubeLabels=[['Automatización','AI automation','Flujos que trabajan solos.','Workflows that run for you.'],['Desarrollo Web & Apps','Web & apps','Tu operación, conectada.','Your operations, connected.'],['WhatsAgent','WhatsAgent','Tu marca en cada conversación.','Your brand in every conversation.'],['Consultoría TI','IT consulting','Claridad antes de construir.','Clarity before building.']];
 let cubeIndex=0;home=home.replace(/\{ title: '[^']+', caption: '[^']+', icon:/g,()=>{const v=cubeLabels[cubeIndex++];if(!v)throw new Error('Unexpected cube label');return `{ title: ${JSON.stringify(v[locale==='es'?0:1])}, caption: ${JSON.stringify(v[locale==='es'?2:3])}, icon:`;});
 home=home.replace(/<div style="flex:2 1 0;[^>]*>\[ foto&nbsp;\{\{ sv.n \}\}&nbsp;\]<\/div>\s*<div style="flex:1 1 0;[^>]*><\/div>/,`<div class="home-service-plate" aria-hidden="true"><div class="plate-label"><span>PIXELTEC / {{ sv.n }}</span><span>↗</span></div><div class="plate-mark">{{ sv.symbol }}</div><div class="plate-label"><span>{{ sv.t }}</span><span>●</span></div></div>`);
 home=home.replace(/<div style="grid-column:\{\{ whyPhotoSpan \}\};[^>]*>\[ foto equipo PixelTEC \]<\/div>/,`<div class="home-founder" style="grid-column:{{ whyPhotoSpan }};grid-row:{{ whyPhotoRow }}"><img src="/assets/miguel-robles.webp" alt="Miguel Robles Sánchez" width="640" height="640" loading="lazy" decoding="async"><div><strong>Miguel Robles Sánchez</strong><span>Founder & Lead Software Architect</span></div></div>`);
 home=home.replace(/<div style="aspect-ratio:(?:16\/10|1\/1);[^>]*>\[ captura&nbsp;\{\{ p.name \}\}&nbsp;\]<\/div>/g,`<div class="home-case-plate" data-case="{{ p.id }}"><span>{{ p.name }} / {{ p.label }}</span><strong>{{ p.headline }}</strong><span>PIXELTEC</span></div>`);
 home=home.replace(/<div style="margin-top:auto;width:62%;[^>]*>\[ foto \]<\/div>/g,`<div class="home-insight-symbol"><span>${x('IDEAS PARA DECIDIR','IDEAS FOR DECISIONS')}</span><b aria-hidden="true">↗</b></div>`);
 const newsletterStart=home.indexOf('    <div style="position:relative;overflow:hidden;border-radius:',home.indexOf('<section id="blog"'));
 const newsletterEnd=home.indexOf('  <div style="max-width:1440px;margin:0 auto">',newsletterStart);
 if(newsletterStart<0||newsletterEnd<0)throw new Error('Newsletter anchor missing');
 home=home.slice(0,newsletterStart)+`<div class="home-editorial-block"><div><p class="home-edition">PIXELTEC / ${x('PERSPECTIVAS','PERSPECTIVES')}</p><h3>${x('Mejores preguntas.<br>Mejores decisiones.','Better questions.<br>Better decisions.')}</h3><p>${x('Tecnología práctica para empresas que quieren crecer. Explora nuestras guías sobre IA, software y automatización.','Practical technology for businesses that want to grow. Explore our guides on AI, software and automation.')}</p><a href="${localPath('/blog/',locale)}">${x('Explorar el blog','Explore the journal')} ↗</a></div><div class="home-editorial-orbit" aria-hidden="true">✳</div></div>\n`+home.slice(newsletterEnd);
 // Remove unused photo-column renderer and signup handlers from the generated copy.
 home=home.replace(/      nlColumns: [^\n]+\n/,'').replace(/      subLabel: [^\n]+\n/,'').replace(/      subscribe: [^\n]+\n/,'');
 home=home.replace('<button aria-label="Menú"',langSwitch('/',locale)+'<button aria-label="Menú"');
 home=home.replace('<h1 style=',`<p class="home-edition">${company.tagline[locale]}</p><h1 style=`);
 home=home.replace('Responde 4 preguntas y comparte tus datos: revisamos tu caso y te proponemos un siguiente paso claro, sin soluciones genéricas.',x('Responde 4 preguntas para ordenar tu punto de partida. Después tú decides si compartes el resumen con nuestro equipo.','Answer four questions to organize your starting point, then choose whether to share the summary with our team.'));
 home=home.replace('En menos de 3 minutos analizaremos tu situación actual y prepararemos una sesión mucho más productiva.',x('Unos minutos de contexto para una conversación mucho más productiva.','A few minutes of context make the next conversation more useful.'));
 home=home.replace('<footer ',`<section class="home-local"><div><p class="home-edition">${x('PRESENCIA LOCAL','LOCAL PRESENCE')}</p><h2>${x('Desde Puerto Vallarta.<br>Conectados con tu negocio.','From Puerto Vallarta.<br>Connected to your business.')}</h2><p>${x('Trabajamos con empresas de todo México, con presencia local en Puerto Vallarta, Bahía de Banderas, Guadalajara y Zapopan.','We work with businesses across Mexico, with a local presence in Puerto Vallarta, Bahía de Banderas, Guadalajara and Zapopan.')}</p><div class="home-local-links">${[['Puerto Vallarta','puerto-vallarta'],['Bahía de Banderas','bahia-de-banderas'],['Guadalajara','guadalajara'],['Zapopan','zapopan']].map(([n,s])=>`<a href="${localPath('/desarrollo-web-'+s+'/',locale)}">${n}<span>↗</span></a>`).join('')}</div></div></section><footer `);
 home=home.replace('>WhatsApp directo</a>','>WhatsApp directo</a><a href="mailto:contacto@pixeltec.mx" style="color:#ffffff">contacto@pixeltec.mx</a>');
 if(locale==='en') {
   for(const [from,to] of Object.entries(en).sort((a,b)=>b[0].length-a[0].length))home=home.replaceAll(from,to);
   home=home.replace('lang="es"','lang="en"');
   home=home.replace(/href="(\/[^"{}]*)"/g,(full:string,path:string)=>path.startsWith('/en/')||path==='/en/'||/\.[a-z0-9]+$/i.test(path)?full:`href="${localPath(path,locale)}"`);
   // Switching language is always reciprocal, never localized into itself.
   home=home.replace(/(<a class="language-link" href=")[^"]+/, '$1/');
 }
 // Shared public navigation replaces only the generated menu, preserving source bytes.
 home=home.replace('<header style=', '<header class="home-header" style=');
 home=home.replace(/(<header[^>]*>\s*)<nav[\s\S]*?<\/nav>/,`$1<nav class="site-primary-nav" aria-label="${x('Navegación principal','Main navigation')}">${homeNavigation(locale)}</nav>`);
 home=home.replace(/<sc-if value="\{\{ isMobile \}\}" hint-placeholder-val="\{\{ false \}\}">\s*<nav[\s\S]*?<\/nav>\s*<\/sc-if>/,`<nav class="home-drawer-nav" aria-label="${x('Todas las páginas','All pages')}">${homeNavigation(locale,true)}</nav>`);
 // Reuse the same brand geometry without changing the supplied source or SVG sizing.
 home=home.replace(/(<svg viewBox="0 0 40 44"[^>]*>)[\s\S]*?<\/svg>/g,(_,open:string)=>open+brandMark+'</svg>');
 const title=locale==='es'?'Desarrollo Web, Apps y Automatización con IA en Puerto Vallarta':'Web & App Development and AI Automation | PixelTEC';
 home=home.replace(/<title>[^<]+<\/title>/,`<title>${title}</title>`);
 const canonical=locale==='es'?'https://pixeltec.mx':'https://pixeltec.mx/en';
 home=home.replace('</head>',`<meta name="description" content="${esc(company.description[locale])}"><link rel="canonical" href="${canonical}">${languageAlternates("/")}${socialMetadata(title,company.description[locale],locale==='es'?'/':'/en/',locale)}<link rel="stylesheet" href="/content.css"></head>`);
 return home;
}
