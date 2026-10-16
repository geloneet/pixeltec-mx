import { createPublicKey, verify } from 'node:crypto';
import { Denied } from './core.mjs';
/** Resource-server verification only. Does not create an issuer/client/grant.
 * Host supplies pinned issuer/audience and an allowlisted JWKS key resolver.
 * Never fetch a jku/x5u URL supplied by a token. No token passthrough to CRM. */
export function oauthVerifier({issuer,audience,resolveKey,isRevoked,clock=Date.now}) {
  if (!issuer || !audience || !resolveKey || !isRevoked) throw new Error('AUTH_CONFIGURATION_REQUIRED');
  return async request=>{
    const auth=request.headers.get('authorization');
    if (!auth?.startsWith('Bearer ') || auth.length>16384) throw new Denied('UNAUTHENTICATED');
    const token=auth.slice(7), parts=token.split('.');
    if (parts.length!==3) throw new Denied('UNAUTHENTICATED');
    try {
      const h=JSON.parse(Buffer.from(parts[0],'base64url')),c=JSON.parse(Buffer.from(parts[1],'base64url'));
      if (h.alg!=='RS256' || typeof h.kid!=='string' || h.crit || h.jku || h.x5u) throw 0;
      const key=await resolveKey(h.kid);
      if (!key || !verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey(key),Buffer.from(parts[2],'base64url'))) throw 0;
      const now=Math.floor(clock()/1000),aud=Array.isArray(c.aud)?c.aud:[c.aud];
      if(c.iss!==issuer || !aud.includes(audience) || typeof c.sub!=='string' || !c.sub || typeof c.exp!=='number' || !Number.isFinite(c.exp) || c.exp<=now || (c.nbf!==undefined && (typeof c.nbf!=='number' || !Number.isFinite(c.nbf) || c.nbf>now)) || typeof c.scope!=='string') throw 0;
      if (await isRevoked(c)) throw 0;
      return {subject:c.sub,issuer:c.iss,scopes:c.scope.split(' ').filter(Boolean)};
    } catch { throw new Denied('UNAUTHENTICATED'); }
  };
}
