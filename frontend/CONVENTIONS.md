# Frontend — Конвенции кода

## Архитектура: Domain-Driven Design (DDD)

### Структура доменов (`src/domains/`)

Каждый домен (Bounded Context) — это изолированная папка с двумя подпапками:

```
domains/{domain-name}/
├── model/                    # Бизнес-логика домена
│   ├── types.ts              # Типы, интерфейсы (entities, value objects)
│   ├── data.ts               # Моковые данные (заменятся на API)
│   └── {name}Store.ts        # Zustand store (если нужен)
└── ui/                       # UI-компоненты домена
    └── {PageName}Page.tsx    # Страницы домена
```

### Границы доменов (Bounded Context Boundaries)

| Домен | Содержит | Не содержит |
|-------|---------|-------------|
| `catalog` | Дизайны, категории, отзывы | Логику корзины, подписки |
| `order` | Корзина, оформление заказа | Список дизайнов, подписки |
| `subscription` | Планы, управление подпиской | Заказы, каталог |
| `constructor` | Визуальный редактор стены | Хранение заказов |
| `content` | Информационные страницы | Бизнес-логику |

### Правила импортов между доменами

```tsx
// ПРАВИЛЬНО: домен импортирует типы из другого домена
import type { PanelProduct } from '@/domains/catalog/model/types';

// ПРАВИЛЬНО: домен импортирует из shared
import { DESIGN_OVERLAY_PRICE } from '@/shared/config/constants';

// ПРАВИЛЬНО: shared/ui импортирует из доменов (кросс-доменная интеграция)
import { useCartStore } from '@/domains/order/model/cartStore';

// НЕПРАВИЛЬНО: домен импортирует UI из другого домена
import { CatalogPage } from '@/domains/catalog/ui/CatalogPage'; // ❌

// НЕПРАВИЛЬНО: домен импортирует store другого домена (кроме через shared)
import { useSubscriptionStore } from '@/domains/subscription/model/subscriptionStore'; // ❌ внутри catalog
```

**Исключения** (допустимые кросс-доменные зависимости):
- `constructor` → `catalog` (типы дизайнов), `order` (добавление в корзину), `subscription` (проверка подписки)
- `content/HomePage` → `catalog` (популярные дизайны для главной)

### Кросс-доменные компоненты (`src/shared/ui/`)

Компоненты, работающие с несколькими доменами, живут в `shared/ui/`:
- **CartDrawer** — объединяет данные order + catalog
- **SubscriptionModal** — работает с subscription store
- **ShopHeader** — показывает данные из order (корзина) и subscription (бейдж)

### Application layer (`src/app/`)

- `main.tsx` — точка входа: провайдеры (BrowserRouter, ConfigProvider, QueryClient)
- `App.tsx` — рендер роутера
- Только инфраструктурная логика, без бизнес-логики

## Структура файлов

### Модели доменов (`domains/{domain}/model/`)
- Типы и интерфейсы: `types.ts`
- Моковые данные: `data.ts`
- Zustand store: `{name}Store.ts`
- Каждый домен инкапсулирует свои данные

### Страницы доменов (`domains/{domain}/ui/`)
- Одна страница = один файл: `CatalogPage.tsx`
- Экспорт по умолчанию: `export default function CatalogPage()`
- Все подкомпоненты страницы — внутри того же файла как `const SectionName: React.FC<Props>`
- Lazy-loading через `React.lazy()` в `shared/router.tsx`

### Shared-компоненты (`src/shared/ui/`)
- Именованный экспорт: `export function ShopHeader()`
- Без папок-обёрток — один файл = один компонент

### Конфигурация (`src/shared/config/`)
- Бизнес-константы: `constants.ts` (PANEL_SIZES, BASE_PANEL_PRICES, DESIGN_OVERLAY_PRICE)
- Используются всеми доменами

## Стилизация

### Inline styles (основной подход)
```tsx
// ПРАВИЛЬНО: inline style objects
<div style={{ padding: 24, background: '#F5F5F5', borderRadius: 12 }}>

// ПРАВИЛЬНО: вынесенные константы стилей
const SECTION_PADDING: React.CSSProperties = { padding: '80px 24px' };
const MAX_WIDTH: React.CSSProperties = { maxWidth: 1280, margin: '0 auto' };

// НЕПРАВИЛЬНО: CSS-модули, styled-components, Tailwind
```

### Цветовые константы (в каждом файле страницы)
```tsx
const GREEN = '#4CAF50';    // акцент (только бейджи, статусы, active)
const DARK = '#2D2D2D';     // основной текст, CTA-кнопки
const GRAY_TEXT = '#6B7280'; // вторичный текст
const FONT = 'Inter, sans-serif';
```

