import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
const state = vi.hoisted(() => ({ cards: {status:'success',data:[] as Record<string,string>[],retry:vi.fn()}, interiors:{status:'success',data:[] as Record<string,string>[],retry:vi.fn()} }));
vi.mock('../../model/spacesApi', () => ({useSpaceCards:()=>state.cards,useSpacesInteriors:()=>state.interiors}));
import { ProjectSpacesSlider } from '../ProjectSpacesSlider';
beforeEach(()=>{state.cards.data=[];state.interiors.data=[];state.cards.status='success';state.interiors.status='success';vi.clearAllMocks();});
describe('project spaces slider',()=>{
 it('uses published cards rather than fallback interiors',()=>{
 state.cards.data=[{id:'1',title:'Из админки',image:'MISC/one.png',subtitle:'Дерево',area:'18 м²',price:'100 ₽'}];
 state.interiors.data=[{id:'old',title:'Старый интерьер',image:'old.png'}];
 render(<ProjectSpacesSlider/>);
 expect(screen.getByRole('img',{name:'Из админки'}).getAttribute('src')).toContain('MISC/one.png');
 expect(screen.queryByText('Старый интерьер')).toBeNull();
 expect(screen.getByRole('link',{name:'Посмотреть пространство: Из админки'})).toHaveAttribute('href','/spaces');
 });
 it('falls back to server interiors when managed cards are empty',()=>{
 state.interiors.data=[{id:'1',title:'Серверный интерьер',image:'MISC/two.png',description:'Интерьер'}];
 render(<ProjectSpacesSlider/>);expect(screen.getByRole('img',{name:'Серверный интерьер'})).toBeTruthy();
 });
 it('shows loading and empty states',()=>{
 state.cards.status='loading';const {rerender}=render(<ProjectSpacesSlider/>);expect(screen.getByRole('status')).toHaveTextContent('Загружаем');
 state.cards.status='success';rerender(<ProjectSpacesSlider/>);expect(screen.getByRole('status')).toHaveTextContent('скоро');
 });
 it('retries both sources after errors without local dummy photos',()=>{
 state.cards.status='error';state.interiors.status='error';render(<ProjectSpacesSlider/>);fireEvent.click(screen.getByRole('button',{name:'Повторить'}));expect(state.cards.retry).toHaveBeenCalled();expect(state.interiors.retry).toHaveBeenCalled();expect(screen.queryByRole('img')).toBeNull();
 });
 it('enables slide navigation for multiple spaces',()=>{
 state.cards.data=[{id:'1',title:'Один',image:'one.png'},{id:'2',title:'Два',image:'two.png'}];render(<ProjectSpacesSlider/>);
 expect(document.querySelector('.slick-next')).toBeTruthy();fireEvent.click(document.querySelector('.slick-next')!);expect(document.querySelectorAll('.slick-dots li')).toHaveLength(2);
 });
});
