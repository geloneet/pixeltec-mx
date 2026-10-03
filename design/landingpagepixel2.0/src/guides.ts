import {bi} from './i18n.js';
import {serviceContent,type ContentItem} from './content.js';
const cities:Record<string,string>={'puerto-vallarta':'Puerto Vallarta','bahia-de-banderas':'Bahía de Banderas',guadalajara:'Guadalajara',zapopan:'Zapopan'};
const summaries:Record<string,[string,string]>={
 'empresas-de-desarrollo-de-software':['Choosing a software development company','How to evaluate a software provider, recognize warning signs and establish what a finished project should include. A strong choice considers documentation, continuity and clear responsibilities.'],
 'programador-de-software':['Hiring a software developer or a team','Understand the role of a software developer, when one person is enough and when your project needs a wider team. Evaluate continuity, documentation and support alongside technical skills.'],
 'sistemas-a-medida':['Custom systems or SaaS: when each makes sense','Custom software and off-the-shelf tools solve different problems. Compare the fit with your process, operating constraints and ability to evolve; in some cases, combining both is the right approach.'],
 'software-a-medida-para-empresas':['Custom business software: return, process and cost','Evaluate the return on a custom software project using your own operating data. Scope, integrations and complexity affect the investment; avoid estimates built on generic savings claims.'],
 'sistema-personalizado-para-empresas':['Custom business systems: what gets built','Inventory control, quoting, sales follow-up and customer portals are common starting points. Decide how the system connects to existing tools and how data and ownership will be handled.'],
 'automatiza-tu-negocio':['Automate your business: where to begin','Identify repetitive work by department and choose a first process using evidence from your operation. Automation should give your team time back and make previously informal work visible.'],
 'automatizar-mensajes-de-whatsapp':['Automating WhatsApp messages: how it works','Understand the difference between responses, templates and automated workflows. Plan around the official platform, customer consent and a clear route to a human team member.'],
 'automatizar-whatsapp-business':['WhatsApp Business automation: app or API?','The WhatsApp Business app and the WhatsApp Business Platform offer different capabilities. Choose based on message volume, team coordination and the integrations your business needs.'],
 'automatizacion-de-mensajes-en-whatsapp':['WhatsApp message automation: cases and metrics','Start with a business outcome, then measure whether automation improved it. Response times, useful conversations and handovers provide more insight than the number of automated messages.'],
 'desarrolladores-de-app':['App developers: the team behind the project','Building an app involves product definition, design, engineering and quality assurance. Clarify who is responsible for each stage and who will maintain the application after launch.'],
 'desarrollo-de-app':['App development: the process, stage by stage','Agree on what will be built, in what order and who makes decisions. Discovery, design, development, testing and delivery each need clear scope and deliverables.'],
 'desarrolladores-de-apps':['Web app, PWA or mobile app?','A browser-based application, an installable PWA and a native mobile app serve different needs. Choose the format around users, devices, connectivity and operational requirements.'],
 'desarrollo-de-aplicaciones-moviles':['Mobile app development: iOS, Android and PWA','Platform choice, implementation approach and ongoing maintenance shape a mobile project. Plan for updates, testing and distribution as well as the first release.']
};
const localIntro:Record<string,string>={
 'automatizacion-guadalajara':'Bots, scripts and AI workflows for businesses in Guadalajara that need to reduce repetitive manual work and gain control of daily operations.',
 'automatizacion-zapopan':'AI automation for professional firms, insurers and service businesses in Zapopan, focused on document intake and customer follow-up.',
 'automatizacion-puerto-vallarta':'Based in Puerto Vallarta, PixelTEC designs bots and automated workflows for hotels, restaurants, real estate businesses and service agencies around the bay.',
 'automatizacion-bahia-de-banderas':'Process automation for condominium managers, property developments and hospitality businesses in Bahía de Banderas and the Riviera Nayarit.',
 'desarrollo-web-guadalajara':'Custom CRMs, business portals and e-commerce platforms for Guadalajara companies that need technology designed around their own operations.',
 'desarrollo-web-zapopan':'Custom client portals, CRMs and business websites for professional firms, insurers and service businesses in Zapopan.',
 'desarrollo-web-puerto-vallarta':'Based in Puerto Vallarta, PixelTEC builds websites, booking engines and custom portals for hotels, restaurants and real estate businesses around the bay.',
 'desarrollo-web-bahia-de-banderas':'Custom portals for property developments, condominium managers and vacation rental businesses in Bahía de Banderas.',
 'consultoria-guadalajara':'Process and system audits for Guadalajara companies, leading to a practical digital transformation strategy built around business priorities.',
 'consultoria-zapopan':'A clear digital strategy for professional firms, insurers and property managers in Zapopan, before investing in new systems.',
 'consultoria-puerto-vallarta':'Based in Puerto Vallarta, PixelTEC helps hotels, restaurants and real estate businesses around the bay plan their digital transformation.',
 'consultoria-bahia-de-banderas':'Digital transformation planning for property developments and management companies in Bahía de Banderas, before investing in systems.'
};
export function guideContent(path:string,title:string,intro:string):ContentItem {
 const slug=path.slice(1,-1);const cityKey=Object.keys(cities).find(c=>slug.endsWith('-'+c));const city=cityKey?cities[cityKey]:undefined;
 const base=cityKey?slug.slice(0,-cityKey.length-1):slug;
 const service=serviceContent.find(s=>s.id===(slug.startsWith('consultoria-')?'consulting':/automatiz|whatsapp/.test(slug)?'automation':'web'))!;
 const summary=summaries[base];
 const enTitle=summary?summary[0]+(city?' in '+city:''):(base==='automatizacion'?'AI process automation':base==='consultoria'?'Strategic IT consulting':'Web development & digital ecosystems')+(city?' in '+city:'');
 const enIntro=localIntro[slug]??((city?'For businesses in '+city+': ':'')+(summary?.[1]??service.description.en)+(city?' We start by understanding the local operation, seasonal demands and the way your team and customers work.':''));
 return {id:slug,path,title:bi(title,enTitle),description:bi(intro,enIntro),category:bi(city?'Presencia local':'Guías para decidir',city?'Local presence':'Decision guides'),visual:service.visual,features:service.features,source:'https://pixeltec.mx'+path.slice(0,-1)};
}
