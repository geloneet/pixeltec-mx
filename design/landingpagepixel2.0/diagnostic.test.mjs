import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import {evaluateDiagnostic,COMPANY_TYPES,COMPANY_SIZES,PRIORITIES,PROBLEMS} from './.build/diagnostic-logic.js';
// Compare against the existing application engine, not a second hand-written scoring oracle.
const source=(await readFile('../../src/lib/diagnostic/logic.ts','utf8')).replace(/import \{[\s\S]*?\} from 'lucide-react';/,'').replace(/, icon: \w+/g,'');
const {code}=await transform(source,{loader:'ts',format:'esm'});
const original=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('assessment preserves original results for all valid catalog combinations',()=>{
 for(const company of COMPANY_TYPES)for(const size of COMPANY_SIZES)for(const priority of PRIORITIES)for(let mask=1;mask<2**PROBLEMS.length;mask++){
  const answers={companyType:company.value,companySize:size.value,priority:priority.value,problems:PROBLEMS.filter((_,i)=>mask&(1<<i)).map(o=>o.value)};
  assert.deepEqual(evaluateDiagnostic(answers),original.computeDiagnostic({...answers,name:'',email:''}));
 }
});
test('assessment rejects invalid inputs and duplicate problems do not reduce score twice',()=>{
 const good={companyType:'logistica',companySize:'6-20',priority:'automatizar',problems:['manual']};
 assert.equal(evaluateDiagnostic(good).score,67);
 assert.deepEqual(evaluateDiagnostic({...good,problems:['manual','manual']}),evaluateDiagnostic(good));
 for(const input of [{}, {...good,problems:[]},{...good,problems:['invented']},{...good,companySize:'1000'},{...good,score:99}])assert.throws(()=>evaluateDiagnostic(input));
});
