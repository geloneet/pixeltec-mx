/** Thin asynchronous PostgreSQL repository transport. Host injects the existing
 * postgres-js pool (or its transaction); never connects, migrates, reads env,
 * provisions credentials, opens listeners, or owns the shared pool lifecycle. */
export class PgStore {
 constructor(client,{schema='mcp_secretary',transaction=false}={}){
  if(!client?.unsafe||!client?.begin&&!transaction||!/^[a-z][a-z0-9_]{0,62}$/.test(schema))throw new Error('POSTGRES_STORE_CONFIGURATION_REQUIRED');
  Object.assign(this,{client,schema,transaction});
 }
 sql(query){return query.replaceAll('mcp_secretary.',`"${this.schema}".`);}
 async all(query,...params){
  const rows=await this.client.unsafe(this.sql(query),params);
  return Array.from(rows,row=>Object.fromEntries(Object.entries(row).map(([k,v])=>{
   if(['seq','at','expires','credential_epoch','n'].includes(k)&&typeof v==='string'&&/^-?\d+$/.test(v)){const n=Number(v);if(!Number.isSafeInteger(n))throw new Error('POSTGRES_INTEGER_RANGE');return[k,n];}return[k,v];
  })));
 }
 async one(query,...params){return(await this.all(query,...params))[0];}
 async run(query,...params){const rows=await this.client.unsafe(this.sql(query),params);return{changes:Number(rows.count??rows.length)};}
 async atomic(fn){
  if(this.transaction) return fn(this);
  return this.client.begin(async tx=>fn(new PgStore(tx,{schema:this.schema,transaction:true})));
 }
 async audit(owner,action,ref,status,domain='crm',at=Date.now()){
  await this.run('INSERT INTO mcp_secretary.audit(domain,at,owner,action,ref,status) VALUES($1,$2,$3,$4,$5,$6)',domain,at,owner,action,ref??null,status);
 }
 close(){} // Existing CRM pool remains owned by the host.
}
