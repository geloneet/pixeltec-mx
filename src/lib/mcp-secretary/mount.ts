import {canonicalAuthority,canonicalSnapshot,canonicalFollowup,type Grant} from './canonical';
import {Ledger,Secretary} from './runtime/core.mjs';
import {PgStore} from './runtime/pg-store.mjs';
import {db} from '@/lib/db';
import {httpHandler} from './runtime/mcp.mjs';

/** Explicit composition root for the future server-only Next route. Construct
 * once per worker; lifecycle owner closes ledger during orderly shutdown.
 * No defaults mint grants, trust token subjects, or open network listeners. */
export function createCommercialMcp(options:{
 store?:InstanceType<typeof PgStore>;
 authenticate:(request:Request)=>Promise<{issuer:string;subject:string;scopes:string[]}|null>;
 resolveGrant:(identity:{issuer:string;subject:string;scopes:string[]})=>Promise<Grant|null>;
 origins:string[];
 hosts:string[];
 resourceMetadataUrl:string;
 approval?:Function;
 enableFollowupWrites?:boolean;
 registerExtraTools?:Function;
}) {
 if(!options.authenticate || !options.resolveGrant)throw new Error('CONFIGURATION_REQUIRED');
 const ledger=new Ledger(options.store??new PgStore(db.$client));
 const secretary=new Secretary({ledger,authority:canonicalAuthority(options.resolveGrant),snapshot:canonicalSnapshot,allowedEntities:['contacts','opportunities','projects','quotes'],
  execute:options.enableFollowupWrites?canonicalFollowup:undefined,
  approval:options.enableFollowupWrites?options.approval:undefined});
 return {handle:httpHandler({...options,secretary,enableFollowupTools:options.enableFollowupWrites===true}),close:()=>ledger.close()};
}