### CSS Media Queries
```tsx
// Через <style> блок в конце компонента
<style>{`
  @media (max-width: 768px) {
    .desktop-nav { display: none !important; }
    .mobile-menu-btn { display: inline-flex !important; }
  }
`}</style>
```

### Глобальные стили
- Только в `index.css` (минимум: шрифт, scrollbar, selection, card hover)
- Без глобальных классов для layout

## Компоненты

### Ant Design
- Использовать компоненты Ant Design 6 для UI: `Button`, `Card`, `Select`, `Modal`, `Drawer`, `Tag`, `Badge`, `Input`, `InputNumber`, `Form`, `Tooltip`, `Rate`, `Collapse`, `Radio`
- Тема настроена в `shared/theme.ts` через `ConfigProvider`
- Стилизация через `style` и `styles={{ body: {...} }}`

### Анимации (Framer Motion)
```tsx
// Стандартные варианты (определяются в начале файла)
const fadeUpVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, ease: 'easeOut', delay: i * 0.12 },
  }),
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

// Использование
<motion.div variants={containerVariants} initial="hidden" animate="visible">
  <motion.h1 variants={fadeUpVariants} custom={0}>Заголовок</motion.h1>
  <motion.p variants={fadeUpVariants} custom={1}>Текст</motion.p>
</motion.div>
```

### Иконки
- Только из `@ant-design/icons`
- Импорт конкретных иконок (не `import * as Icons`)

## Именование

| Что | Конвенция | Пример |
|-----|----------|--------|
| Компоненты | PascalCase | `HomePage`, `ShopHeader` |
| Файлы компонентов | PascalCase.tsx | `CatalogPage.tsx` |
| Папки доменов | kebab-case | `catalog`, `order`, `subscription` |
| Подпапки домена | snake_case | `model/`, `ui/` |
| Hooks | camelCase с `use` | `useCartStore` |
| Константы | UPPER_SNAKE | `DESIGN_OVERLAY_PRICE` |
| Стили | camelCase (CSS-in-JS) | `borderRadius`, `backgroundColor` |
| Типы/интерфейсы | PascalCase | `PanelProduct`, `CartItem` |
| Пути URL | kebab-case | `/how-it-works`, `/pricing` |

## TypeScript

- Строгий режим (`strict: true`)
- Интерфейсы для объектов, type для union/intersection
- Без `any` — использовать `unknown` + type guard
- Props как inline type или интерфейс в том же файле
- Типы домена — в `domains/{domain}/model/types.ts`

```tsx
// ПРАВИЛЬНО: Inline props
const PlanCard: React.FC<{ plan: SubscriptionPlan; index: number }> = ({ plan, index }) => (...)

// ПРАВИЛЬНО: Для сложных props — интерфейс перед компонентом
interface ConstructorProps {
  wallWidth: number;
  wallHeight: number;
  onPanelPlace: (panel: PlacedPanel) => void;
}
```

## Состояние

### Локальный стейт
```tsx
// useState для UI-состояния внутри компонента
const [scrolled, setScrolled] = useState(false);
const [selectedTab, setSelectedTab] = useState<'purchase' | 'subscription'>('purchase');
```

### Доменный стейт (Zustand в domains/{domain}/model/)
```tsx
// Селекторный доступ (для оптимизации re-render)
const totalItems = useCartStore((s) => s.totalItems);
const hasSub = useSubscriptionStore((s) => s.hasSubscription);

// НЕПРАВИЛЬНО: деструктуризация всего стора
const { items, addItem, removeItem } = useCartStore();
```

### Вычисляемые значения
```tsx
// useMemo для тяжёлых вычислений
const costs = useMemo(() => {
  // ... расчёт
}, [placedPanels, wallWidth, isSubscriber]);

// useCallback для стабильных ссылок (передача в дочерние)
const handleAdd = useCallback(() => { ... }, [deps]);
```

## Навигация

```tsx
// Ссылки
<Link to="/catalog">Каталог</Link>

// Программная навигация
const navigate = useNavigate();
navigate('/constructor');
```

## Язык интерфейса

- Весь UI на **русском языке**
- Числа: `toLocaleString('ru-RU')` → `1 200 ₽`
- Даты: формат `ДД.ММ.ГГГГ`

## Производительность

- Все страницы — lazy-loaded (`React.lazy`)
- Изображения — Unsplash с параметрами `?w=600&h=600&fit=crop`
- Без лишних re-render: селекторы Zustand, `useMemo`, `useCallback`
- Ant Design — tree-shaking из коробки
