import {escapeHTML as esc} from './catalog.js';
import {art} from './art.js';
import type {Locale} from './i18n.js';
import type {CaseStudy} from './content.js';
interface ProjectImage {src:string;small:string;width:number;height:number;smallWidth:number;}
const images:Record<string,ProjectImage> = {
  "villa-nogal": {
    "src": "/assets/projects/villa-nogal-1280.webp",
    "small": "/assets/projects/villa-nogal-640.webp",
    "width": 1280,
    "height": 801,
    "smallWidth": 640
  },
  "dalk": {
    "src": "/assets/projects/dalk-1280.webp",
    "small": "/assets/projects/dalk-640.webp",
    "width": 1280,
    "height": 801,
    "smallWidth": 640
  },
  "barro-stock": {
    "src": "/assets/projects/barro-stock-1280.webp",
    "small": "/assets/projects/barro-stock-640.webp",
    "width": 1280,
    "height": 857,
    "smallWidth": 640
  },
  "smile-more": {
    "src": "/assets/projects/smile-more-1280.webp",
    "small": "/assets/projects/smile-more-640.webp",
    "width": 1280,
    "height": 876,
    "smallWidth": 640
  },
  "velank": {
    "src": "/assets/projects/velank-1280.webp",
    "small": "/assets/projects/velank-640.webp",
    "width": 1280,
    "height": 846,
    "smallWidth": 640
  },
  "transportes-sanchez-jr": {
    "src": "/assets/projects/transportes-sanchez-jr-1280.webp",
    "small": "/assets/projects/transportes-sanchez-jr-640.webp",
    "width": 1280,
    "height": 884,
    "smallWidth": 640
  },
  "materiales-de-barro": {
    "src": "/assets/projects/materiales-de-barro-1280.webp",
    "small": "/assets/projects/materiales-de-barro-640.webp",
    "width": 1280,
    "height": 864,
    "smallWidth": 640
  },
  "subsify-es-01-home": {
    "src": "/assets/projects/subsify-es-01-home-960.webp",
    "small": "/assets/projects/subsify-es-01-home-480.webp",
    "width": 960,
    "height": 2086,
    "smallWidth": 480
  },
  "subsify-es-02-spending": {
    "src": "/assets/projects/subsify-es-02-spending-960.webp",
    "small": "/assets/projects/subsify-es-02-spending-480.webp",
    "width": 960,
    "height": 2086,
    "smallWidth": 480
  },
  "subsify-es-03-calendar": {
    "src": "/assets/projects/subsify-es-03-calendar-960.webp",
    "small": "/assets/projects/subsify-es-03-calendar-480.webp",
    "width": 960,
    "height": 2086,
    "smallWidth": 480
  },
  "subsify-es-04-family": {
    "src": "/assets/projects/subsify-es-04-family-960.webp",
    "small": "/assets/projects/subsify-es-04-family-480.webp",
    "width": 960,
    "height": 2086,
    "smallWidth": 480
  },
  "subsify-es-05-detail": {
    "src": "/assets/projects/subsify-es-05-detail-960.webp",
    "small": "/assets/projects/subsify-es-05-detail-480.webp",
    "width": 960,
    "height": 2086,
    "smallWidth": 480
  },
  "subsify-es-06-search": {
    "src": "/assets/projects/subsify-es-06-search-960.webp",
    "small": "/assets/projects/subsify-es-06-search-480.webp",
    "width": 960,
    "height": 2086,
    "smallWidth": 480
  },
  "subsify-en-01-home": {
    "src": "/assets/projects/subsify-en-01-home-960.webp",
    "small": "/assets/projects/subsify-en-01-home-480.webp",
    "width": 960,
    "height": 2086,
    "smallWidth": 480
  },
  "subsify-en-02-spending": {
    "src": "/assets/projects/subsify-en-02-spending-960.webp",
    "small": "/assets/projects/subsify-en-02-spending-480.webp",
    "width": 960,
    "height": 2086,
    "smallWidth": 480
  },
  "subsify-en-03-calendar": {
    "src": "/assets/projects/subsify-en-03-calendar-960.webp",
    "small": "/assets/projects/subsify-en-03-calendar-480.webp",
    "width": 960,
    "height": 2086,
    "smallWidth": 480
  },
  "subsify-en-04-family": {
    "src": "/assets/projects/subsify-en-04-family-960.webp",
    "small": "/assets/projects/subsify-en-04-family-480.webp",
    "width": 960,
    "height": 2086,
    "smallWidth": 480
  },
  "subsify-en-05-detail": {
    "src": "/assets/projects/subsify-en-05-detail-960.webp",
    "small": "/assets/projects/subsify-en-05-detail-480.webp",
    "width": 960,
    "height": 2086,
    "smallWidth": 480
  },
  "subsify-en-06-search": {
    "src": "/assets/projects/subsify-en-06-search-960.webp",
    "small": "/assets/projects/subsify-en-06-search-480.webp",
    "width": 960,
    "height": 2086,
    "smallWidth": 480
  }
};
export const projectImage=(id:string):ProjectImage|undefined=>images[id];
export const subsifyScreens=['01-home','02-spending','03-calendar','04-family','05-detail','06-search'] as const;
export function projectVisual(c:CaseStudy,locale:Locale,detail=false):string {
 if(c.id==='subsify')return '<div class="project-app-preview">'+subsifyScreens.slice(0,3).map(screen=>{const m=images['subsify-'+locale+'-'+screen]!;return '<img src="'+m.small+'" alt="'+(locale==='es'?'Subsify: ':'Subsify: ')+screen.slice(3)+'" width="'+m.width+'" height="'+m.height+'" loading="lazy" decoding="async">';}).join('')+'</div>';
 const m=images[c.id];if(!m)return art(c.visual,c.name,locale);
 return '<div class="project-screenshot'+(detail?' project-screenshot-detail':'')+'"><img src="'+m.src+'" srcset="'+m.small+' '+m.smallWidth+'w, '+m.src+' '+m.width+'w" sizes="'+(detail?'(max-width: 1320px) 92vw, 1280px':'(max-width: 700px) 92vw, (max-width: 1100px) 45vw, 620px')+'" alt="'+esc(c.name)+(locale==='es'?' — vista del proyecto':' — project preview')+'" width="'+m.width+'" height="'+m.height+'" loading="lazy" decoding="async"></div>';
}
export function subsifyGallery(locale:Locale):string {
 const labels=locale==='es'?['Tus suscripciones','Gastos','Calendario','Familia','Detalle','Búsqueda']:['Your subscriptions','Spending','Calendar','Family','Details','Search'];
 return '<section class="section wrap"><h2>'+(locale==='es'?'Subsify, pantalla a pantalla.':'Subsify, screen by screen.')+'</h2><div class="project-app-gallery">'+subsifyScreens.map((screen,i)=>{const m=images['subsify-'+locale+'-'+screen]!;return '<figure><img src="'+m.small+'" srcset="'+m.small+' '+m.smallWidth+'w, '+m.src+' '+m.width+'w" sizes="(max-width: 600px) 90vw, (max-width: 950px) 44vw, 380px" alt="Subsify — '+labels[i]+'" width="'+m.width+'" height="'+m.height+'" loading="lazy" decoding="async"><figcaption>'+labels[i]+'</figcaption></figure>';}).join('')+'</div></section>';
}
