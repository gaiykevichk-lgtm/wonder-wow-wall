# Design System -- Wonder Wow Wall

## Основная идея
Чистый минималистичный интернет-магазин в чёрно-белой гамме.
Лого -- **WONDER WOW WALL** + иконка **W!** в квадратной рамке.
Рамка из лого становится ключевым визуальным элементом дизайна.

---

## Цвета

```
Primary Background:    #FFFFFF (белый)
Secondary Background:  #F5F5F5 / #FAFAFA (светло-серый)
Text Primary:          #2D2D2D (почти чёрный)
Text Secondary:        #6B7280 (серый)
Text Muted:            #9CA3AF (светло-серый)
Border:                #E5E7EB
Border Light:          #F0F0F0
Accent (Green):        #4CAF50 (из лого -- зелёный)
Accent Hover:          #43A047
CTA Button:            #2D2D2D (тёмный)
CTA Hover:             #1A1A1A
Danger:                #EF4444
Success:               #4CAF50
```

## Использование зелёного (#4CAF50)
Только для:
- Точка в логотипе (W!)
- Hover на CTA кнопках (опционально)
- Бейджи ("В наличии", "Новинка")
- Статусы (успех, заказ выполнен)
- Активные элементы навигации
- НЕ для фонов, НЕ для hero-блоков

## Типографика
- Шрифт: **Inter**
- Размеры:
  - H1: 48-64px / 800
  - H2: 32-36px / 800
  - H3: 24px / 700
  - Body: 15-16px / 400
  - Small: 13px / 400-500
  - Caption: 12px / 500
- Line height: 1.1 для заголовков, 1.6-1.7 для body

## Скругления
- Карточки: 12-16px
- Кнопки: 8-10px
- Инпуты: 8px
- Аватары: 50%
- Теги/бейджи: 6px

## Тени
- Карточка: `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)`
- Карточка hover: `0 12px 40px rgba(0,0,0,0.1)`
- Header (scrolled): `0 1px 0 rgba(0,0,0,0.06)`

## Дизайн-паттерн "Рамка"
Из логотипа W! в квадратной рамке выводим визуальный мотив:
- Карточки товаров -- квадратные/прямоугольные с чёткими рамками
- Секции на главной -- тонкий бордер вокруг блоков
- Hero: фото в квадратных рамках (grid)
- Конструктор: стена = рамка
- Иконки в квадратных контейнерах с border

## Кнопки
- Primary: фон `#2D2D2D`, текст белый, hover -> `#1A1A1A`
- Secondary: фон transparent, border `#E5E7EB`, текст `#2D2D2D`
- Accent: фон `#4CAF50`, текст белый (только для ключевых CTA)
- Ghost: только текст, hover -> underline
- Высота: 44-52px для крупных, 36px для средних

## Анимации
- Framer Motion для входа секций (fadeUp, stagger)
- Hover на карточках: translateY(-4px) + тень
- Smooth scroll
- Header transition: transparent -> white
- Page transitions: fade
