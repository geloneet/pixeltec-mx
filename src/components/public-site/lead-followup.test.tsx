// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {render,fireEvent,screen,waitFor,cleanup} from '@testing-library/react';
import {LeadFollowup} from './lead-followup';
import {COMPANY_TYPES,PROBLEMS,COMPANY_SIZES,PRIORITIES} from '@/lib/diagnostic/logic';
import {SESSION_STORAGE_KEY} from '@/lib/analytics/session';
const action=vi.hoisted(()=>vi.fn());vi.mock('@/app/actions',()=>({submitDiagnostic:action}));
afterEach(()=>{cleanup();action.mockReset();window.sessionStorage.clear();vi.restoreAllMocks();});
function setup(answers:unknown){const view=render(<div className="wizard" data-answers={JSON.stringify(answers)}><LeadFollowup/></div>);fireEvent.change(screen.getByLabelText('Nombre'),{target:{value:'Prueba QA'}});fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'qa@example.test'}});return view.container.querySelector('form')!;}
const answers={companyType:COMPANY_TYPES[0].value,problems:[PROBLEMS[0].value],companySize:COMPANY_SIZES[0].value,priority:PRIORITIES[0].value};
describe('lead conversion boundary',()=>{
 it('does not invoke the server action or create a tracking session without consent',()=>{fireEvent.submit(setup(answers));expect(action).not.toHaveBeenCalled();expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();});
 it('rejects invalid diagnostic values before sending',()=>{const form=setup({...answers,companyType:'invalid'});fireEvent.click(screen.getByRole('checkbox'));fireEvent.submit(form);expect(action).not.toHaveBeenCalled();expect(screen.getByRole('status').textContent).toContain('Completa el diagnóstico');});
 it('shows success only after confirmed persistence and sends consent and answers',async()=>{action.mockResolvedValue({ok:true});const form=setup(answers);fireEvent.click(screen.getByRole('checkbox'));fireEvent.submit(form);await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Recibimos'));expect(action).toHaveBeenCalledWith(expect.objectContaining({...answers,email:'qa@example.test',consent:'on'}));});
 it('preserves the form on service failure',async()=>{action.mockResolvedValue({ok:false,message:'Servicio temporalmente no disponible'});const form=setup(answers);fireEvent.click(screen.getByRole('checkbox'));fireEvent.submit(form);await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('temporalmente'));expect(screen.getByLabelText('Correo electrónico')).toBeTruthy();});
 it('passes the existing content session to the confirmed diagnostic lead',async()=>{const sessionId='3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';window.sessionStorage.setItem(SESSION_STORAGE_KEY,sessionId);action.mockResolvedValue({ok:true});const form=setup(answers);fireEvent.click(screen.getByRole('checkbox'));fireEvent.submit(form);await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Recibimos'));expect(action).toHaveBeenCalledWith(expect.objectContaining({sessionId}));expect(action.mock.calls[0][0]).not.toHaveProperty('path');});
 it('still submits the lead when a tracking identifier is unavailable',async()=>{vi.spyOn(crypto,'randomUUID').mockImplementation(()=>{throw new Error('unavailable');});action.mockResolvedValue({ok:true});const form=setup(answers);fireEvent.click(screen.getByRole('checkbox'));fireEvent.submit(form);await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Recibimos'));expect(action.mock.calls[0][0]).not.toHaveProperty('sessionId');});
});
