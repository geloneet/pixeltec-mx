import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(process.env.PIXELTEC_TEST_DEPENDENCY_BASE||import.meta.url);
const crm=process.env.PIXELTEC_TEST_CRM_DEPENDENCY_BASE?createRequire(process.env.PIXELTEC_TEST_CRM_DEPENDENCY_BASE):null;
export const dependency=specifier=>import(/* webpackIgnore: true */ pathToFileURL((specifier==='jose'&&crm?crm:require).resolve(specifier)).href);
