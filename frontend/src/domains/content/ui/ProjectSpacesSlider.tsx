import { Carousel, Button } from 'antd';
import { useSpaceCards, useSpacesInteriors } from '../model/spacesApi';
import { imageSrc } from '../../../shared/lib/imageSrc';

/** Same managed-card precedence as /spaces; never substitutes unrelated local photos. */
export function ProjectSpacesSlider() {
 const cards = useSpaceCards();
 const interiors = useSpacesInteriors();
 const slides = cards.status === 'success' && cards.data.length > 0
  ? cards.data.map(card => ({ id: card.id, title: card.title, image: card.image, detail: card.subtitle, meta: [card.area, card.price].filter(Boolean).join(' · ') }))
  : interiors.data.map(interior => ({ id: interior.id, title: interior.title, image: interior.image, detail: interior.description, meta: interior.roomTypeLabel }));
 const loading = cards.status === 'loading' || (!slides.length && interiors.status === 'loading');
 const error = !slides.length && (cards.status === 'error' || interiors.status === 'error');
 return <div className="project-spaces-slider" role="region" aria-label="Слайдер пространств">
  {loading ? <div className="project-slider-state" role="status">Загружаем пространства…</div>
   : slides.length > 0 ? <Carousel key={slides.map(s => s.id).join(':')} arrows={slides.length > 1} dots={slides.length > 1} infinite={slides.length > 1} autoplay={false}>
    {slides.map(slide => <div key={slide.id}>
     <a href="/spaces" className="project-space-slide" aria-label={`Посмотреть пространство: ${slide.title}`}>
      <img src={imageSrc(slide.image)} alt={slide.title} loading="lazy" />
      <div className="project-space-caption"><strong>{slide.title}</strong>{slide.detail && <span>{slide.detail}</span>}{slide.meta && <small>{slide.meta}</small>}</div>
     </a>
    </div>)}
   </Carousel>
   : <div className="project-slider-state" role="status">{error ? <>Не удалось загрузить пространства.<Button onClick={() => { cards.retry(); interiors.retry(); }}>Повторить</Button></> : 'Пространства скоро появятся.'}</div>}
  <a href="/spaces" className="project-spaces-link">Все пространства <span aria-hidden="true">↗</span></a>
 </div>;
}
