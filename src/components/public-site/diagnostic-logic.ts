import {z} from 'zod';
import {COMPANY_TYPES,PROBLEMS,COMPANY_SIZES,PRIORITIES,computeDiagnostic,type DiagnosticResult} from '@/lib/diagnostic/logic';
const enumSchema=(values:string[])=>z.enum(values as [string,...string[]]);
export const diagnosticSchema=z.object({companyType:enumSchema(COMPANY_TYPES.map(o=>o.value)),problems:z.array(enumSchema(PROBLEMS.map(o=>o.value))).min(1).max(PROBLEMS.length),companySize:enumSchema(COMPANY_SIZES.map(o=>o.value)),priority:enumSchema(PRIORITIES.map(o=>o.value))}).strict();
export function evaluateDiagnostic(input:unknown):DiagnosticResult {const answers=diagnosticSchema.parse(input);return computeDiagnostic({...answers,problems:[...new Set(answers.problems)],name:'',email:''});}
