"""Read-only snapshot of approved public HTML. No scripts, forms or requests are replayed."""
from html.parser import HTMLParser
from urllib.request import urlopen, Request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json, hashlib, re
from datetime import datetime, timezone
class Tree(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True); self.root={'tag':'root','attrs':{},'children':[]}; self.stack=[self.root]
 def handle_starttag(self,tag,attrs):
  n={'tag':tag,'attrs':dict(attrs),'children':[]}; self.stack[-1]['children'].append(n)
  if tag not in {'br','img','meta','link','input','hr','source','wbr','area','base','embed','param','track','col'}:self.stack.append(n)
 def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs);self.handle_endtag(tag)
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,0,-1):
   if self.stack[i]['tag']==tag:self.stack=self.stack[:i];break
 def handle_data(self,data):self.stack[-1]['children'].append({'tag':'text','text':data})
def walk(n):
 yield n
 for c in n.get('children',[]):yield from walk(c)
allowed={'span','h2','h3','h4','p','ul','ol','li','strong','em','a','blockquote','table','thead','tbody','tr','th','td','pre','code','br','div'}
skip={'script','style','svg','nav','header','footer','form','input','select','textarea','noscript','template','h1'}
def normalize(n):
 t=n['tag'];a=n.get('attrs',{})
 if t in skip:return []
 if t=='text':return [{'tag':'text','text':n['text']}] if n['text'].strip() else []
 if a.get('data-cfemail'):
  b=bytes.fromhex(a['data-cfemail']);return [{'tag':'text','text':''.join(chr(i^b[0]) for i in b[1:])}]
 children=[x for c in n.get('children',[]) for x in normalize(c)]
 if not children and t!='br':return []
 if t=='b':t='strong'
 if t=='i':t='em'
 if t=='button':t='strong'
 if t not in allowed:return children
 result={'tag':t,'children':children}
 if a.get('id'):result['id']=a['id']
 if t=='a':result['href']=a.get('href')
 return [result]
def capture(source):
 url=source['url'];req=Request(url,headers={'User-Agent':'PixelTEC-SEO-Verification/1.0'})
 with urlopen(req,timeout=45) as r:
  raw=r.read();status=r.status;final=r.url;headers={k:v for k,v in r.headers.items() if k.lower() in ['content-type','x-robots-tag','location']}
 tree=Tree();tree.feed(raw.decode('utf8'))
 mains=[n for n in walk(tree.root) if n['tag']=='main']
 if len(mains)!=1:raise ValueError(f'{url}: expected one main, found {len(mains)}')
 nodes=normalize(mains[0]); flat=list(walk(mains[0]))
 return {'url':url,'capturedAt':datetime.now(timezone.utc).isoformat(),'status':status,'finalUrl':final,'headers':headers,'sha256':hashlib.sha256(raw).hexdigest(),'nodes':nodes,'retainedCounts':{t:sum(n['tag']==t for root in nodes for n in walk(root)) for t in ['h2','h3','ul','ol','li','table']},'interactiveElements':sum(n['tag'] in ['input','select','textarea','form'] for n in flat),'counts':{t:sum(n['tag']==t for n in flat) for t in ['h1','h2','h3','ul','ol','li','table']}}
if __name__=='__main__':
 sources=json.loads(Path('docs/published-content-2026-10-03.json').read_text())
 with ThreadPoolExecutor(max_workers=3) as pool:rows=list(pool.map(capture,sources))
 Path('docs/public-rich-source-2026-10-03.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
 try:
  with urlopen('https://pixeltec.mx/sitemap.xml',timeout=45) as r:xml=r.read().decode()
  Path('docs/sitemap-current-2026-10-03.xml').write_text(xml)
 except Exception as error:
  xml=''; print('Current sitemap unavailable:',str(error))
 print(json.dumps({'pages':len(rows),'statuses':sorted(set(x['status'] for x in rows)),'sitemap_urls':len(re.findall(r'<loc>',xml)),'lists':sum(x['counts']['ul']+x['counts']['ol'] for x in rows),'tables':sum(x['counts']['table'] for x in rows),'pages_with_interactive_controls':sum(x['interactiveElements']>0 for x in rows)},ensure_ascii=False))
