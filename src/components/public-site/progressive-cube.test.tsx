// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {ProgressiveCube} from './progressive-cube';
afterEach(cleanup);
describe('progressive cube',()=>{
 it('does not load WebGL until explicit intent and reuses one instance',async()=>{
  const cube={open:vi.fn(),toggle:vi.fn(),isOpen:true};
  const activate=vi.fn().mockResolvedValue(cube);
  render(<ProgressiveCube english={false} onActivate={activate}/>);
  expect(activate).not.toHaveBeenCalled();
  expect(screen.getByRole('img').getAttribute('width')).toBe('768');
  fireEvent.click(screen.getByRole('button',{name:/Explorar/}));
  await waitFor(()=>expect(cube.open).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button',{name:/Cerrar/}));
  expect(cube.toggle).toHaveBeenCalledOnce();expect(activate).toHaveBeenCalledOnce();
 });
 it('retains the poster and gives an accessible fallback when WebGL fails',async()=>{
  render(<ProgressiveCube english onActivate={()=>Promise.reject(new Error('no WebGL'))}/>);
  fireEvent.click(screen.getByRole('button',{name:/Explore/}));
  await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('unavailable'));
  expect(screen.getByRole('img')).toBeTruthy();
 });
});
