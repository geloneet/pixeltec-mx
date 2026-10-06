import {projectImage,projectVisual} from './project-media.js';
import {languageAlternates,socialMetadata} from './seo-policy.js';
import {brandMark} from './brand.js';
import {homeNavigation} from './navigation.js';
import {company,serviceContent,marketedServices,caseStudies,featuredCaseStudies,testimonials,industryContent,editorial,method} from './content.js';
import {langSwitch,localPath,type Locale} from './i18n.js';
import {escapeHTML as esc} from './catalog.js';
import {en} from './home-translations.js';
import {sharedFooter} from './shared-footer.js';
import {diagnosticWidget} from './diagnostic.js';

export function homeContent(home:string,locale:Locale):string {
 const x=(a:string,b:string):string=>locale==='es'?a:b;
 home=home.replace(/<p([^>]*)>(<span[^>]*>Somos arquitectos[\s\S]*?<\/span>)<\/p>/,'<h2$1>$2</h2>');

 const replaceArray=(key:string,items:unknown[],next:string):void=>{
  const start=home.indexOf('      '+key+': [');const end=home.indexOf('      '+next+':',start);
  if(start<0||end<0)throw new Error('Home content anchor missing: '+key);
  home=home.slice(0,start)+'      '+key+': '+JSON.stringify(items)+',\n'+home.slice(end);
 };
 home=home.replace('<div style="display:flex;flex-direction:column;padding:clamp(28px,3vw,44px)', '<div class="about-depth-card" style="display:flex;flex-direction:column;padding:clamp(28px,3vw,44px)');
 home=home.replace('<span style="font-weight:700;font-size:18px">{{ ac.n }}</span>', '<div class="about-depth-art" data-form="{{ ac.n }}" aria-hidden="true"><i></i><i></i><i></i><i></i></div><span style="font-weight:700;font-size:18px">{{ ac.n }}</span>');
 replaceArray('aboutCards',[
 {n:'001.',t:x('Un aliado estratégico','A strategic partner'),d:company.about[locale]},
 {n:'002.',t:x('Entender antes de construir','Understand before building'),d:x('Combinamos consultoría empresarial con desarrollo de software. Primero entendemos la operación, después elegimos la tecnología.','We combine business consulting and software development. We understand the operation first, then choose the technology.')},
 {n:'003.',t:x('El equipo que tu proyecto necesita','The team your project needs'),d:company.team[locale]}
 ],'cubeRef');
 replaceArray('svc',marketedServices.map((s,i)=>({n:'0'+(i+1),href:localPath(s.path,locale),t:s.title[locale],d:s.description[locale],tags:s.category[locale].split(' · '),image:`/assets/services/${s.id}-3d-1280.webp`,imageSet:`/assets/services/${s.id}-3d-640.webp 640w, /assets/services/${s.id}-3d-1280.webp 1280w`})),'whyCols');
 replaceArray('whyStats',[
 {n:x('A tu medida','Built for you'),suf:'',label:x('Software diseñado alrededor de tu operación.','Software designed around your operations.')},
 {n:x('Todo conectado','Connected systems'),suf:'',label:x('Integramos tus herramientas para simplificar el trabajo.','We integrate your tools to simplify work.')},
 {n:x('Contigo, paso a paso','With you, step by step'),suf:'',label:x('Te acompañamos desde el diagnóstico hasta la evolución.','We support you from assessment through continued improvement.')}
 ],'whyItems');
 home=home.replace('font-size:clamp(56px,5.4vw,84px);line-height:1;letter-spacing:-.05em">{{ st.n }}','font-size:clamp(28px,2.7vw,40px);line-height:1.08;letter-spacing:-.035em">{{ st.n }}');

 replaceArray('whyItems',method.map(f=>({t:f.title[locale],d:f.body[locale]})),'footCols');
 const cases=featuredCaseStudies.map(c=>({app:c.id==='subsify',conceptual:!projectImage(c.id)&&c.id!=='subsify',image:projectImage(c.id)?.src??'',imageSet:projectImage(c.id)?`${projectImage(c.id)!.small} 640w, ${projectImage(c.id)!.src} 1280w`:'',imageWidth:projectImage(c.id)?.width??1280,imageHeight:projectImage(c.id)?.height??800,href:localPath(c.path,locale),id:c.id,name:c.name,tags:[c.category[locale]],short:c.scope[locale],label:c.category[locale],headline:c.id==='villa-nogal'?x('Una experiencia de reserva propia.','A booking experience of their own.'):c.id==='pipas-tondoroque'?x('Pedidos que siguen su curso.','Orders that keep moving.'):c.id==='barro-stock'?x('Cada pieza, en su lugar.','Every piece in its place.'):c.id==='smile-more'?x('Más control. Mejor atención.','More control. Better care.'):x('Tradición que evoluciona.','Tradition that evolves.')}));
 replaceArray('projTop',cases.slice(0,2),'projBottom');replaceArray('projBottom',cases.slice(2),'projects');replaceArray('projects',cases,'nlColumns');
 replaceArray('posts',editorial.slice(0,4).map(p=>({href:localPath(p.path,locale),cat:p.category[locale],date:new Intl.DateTimeFormat(locale==='es'?'es-MX':'en-US',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(p.date+'T12:00:00Z')),title:p.title[locale],excerpt:p.description[locale]})),'industries');
 const quotes=testimonials.map(c=>({text:c.quote[locale],name:c.person,role:c.role[locale],title:c.name}));
 home=home.replace(/  quotes = \[[\s\S]*?\n  \];/,'  quotes = '+JSON.stringify(quotes)+';');
 home=home.replace(/const ind = \[[^\n]+\];/,'const ind = '+JSON.stringify(industryContent.map(i=>i.title[locale]))+';');
 // Root-relative resource URL is required for the /en/ homepage.
 home=home.replace("new URL('./cubo.js', document.baseURI)","new URL('/cubo.js', document.baseURI)");
 home=home.replace("React.createElement('span', { style: { color: '#1466ff' } }, '✦')","React.createElement('span', { 'aria-hidden': true, style: { width: 12, height: 12, flexShrink: 0, background: '#1466ff', boxShadow: '5px -5px 0 #76a5ff' } })");
 const cubeLabels=[['Automatización','AI automation','Flujos que trabajan solos.','Workflows that run for you.'],['Desarrollo Web & Apps','Web & apps','Tu operación, conectada.','Your operations, connected.'],['WhatsAgent','WhatsAgent','Tu marca en cada conversación.','Your brand in every conversation.'],['Consultoría TI','IT consulting','Claridad antes de construir.','Clarity before building.']];
 let cubeIndex=0;home=home.replace(/\{ title: '[^']+', caption: '[^']+', icon:/g,()=>{const v=cubeLabels[cubeIndex++];if(!v)throw new Error('Unexpected cube label');return `{ title: ${JSON.stringify(v[locale==='es'?0:1])}, caption: ${JSON.stringify(v[locale==='es'?2:3])}, icon:`;});
 home=home.replace(/<div style="flex:2 1 0;[^>]*>\[ foto&nbsp;\{\{ sv.n \}\}&nbsp;\]<\/div>\s*<div style="flex:1 1 0;[^>]*><\/div>/,`<div class="home-service-image" aria-hidden="true"><img src="{{ sv.image }}" srcset="{{ sv.imageSet }}" sizes="(max-width: 639px) 90vw, (max-width: 999px) 80vw, 600px" width="1536" height="1024" alt="" loading="lazy" decoding="async"></div>`);
 home=home.replace(/<div style="grid-column:\{\{ whyPhotoSpan \}\};[^>]*>\[ foto equipo PixelTEC \]<\/div>/,`<div class="home-method-visual" style="grid-column:{{ whyPhotoSpan }};grid-row:{{ whyPhotoRow }}" aria-hidden="true"><img src="/assets/pixeltec-method-1080.webp" srcset="/assets/pixeltec-method-640.webp 640w, /assets/pixeltec-method-1080.webp 1080w" sizes="(max-width: 639px) 90vw, (max-width: 999px) 80vw, 550px" alt="" width="1080" height="1440" loading="lazy" decoding="async"></div>`);
 home=home.replace(/<div style="aspect-ratio:(?:16\/10|1\/1);[^>]*>\[ captura&nbsp;\{\{ p.name \}\}&nbsp;\]<\/div>/g,`<sc-if value="{{ p.image }}"><div class="home-case-shot"><img src="{{ p.image }}" srcset="{{ p.imageSet }}" sizes="(max-width: 759px) 90vw, (max-width: 1100px) 45vw, 660px" alt="{{ p.name }}" width="{{ p.imageWidth }}" height="{{ p.imageHeight }}" loading="lazy" decoding="async"></div></sc-if><sc-if value="{{ p.app }}">${projectVisual(caseStudies.find(c=>c.id==='subsify')!,locale)}</sc-if><sc-if value="{{ p.conceptual }}"><div class="home-case-plate" data-case="{{ p.id }}"><span>{{ p.name }} / {{ p.label }}</span><strong>{{ p.headline }}</strong><span>${x('REPRESENTACIÓN CONCEPTUAL','CONCEPTUAL VISUAL')}</span></div></sc-if>`);
 home=home.replace(/<div style="margin-top:auto;width:62%;[^>]*>\[ foto \]<\/div>/g,`<div class="home-insight-symbol"><span>${x('IDEAS PARA DECIDIR','IDEAS FOR DECISIONS')}</span><b aria-hidden="true">↗</b></div>`);
 const newsletterStart=home.indexOf('    <div style="position:relative;overflow:hidden;border-radius:',home.indexOf('<section id="blog"'));
 const newsletterEnd=home.indexOf('  <div style="max-width:1440px;margin:0 auto">',newsletterStart);
 if(newsletterStart<0||newsletterEnd<0)throw new Error('Newsletter anchor missing');
 home=home.slice(0,newsletterStart)+`<div class="home-editorial-block"><div><p class="home-edition">PIXELTEC / ${x('PERSPECTIVAS','PERSPECTIVES')}</p><h3>${x('Mejores preguntas.<br>Mejores decisiones.','Better questions.<br>Better decisions.')}</h3><p>${x('Tecnología práctica para empresas que quieren crecer. Explora nuestras guías sobre IA, software y automatización.','Practical technology for businesses that want to grow. Explore our guides on AI, software and automation.')}</p><a href="${localPath('/blog/',locale)}">${x('Explorar el blog','Explore the journal')} ↗</a></div><div class="home-editorial-visual" aria-hidden="true"><img src="/assets/pixeltec-editorial-1280.webp" srcset="/assets/pixeltec-editorial-640.webp 640w, /assets/pixeltec-editorial-1280.webp 1280w" sizes="(max-width:759px) 85vw, 560px" width="1448" height="1086" alt="" loading="lazy" decoding="async"></div></div>\n`+home.slice(newsletterEnd);
 // Remove unused photo-column renderer and signup handlers from the generated copy.
 home=home.replace(/      nlColumns: [^\n]+\n/,'').replace(/      subLabel: [^\n]+\n/,'').replace(/      subscribe: [^\n]+\n/,'');
 home=home.replace('<button aria-label="Menú"',langSwitch('/',locale)+'<button aria-label="Menú"');
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
 home=home.replace(/<footer[\s\S]*?<\/footer>/,sharedFooter(locale));
 home=home.replace(/(<div style="border-radius:10px;background:#ffffff;color:#0b0b0a;[^"]*")>/,'$1 class="home-diagnostic-card"><div data-diagnostic-intro>');
 const contactEnd=home.indexOf('\n    </div>\n  </div>\n</section>',home.indexOf('class="home-diagnostic-card"'));
 if(contactEnd<0)throw new Error('Diagnostic card anchor missing');
 home=home.slice(0,contactEnd)+`</div><div data-inline-diagnostic hidden="true">${diagnosticWidget(locale)}</div>`+home.slice(contactEnd);
 home=home.replace(/<a href="[^"]*"([^>]*?)>(Comenzar →|Get started →)<\/a>/,`<button type="button" data-start-diagnostic aria-expanded="false"$1>$2</button>`);
 home=home.replace('</head>','<script type="module" src="/diagnostic-client.js"></script></head>');
 home=home.replaceAll('hidden="true"','hidden="{{ true }}"');
 // The shared footer uses CSS texture; remove its now-unused canvas renderer.
 home=home.replace(/  initSand2\(\) \{[\s\S]*?\n  quotes =/, '  quotes =').replaceAll('this.initSand2();','').replace('  sand2Ref = React.createRef();','').replace('      sand2Ref: this.sand2Ref,','');
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
