import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(()=>({create:vi.fn(),navigate:vi.fn()}));
vi.mock('../../../constructor/api/configuratorApi',()=>({createSession:mocks.create}));
vi.mock('react-router-dom',()=>({useNavigate:()=>mocks.navigate}));
import { HomeConfiguratorUpload } from '../HomeConfiguratorUpload';
const select = (file = new File(['photo'],'wall.png',{type:'image/png'})) => fireEvent.change(screen.getByLabelText('Фотография стены'),{target:{files:[file]}});
beforeEach(()=>{vi.clearAllMocks();URL.createObjectURL=vi.fn(()=> 'blob:wall');URL.revokeObjectURL=vi.fn();});
describe('home photo handoff',()=>{
 it('requires a photo before continuing',()=>{render(<HomeConfiguratorUpload/>);expect(screen.getByRole('button',{name:'WOW!'})).toBeDisabled();});
 it('previews locally and uploads only on button, then hands off session',async()=>{
 mocks.create.mockResolvedValue({id:'new-session',photo_url:'/uploads/wall.png'});
 const {unmount}=render(<HomeConfiguratorUpload/>);select();expect(screen.getByAltText('Предпросмотр вашей стены')).toHaveAttribute('src','blob:wall');expect(mocks.create).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'WOW!'}));await waitFor(()=>expect(mocks.navigate).toHaveBeenCalledWith('/configurator',{state:{uploadedSession:{id:'new-session',photo_url:'/uploads/wall.png'}}}));
 expect(mocks.create).toHaveBeenCalledTimes(1);unmount();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:wall');
 });
 it('rejects unsupported types and oversized files',()=>{
 render(<HomeConfiguratorUpload/>);select(new File(['x'],'x.svg',{type:'image/svg+xml'}));expect(screen.getByRole('alert')).toHaveTextContent('JPG');
 const file=new File(['x'],'large.jpg',{type:'image/jpeg'});Object.defineProperty(file,'size',{value:21*1024*1024});select(file);expect(screen.getByRole('alert')).toHaveTextContent('20 МБ');expect(mocks.create).not.toHaveBeenCalled();
 });
 it('keeps photo for retry when upload fails',async()=>{
 mocks.create.mockRejectedValue(new Error('Сеть недоступна'));render(<HomeConfiguratorUpload/>);select();fireEvent.click(screen.getByRole('button',{name:'WOW!'}));await screen.findByRole('alert');expect(mocks.navigate).not.toHaveBeenCalled();expect(screen.getByAltText('Предпросмотр вашей стены')).toBeTruthy();await waitFor(()=>expect(document.querySelector('.home-photo-start')).not.toBeDisabled());
 });
 it('accepts dropping a photo',()=>{render(<HomeConfiguratorUpload/>);fireEvent.drop(screen.getByRole('button',{name:'Загрузить фотографию стены'}),{dataTransfer:{files:[new File(['x'],'drop.webp',{type:'image/webp'})]}});expect(screen.getByText('drop.webp')).toBeTruthy();});
});
