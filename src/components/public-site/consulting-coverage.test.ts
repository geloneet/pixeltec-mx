import {describe,expect,it} from 'vitest';
import pages from './generated/pages.json';
import type {PublicNode} from './tree';
import {CONSULTORIA_CITIES} from '@/lib/content/local-services';
import {SITE} from '@/lib/site-config';

type GeneratedPage={body:PublicNode;noindex:boolean;schemas:{'@graph'?:Record<string,unknown>[]}[]};
const catalog=pages as unknown as Record<string,GeneratedPage>;
function elements(node:PublicNode):Exclude<PublicNode,string>[] {
  return typeof node==='string'?[]:[node,...node.children.flatMap(elements)];
}
function text(node:PublicNode):string {
  return typeof node==='string'?node:node.children.map(text).join('');
}

describe('compiled consulting discovery',()=>{
  it('links every registered consulting location from the service hub with descriptive text',()=>{
    const links=elements(catalog['/services/consultoria']!.body).filter(n=>n.tag==='a');
    for(const city of CONSULTORIA_CITIES){
      const target=links.find(n=>n.attrs.href===`/${city.slug}/`);
      expect(target,city.slug).toBeDefined();
      expect(text(target!)).toContain(`Consultoría tecnológica en ${city.city}`);
    }
  });

  it('keeps each linked Spanish destination indexable and its English counterpart excluded',()=>{
    for(const city of CONSULTORIA_CITIES){
      expect(catalog[`/${city.slug}`]?.noindex,city.slug).toBe(false);
      expect(catalog[`/en/${city.slug}`]?.noindex,city.slug).toBe(true);
    }
    expect(catalog['/en/services/consultoria']?.noindex).toBe(true);
    expect(elements(catalog['/services/consultoria']!.body).filter(n=>n.tag==='h1')).toHaveLength(1);
  });

  it('exports the canonical brand logo without a second identity in generated page graphs',()=>{
    for(const [path,page] of Object.entries(catalog)){
      const organization=page.schemas.flatMap(s=>s['@graph']??[]).find(n=>n['@id']===`${SITE.url}/#organization`);
      expect(organization?.logo,path).toBe(SITE.url+SITE.logoPath);
    }
  });
});
