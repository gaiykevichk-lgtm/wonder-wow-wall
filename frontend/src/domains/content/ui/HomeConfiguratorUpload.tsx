import { useEffect, useRef, useState } from 'react';
import { Button } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../../constructor/api/configuratorApi';

export function HomeConfiguratorUpload() {
 const navigate = useNavigate();
 const input = useRef<HTMLInputElement>(null);
 const locked = useRef(false);
 const [file, setFile] = useState<File | null>(null);
 const [preview, setPreview] = useState('');
 const [error, setError] = useState('');
 const [busy, setBusy] = useState(false);
 useEffect(() => {
  return () => { if (preview) URL.revokeObjectURL(preview); };
 }, [preview]);
 const select = (selected?: File) => {
  if (!selected || locked.current) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) { setError('Выберите фото в формате JPG, PNG или WebP.'); return; }
  if (selected.size > 20 * 1024 * 1024) { setError('Фотография должна быть не больше 20 МБ.'); return; }
  if (!selected.size) { setError('Этот файл пустой. Выберите другую фотографию.'); return; }
  setError(''); setFile(selected); setPreview(URL.createObjectURL(selected));
 };
 const start = async () => {
  if (!file || locked.current) return;
  locked.current = true; setBusy(true); setError('');
  try {
   const session = await createSession(file);
   navigate('/configurator', { state: { uploadedSession: session } });
  } catch (err) {
   setError(`Не удалось загрузить фото: ${err instanceof Error ? err.message : 'попробуйте ещё раз'}`);
  } finally { locked.current = false; setBusy(false); }
 };
 return <div className="home-configurator-upload">
  <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Фотография стены" className="home-photo-input" disabled={busy} onChange={e => { select(e.target.files?.[0]); e.target.value = ''; }} />
  <button type="button" className="home-photo-dropzone" disabled={busy} aria-label={file ? 'Заменить фотографию стены' : 'Загрузить фотографию стены'} onClick={() => input.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); select(e.dataTransfer.files[0]); }}>
   {preview ? <><img src={preview} alt="Предпросмотр вашей стены" /><span className="home-photo-replace">Заменить фото</span></> : <><CameraOutlined /><strong>Загрузите фото стены</strong><span>Нажмите или перетащите фото сюда</span><small>JPG, PNG, WebP · до 20 МБ</small></>}
  </button>
  {file && <span className="home-photo-name" title={file.name}>{file.name}</span>}
  {error && <div role="alert" className="home-photo-error">{error}</div>}
  <Button type="primary" className="home-photo-start" loading={busy} disabled={!file || busy} onClick={start}>{busy ? 'Загружаем фото…' : 'WOW!'}</Button>
  <small className="home-photo-note">Фото откроется в конфигураторе — продолжите примерку там.</small>
 </div>;
}
