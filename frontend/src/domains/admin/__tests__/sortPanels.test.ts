import { describe, it, expect } from 'vitest';
import { sortPanels } from '../lib/sortPanels';
const start = Date.parse('2026-10-02T10:00:00Z');
const old = (name: string) => ({name, date: '2026-09-01T00:00:00Z'});
const sort = (rows: {name: string; date: string}[], cutoff = start) => sortPanels(rows, r => r.name, r => r.date, cutoff).map(r => r.name);
describe('alphabetical panels with session additions', () => {
 it('orders Russian names without mutating input', () => {
  const rows = [old('РЕЙКА'), old('колонна'), old('АРКА')];
  expect(sort(rows)).toEqual(['АРКА', 'колонна', 'РЕЙКА']);
  expect(rows[0].name).toBe('РЕЙКА');
 });
 it('keeps new additions above alphabetized existing panels until reopening', () => {
  const rows = [old('АРКА'), {name:'Я НОВАЯ',date:'2026-10-02T10:01:00Z'}, old('КРУГ')];
  expect(sort(rows)).toEqual(['Я НОВАЯ','АРКА','КРУГ']);
  expect(sort(rows, Date.parse('2026-10-02T11:00:00Z'))).toEqual(['АРКА','КРУГ','Я НОВАЯ']);
 });
 it('keeps newest additions first', () => {
  expect(sort([{name:'А',date:'2026-10-02T10:01:00Z'}, {name:'Я',date:'2026-10-02T10:02:00Z'}])).toEqual(['Я','А']);
 });
});
