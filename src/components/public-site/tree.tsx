import {LeadFollowup} from './lead-followup';
import {createElement, type CSSProperties, type ReactNode} from 'react';
import Link from 'next/link';
export type PublicNode=string|{tag:string;attrs:Record<string,string|boolean|CSSProperties>;children:PublicNode[]};
export function PublicTree({node}:{node:PublicNode}):ReactNode {
 if(typeof node==='string')return node;
 const {tag,attrs,children}=node;
 // Error previews are not destinations in the public page directory.
 if(tag==='a'&&typeof attrs.href==='string'&&/^\/(en\/)?404\/?$/.test(attrs.href))return null;
 const internal=tag==='a'&&typeof attrs.href==='string'&&attrs.href.startsWith('/')&&!attrs.href.startsWith('//');
 const content:ReactNode[]=children.map((child,index)=>createElement(PublicTree,{key:index,node:child}));
 if('data-summary' in attrs)content.push(createElement(LeadFollowup,{key:'followup'}));
 if(internal)return createElement(Link,{...attrs,href:attrs.href as string},...content);
 return createElement(tag,attrs,...content);
}
