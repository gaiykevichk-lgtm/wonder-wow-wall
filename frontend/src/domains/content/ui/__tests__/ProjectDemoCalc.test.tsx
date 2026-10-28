import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
vi.mock('../../../catalog/api/catalogApi',()=>({usePanels:()=>({data:{items:[]}}),usePanelVariants:()=>({data:[]})}));
vi.mock('../ProjectSpacesSlider',()=>({ProjectSpacesSlider:()=>null}));
vi.mock('../HomeConfiguratorUpload',()=>({HomeConfiguratorUpload:()=>null}));
import { ProjectDetailsSection } from '../HomePage';
afterEach(()=>vi.unstubAllGlobals());
describe('demo calculation',()=>{
 it('shows marked example until first edit, then actual result and clears stale result',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({wall_area:20,panels_estimate:223,price_from:200000})}));
 render(<ProjectDetailsSection/>);
 expect(screen.getByRole('status',{name:'Демо-расчёт'})).toHaveTextContent('Пример стены 3 × 4 м');
 expect(screen.getByRole('status')).toHaveTextContent('134 шт');
 const inputs=screen.getAllByRole('spinbutton');fireEvent.change(inputs[0],{target:{value:'4'}});
 expect(screen.queryByRole('status')).toBeNull();fireEvent.change(inputs[1],{target:{value:'5'}});fireEvent.click(screen.getByRole('button',{name:'Рассчитать'}));
 await waitFor(()=>expect(screen.getByRole('status',{name:'Результат расчёта'})).toHaveTextContent('20 м²'));
 expect(fetch).toHaveBeenCalledWith('/api/quick-calculate',expect.objectContaining({body:JSON.stringify({height_m:4,length_m:5})}));
 fireEvent.change(inputs[0],{target:{value:'3'}});expect(screen.queryByRole('status')).toBeNull();
 });
});
