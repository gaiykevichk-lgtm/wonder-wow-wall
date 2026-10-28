/**
 * Карточка панели — `/catalog/:panelId`
 *
 * Полностью соответствует ТЗ `04_Карточка_товара.md`:
 *   PDP-01..PDP-12 (выбор материала/исполнения/размера, базовая подсказка,
 *   lightbox, компаньоны того же размерного ряда, CTA в конфигуратор),
 *   ТЗ-блок 3 «ТЕХНОЛОГИЧЕСКАЯ РОСКОШЬ / Просто.»,
 *   ТЗ-блок 4 Спецификация (6 полей с динамической упаковкой),
 *   ТЗ-блок 5 Компаньоны + «Ваш интерьер начинается здесь.».
 *
 * Логика выбора:
 *   Шаг 1 — Материал  (текстура из API).
 *   Шаг 2 — Исполнение (конкретный цвет этой текстуры).
 *   Шаг 3 — Размер    (переключатель 300×300 / 300×600 / 600×600).
 *   Шаг 4 — Количество + «Добавить в корзину» / «Рассчитать проект».
 *
 * После выбора материала и исполнения слева появляется:
 *   - большое превью в выбранном покрытии,
 *   - миниатюры интерьерных сценариев (`TextureVisualization` API),
 *     увеличивающиеся по клику в Lightbox (PDP-07).
 */

import { useEffect, useMemo, useRef, useState } from "react";

import {
	Link,
	useNavigate,
	useParams,
	useSearchParams,
} from "react-router-dom";
import {
	ArrowLeftOutlined,
	CheckOutlined,
	CloseOutlined,
	MinusOutlined,
	PlusOutlined,
	ShoppingOutlined,
} from "@ant-design/icons";
import { Skeleton, message } from "antd";
import { motion, AnimatePresence } from "framer-motion";
import { PageMeta } from "../../../shared/ui/PageMeta";
import { imageSrc } from "../../../shared/lib/imageSrc";
import {
	PanelPreviewGallery,
	type PanelPreviewSlide,
} from "./PanelPreviewGallery";
import { useCartStore } from "../../order/model/cartStore";
import {
	type ApiPanelVariant,
	useDesigns,
	usePanels,
	usePanelVariants,
	useTextures,
} from "../api/catalogApi";
import { CalculatorSidebar } from "./CalculatorSidebar";
import SizeSelector from "./SizeSelector";
import { TechLuxuryBlock } from "./AccordionBlock";
import { SpecList } from "./SpecList";
import { CompanionsCarousel } from "./CompanionsCarousel";
import {
	BASE_PANEL_PRICES,
	DESIGN_OVERLAY_PRICE,
	PANEL_SIZES,
} from "../../../shared/config/constants";

const BLUE = "#2E7D32";
const DARK = "#1d1d1f";
const MUTED = "#6e6e73";
const SURFACE = "#f5f5f7";

/**
 * ТЗ 16.09 — порядок отображения текстур (материалов) в Шаге 1.
 * Два ряда по 4: Кожа, Текстиль, Дерево, Металл / Природный камень,
 * Декоративные фактуры, Краска, Графика.
 * Ключ — name текстуры (регистронезависимо).
 */
const TEXTURE_ORDER = [
	"кожа",
	"текстиль",
	"дерево",
	"металл",
	"природный камень",
	"декоративные фактуры",
	"краска",
	"графика",
] as const;

function sortTextureGroups(groups: TextureGroup[]): TextureGroup[] {
	const order = new Map<string, number>();
	TEXTURE_ORDER.forEach((name, i) => order.set(name, i));
	return [...groups].sort((a, b) => {
		const ai = order.get(a.name.toLowerCase().trim());
		const bi = order.get(b.name.toLowerCase().trim());
		if (ai !== undefined && bi !== undefined) return ai - bi;
		if (ai !== undefined) return -1;
		if (bi !== undefined) return 1;
		return a.name.localeCompare(b.name);
	});
}

interface TextureGroup {
	id: string;
	name: string;
	swatchImage: string;
	variants: ApiPanelVariant[];
	images: string[];
}

/**
 * Группируем варианты по текстуре (Материал) → несколько фотографий
 * (Исполнение в терминах ТЗ).
 */
function getTextureGroups(
	variants: ApiPanelVariant[],
	textureSwatches: ReadonlyMap<string, string>,
): TextureGroup[] {
	const grouped = new Map<string, ApiPanelVariant[]>();
	for (const variant of variants) {
		const key = variant.texture_id || variant.texture_name || "base";
		const current = grouped.get(key) || [];
		current.push(variant);
		grouped.set(key, current);
	}

	return Array.from(grouped.entries()).map(([id, items]) => {
		// Каждая активная запись админки = одно исполнение. Изображения внутри
		// записи — галерея этого исполнения, а не дополнительные исполнения.
		const orderedItems = [...items].sort(
			(a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
		);
		return {
			id,
			name: orderedItems[0]?.texture_name || "Базовая фактура",
			swatchImage: textureSwatches.get(id) || "",
			variants: orderedItems,
			images: orderedItems
				.map((variant) => variant.image_paths.find(Boolean))
				.filter((path): path is string => Boolean(path)),
		};
	});
}

interface InteriorImage {
	id: string;
	url: string;
	title: string;
	subtitle?: string;
}

function formatVariantCount(count: number) {
	const lastTwoDigits = count % 100;
	const lastDigit = count % 10;

	if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "вариантов";
	if (lastDigit === 1) return "вариант";
	if (lastDigit >= 2 && lastDigit <= 4) return "варианта";
	return "вариантов";
}

/**
 * Интерьерные миниатюры для выбранного материала. Блок «в интерьере» всегда
 * один: при выбранной фактуре он просто меняет содержимое на визуализацию
 * текстуры (`/api/textures/{id}/visualization`) — отдельный блок с картинкой
 * не добавляется. Пока фактура не выбрана (или для неё нет визуализации),
 * блок не показывается вовсе — fallback-фото панели не рендерим по
 * требованию пользователя.
 */

interface SelectedFinish {
	groupId: string;
	finishIndex: number;
}

export default function CatalogPanelPage() {
	const { panelId } = useParams<{ panelId: string }>();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	// ТЗ-19: переход из «Пространств» несёт контекст интерьера и варианта.
	const interiorId = searchParams.get("interiorId");
	const variantId = searchParams.get("variantId");
	const addToCart = useCartStore((state) => state.addItemWithQuantity);
	const openCart = useCartStore((state) => state.setOpen);
	const [selectedFinish, setSelectedFinish] = useState<SelectedFinish | null>(
		null,
	);
	const [basePreviewFocused, setBasePreviewFocused] = useState(false);
	const [activeSizeKey, setActiveSizeKey] = useState<string>(
		`${PANEL_SIZES[0].width}x${PANEL_SIZES[0].height}`,
	);
	const [quantity, setQuantity] = useState(1);
	const [editingQuantity, setEditingQuantity] = useState(false);
	const quantityInputRef = useRef<HTMLInputElement>(null);
	// PC-CALC-001 — «Рассчитать проект» открывает боковую панель, а не /spaces.
	const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
	// PDP-07 — Lightbox на интерьерных миниатюрах.
	const [lightboxImage, setLightboxImage] = useState<InteriorImage | null>(
		null,
	);
	// Mobile detection. The CircularImagePreview is GSAP-driven and its bigSize
	// (9800px) clipping math breaks below ~700px. On mobile we render a plain
	// motion.img for predictable centering.
	const [isMobile, setIsMobile] = useState(false);
	useEffect(() => {
		if (typeof window === "undefined") return;
		const mq = window.matchMedia("(max-width: 640px)");
		const handleChange = (e: MediaQueryListEvent | MediaQueryList) =>
			setIsMobile(e.matches);
		handleChange(mq);
		mq.addEventListener("change", handleChange);
		return () => mq.removeEventListener("change", handleChange);
	}, []);

	const previewContainerRef = useRef<HTMLDivElement | null>(null);
	const textureGridRef = useRef<HTMLDivElement | null>(null);
	const finishGridRef = useRef<HTMLDivElement | null>(null);

	const {
		data: panelsData,
		isLoading: panelsLoading,
		isError: panelsError,
	} = usePanels();
	const {
		data: allVariants,
		isLoading: variantsLoading,
		isError: variantsError,
	} = usePanelVariants();
	const { data: designsData } = useDesigns({ limit: 50 });
	const { data: textures = [] } = useTextures();
	void designsData;

	const panel = useMemo(
		() => panelsData?.items.find((item) => item.id === panelId),
		[panelId, panelsData],
	);
	const textureSwatches = useMemo(
		() =>
			new Map(textures.map((texture) => [texture.id, texture.swatch_image])),
		[textures],
	);
	const familyPanelIds = useMemo(() => {
		if (!panel) return new Set<string>();
		const familySlug = panel.slug.replace(/-(?:300x300|300x600|600x600)$/, "");
		return new Set(
			(panelsData?.items ?? [])
				.filter(
					(item) =>
						item.slug.replace(/-(?:300x300|300x600|600x600)$/, "") ===
							familySlug &&
						item.width_mm === panel.width_mm &&
						item.height_mm === panel.height_mm,
				)
				.map((item) => item.id),
		);
	}, [panel, panelsData]);
	const variants = useMemo(
		() =>
			(allVariants ?? []).filter((variant) =>
				familyPanelIds.has(variant.panel_id),
			),
		[allVariants, familyPanelIds],
	);
	const textureGroups = useMemo(
		() => sortTextureGroups(getTextureGroups(variants, textureSwatches)),
		[variants, textureSwatches],
	);

	// ─── Контекст перехода из «Пространств» (ТЗ-19) ───
	const originInterior = interiorId ? { title: "" } : null;
	// `variantId` передаётся из карточки «Пространств» и является ID
	// исполнения панели, а не ID фактуры интерьера.
	const originVariant = useMemo(
		() => allVariants?.find((item) => item.id === variantId) ?? null,
		[allVariants, variantId],
	);
	// Выбираем группу фактуры по texture_id исполнения, затем конкретное фото
	// по image_paths. Это связывает обе сущности каталога без хрупкого URL binding.
	const originSelection = useMemo(() => {
		if (!originVariant) return null;
		const group = textureGroups.find((g) =>
			g.variants.some(
				(item) =>
					item.texture_id === originVariant.texture_id &&
					item.id === originVariant.id,
			),
		);
		if (!group) return null;
		const selectedImage = originVariant.image_paths?.[0];
		const finishIndex = selectedImage
			? group.images.indexOf(selectedImage)
			: -1;
		return finishIndex >= 0 ? { groupId: group.id, finishIndex } : null;
	}, [originVariant, textureGroups]);
	const [originPreselectKey, setOriginPreselectKey] = useState<string | null>(
		null,
	);
	const targetOriginKey = originSelection
		? `${interiorId}:${variantId}:${originSelection.groupId}:${originSelection.finishIndex}`
		: null;
	if (targetOriginKey !== originPreselectKey) {
		setOriginPreselectKey(targetOriginKey);
		if (originSelection) setSelectedFinish(originSelection);
	}

	// Auto-select first texture/first finish on initial load (PDP-04: «если
	// исполнение одно — его название видно; правило автоподтверждения
	// уточнить Q02» — выбираем детерминированно, чтобы пользователь видел
	// конкретное название).
	// Важно: возвращаем null, если пользователь явно НЕ выбирал фактуру —
	// это позволяет главному превью показать именно базовую форму панели
	// (panel.photo_path), а не текстуру по умолчанию.
	const effectiveFinish: SelectedFinish | null = useMemo(() => {
		if (textureGroups.length === 0) return null;
		const requestedFinish = selectedFinish ?? originSelection;
		if (requestedFinish) {
			const group = textureGroups.find((g) => g.id === requestedFinish.groupId);
			if (group && group.images.length > requestedFinish.finishIndex) {
				return requestedFinish;
			}
		}
		// Пользователь ещё не выбирал фактуру — базовая форма активна.
		return null;
	}, [textureGroups, selectedFinish, originSelection]);

	// Синхронизируем локальный finish с производным значением без эффекта —
	// вызываем setState во время рендера по React 19 правилу сравнения.
	const [prevFinishSyncKey, setPrevFinishSyncKey] = useState<string | null>(
		"none",
	);
	const finishSyncKey = effectiveFinish
		? `${effectiveFinish.groupId}:${effectiveFinish.finishIndex}`
		: "base";
	if (prevFinishSyncKey !== finishSyncKey) {
		setPrevFinishSyncKey(finishSyncKey);
		setSelectedFinish(effectiveFinish);
	}

	const selectedTexture = useMemo(
		() =>
			selectedFinish
				? textureGroups.find((g) => g.id === selectedFinish.groupId)
				: undefined,
		[textureGroups, selectedFinish],
	);
	const selectedVariant = useMemo(() => {
		if (!selectedTexture) return undefined;
		return (
			selectedTexture.variants[
				Math.min(
					selectedFinish?.finishIndex ?? 0,
					selectedTexture.variants.length - 1,
				)
			] || selectedTexture.variants[0]
		);
	}, [selectedTexture, selectedFinish]);
	const selectedImage = useMemo(() => {
		if (!selectedTexture || !selectedFinish) {
			return panel?.photo_path || "";
		}
		return (
			selectedTexture.images[
				Math.min(selectedFinish.finishIndex, selectedTexture.images.length - 1)
			] || selectedTexture.images[0]
		);
	}, [selectedTexture, selectedFinish, panel]);

	// PDP-04 — Смена размера сохраняется всегда (размер привязан к самой
	// панели, не к исполнению). Размер выбирается пользователем явно.
	const activeSize = useMemo(() => {
		const found = PANEL_SIZES.find(
			(s) => `${s.width}x${s.height}` === activeSizeKey,
		);
		return found ?? PANEL_SIZES[0];
	}, [activeSizeKey]);

	// PDP-06 — Цена реагирует на размер и наличие исполнения.
	// ТЗ 16.09 — отображаем стоимость за м².
	const areaM2 = useMemo(() => {
		return (activeSize.width * activeSize.height) / 1_000_000;
	}, [activeSize]);

	const unitPrice = useMemo(() => {
		const base = BASE_PANEL_PRICES[activeSizeKey] ?? panel?.base_price ?? 1200;
		const overlay = selectedVariant ? DESIGN_OVERLAY_PRICE : 0;
		return base + overlay;
	}, [activeSizeKey, selectedVariant, panel]);

	// Цена за квадратный метр (ТЗ 16.09)
	const pricePerM2 = useMemo(() => {
		if (!areaM2) return unitPrice;
		return Math.round(unitPrice / areaM2);
	}, [unitPrice, areaM2]);

	const totalPrice = unitPrice * quantity;
	const isLoading = panelsLoading || variantsLoading;

	const basePhotoPaths = useMemo(() => {
		if (panel?.photo_paths?.length) return panel.photo_paths.slice(0, 2);
		return panel?.photo_path ? [panel.photo_path] : [];
	}, [panel]);
	const basePreviewPath = basePreviewFocused
		? basePhotoPaths[1] || basePhotoPaths[0]
		: basePhotoPaths[0];

	const previewSlides: PanelPreviewSlide[] = useMemo(() => {
		if (!selectedTexture) return [];

		const activeSlideId = `${selectedTexture.id}-${selectedFinish?.finishIndex ?? 0}`;
		const slides: PanelPreviewSlide[] = selectedImage
			? [
					{
						id: activeSlideId,
						url: imageSrc(selectedImage),
						title: `${selectedTexture.name} — исполнение`,
					},
				]
			: [];

		// После выбранного исполнения показываем только фотографии этого же
		// варианта «в дизайне». Изображения других фактур сюда не добавляем:
		// стрелки галереи не должны незаметно менять материал товара.
		(selectedVariant?.design_image_paths ?? []).forEach((path, index) => {
			const url = imageSrc(path);
			if (!slides.some((slide) => slide.url === url)) {
				slides.push({
					id: `design-${selectedVariant?.id}-${index}`,
					url,
					title: `${selectedTexture.name} — в дизайне ${index + 1}`,
				});
			}
		});
		return slides;
	}, [selectedTexture, selectedImage, selectedFinish, selectedVariant]);

	const selectTexture = (group: TextureGroup) => {
		setSelectedFinish({ groupId: group.id, finishIndex: 0 });

		// На мобильных: прокручиваем страницу к основному превью,
		// чтобы пользователь увидел результат выбора сразу.
		// Скролл ставим в очередь через requestAnimationFrame, чтобы он
		// прошёл уже после того, как React отрендерит новое изображение
		// превью. Иначе пользователь увидел бы прокрутку «в пустоту».
		// При скролле оставляем отступ сверху под закреплённые хедеры
		// (ShopHeader 48px + panel-product-header 44px ≈ 92-100px),
		// иначе превью прячется под шапкой и пользователь не видит заголовок.
		if (isMobile && previewContainerRef.current) {
			requestAnimationFrame(() => {
				const el = previewContainerRef.current;
				if (!el) return;
				const headerOffset = 110; // px — запас под два sticky-хедера + отступ
				const rect = el.getBoundingClientRect();
				const absoluteTop = rect.top + window.scrollY - headerOffset;
				window.scrollTo({
					top: Math.max(0, absoluteTop),
					behavior: "smooth",
				});
			});
		}
	};

	const selectFinish = (finishIdx: number) => {
		if (!selectedTexture) return;
		setSelectedFinish({ groupId: selectedTexture.id, finishIndex: finishIdx });

		// На мобильных: прокручиваем страницу к основному превью.
		if (isMobile && previewContainerRef.current) {
			requestAnimationFrame(() => {
				const el = previewContainerRef.current;
				if (!el) return;
				const headerOffset = 110;
				const rect = el.getBoundingClientRect();
				const absoluteTop = rect.top + window.scrollY - headerOffset;
				window.scrollTo({
					top: Math.max(0, absoluteTop),
					behavior: "smooth",
				});
			});
		}
	};

	// PDP-11 — Компаньоны: панели того же размерного ряда. У нас
	// размерный ряд фиксирован 300×300/300×600/600×600, поэтому берём
	// все панели с тем же `size_label` (например «30×30 см»). Если
	// таких нет — fallback на другие панели каталога.
	const companions = useMemo(() => {
		const all = panelsData?.items ?? [];
		const sizeLabel = `${activeSize.width}×${activeSize.height} мм`;
		const sameSize = all.filter(
			(p) =>
				p.id !== panel?.id &&
				p.width_mm === activeSize.width &&
				p.height_mm === activeSize.height,
		);
		const pool =
			sameSize.length > 0 ? sameSize : all.filter((p) => p.id !== panel?.id);
		return pool.slice(0, 6).map((p) => ({
			id: p.id,
			name: p.name,
			image: p.photo_path ? imageSrc(p.photo_path) : "",
			price:
				(BASE_PANEL_PRICES[`${p.width_mm}x${p.height_mm}`] ?? p.base_price) +
				DESIGN_OVERLAY_PRICE,
			categoryLabel: p.size_label || sizeLabel,
		}));
	}, [panelsData, panel?.id, activeSize]);

	const handleAddToCart = () => {
		if (!panel || !selectedVariant) {
			message.warning("Выберите фактуру и исполнение панели");
			return;
		}

		addToCart(
			{
				id: `exec-${selectedVariant.id}-${activeSizeKey}`,
				productId: selectedVariant.panel_id,
				variantId: selectedVariant.id,
				executionName: selectedVariant.name || "",
				name: `${panel.name} — ${selectedTexture?.name || "Базовая фактура"}`,
				price: unitPrice,
				image: selectedImage,
				color: "",
				colorName:
					selectedVariant.name?.trim() ||
					`Вариант ${(selectedFinish?.finishIndex ?? 0) + 1}`,
				area: (activeSize.width * activeSize.height) / 1_000_000,
				textureId: selectedVariant.texture_id,
				textureName: selectedVariant.texture_name || "",
				sizeKey: activeSizeKey,
				size: `${activeSize.width}×${activeSize.height} мм`,
			},
			quantity,
		);
		message.success(`${quantity} шт. добавлено в корзину`);
		openCart(true);
	};

	if (isLoading && !panel) {
		return <PanelPageSkeleton />;
	}

	if (!panel) {
		return (
			<div className="panel-page panel-state">
				<div>
					<p className="panel-eyebrow">Каталог</p>
					<h1>
						{panelsError ? "Не удалось загрузить панель" : "Панель не найдена"}
					</h1>
					<p>Вернитесь в каталог и выберите доступную форму панели.</p>
					<Link to="/catalog" className="panel-primary-link">
						<ArrowLeftOutlined /> Вернуться в каталог
					</Link>
				</div>
				<PanelPageStyles />
			</div>
		);
	}

	return (
		<div className="panel-page">
			<PageMeta
				title={`${panel.name} ${activeSize.width}×${activeSize.height} мм — Wonder Wow Wall`}
				description={
					panel.description ||
					`${panel.name} ${activeSize.width}×${activeSize.height} мм. Выберите фактуру и вариант отделки для модульной стены.`
				}
				ogImage={selectedImage ? imageSrc(selectedImage) : undefined}
				ogType="product"
			/>

			<header className="panel-product-header">
				<div className="panel-header-inner">
					<Link to="/catalog" className="panel-back-link">
						<ArrowLeftOutlined /> Каталог
					</Link>
					<div className="panel-header-actions">
						<span>{panel.name}</span>
						<button
							type="button"
							onClick={() => {
								const params = new URLSearchParams({
									panelId: selectedVariant?.panel_id ?? panel.id,
									sizeKey: activeSizeKey,
								});
								if (selectedVariant?.texture_id) {
									params.set("textureId", selectedVariant.texture_id);
								}
								navigate(`/configurator?${params.toString()}`);
							}}
						>
							Конфигуратор
						</button>
					</div>
				</div>
			</header>

			<main>
				<section className="panel-intro">
					<div className="panel-intro-copy">
						<p className="panel-eyebrow">Модульная стеновая панель</p>
						<h1>{panel.name}</h1>
						{/* ТЗ-19: бейдж контекста перехода из «Пространств». */}
						{originInterior && (
							<div
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: 10,
									flexWrap: "wrap",
									marginTop: 10,
									padding: "8px 14px",
									borderRadius: 999,
									background: SURFACE,
									fontSize: 13,
									color: MUTED,
								}}
							>
								<span>
									{originInterior?.title
										? `Из интерьера: «${originInterior.title}» · фактура `
										: "Выбрано из пространства · фактура "}
									{originVariant?.texture_name || ""}
								</span>
								<button
									type="button"
									onClick={() => {
										if (window.history.length > 1) navigate(-1);
										else navigate("/spaces");
									}}
									style={{
										border: "none",
										background: "transparent",
										padding: 0,
										cursor: "pointer",
										fontSize: 13,
										fontWeight: 600,
										color: BLUE,
									}}
								>
									← К пространствам
								</button>
							</div>
						)}
						{/* PDP-01 — базовая подсказка до выбора исполнения. */}
						{!selectedVariant ? (
							<p
								className="panel-price-lead"
								style={{
									color: "#9CA3AF",
									fontSize: 15,
									fontWeight: 400,
								}}
							>
								Стоимость зависит от выбранного решения
							</p>
						) : (
							/* PDP-06 — после выбора исполнения показываем реальную
							   цену «от XX ₽/м²». */
							<p
								className="panel-price-lead"
								style={{
									color: DARK,
									fontSize: 17,
									fontWeight: 500,
								}}
							>
								Стоимость решения от {pricePerM2.toLocaleString("ru-RU")} ₽/м²
							</p>
						)}
					</div>
				</section>

				<section className="panel-buy-layout" aria-label="Конфигуратор панели">
					<aside
						className={`panel-visual-column${!selectedTexture && basePreviewPath ? " panel-visual-column--base" : ""}`}
					>
						<div
							className="panel-main-image"
							ref={previewContainerRef}
							onMouseEnter={() => setBasePreviewFocused(true)}
							onMouseLeave={() => setBasePreviewFocused(false)}
							onFocus={() => setBasePreviewFocused(true)}
							onBlur={(event) => {
								if (!event.currentTarget.contains(event.relatedTarget)) {
									setBasePreviewFocused(false);
								}
							}}
							tabIndex={!selectedTexture && basePreviewPath ? 0 : undefined}
							role={!selectedTexture && basePreviewPath ? "region" : undefined}
							aria-label={
								!selectedTexture && basePreviewPath
									? "Базовая форма панели"
									: undefined
							}
						>
							{!selectedTexture && basePreviewPath ? (
								<img
									className="panel-base-preview"
									src={imageSrc(basePreviewPath)}
									alt={
										basePreviewFocused && basePhotoPaths[1]
											? `${panel.name} — базовая форма при наведении`
											: `${panel.name} — базовая форма`
									}
									draggable={false}
								/>
							) : previewSlides.length > 0 ? (
								<PanelPreviewGallery
									key={`${panel.id}:${selectedTexture?.id ?? "base"}:${selectedFinish?.finishIndex ?? 0}`}
									slides={previewSlides}
									initialId={
										selectedFinish
											? `${selectedFinish.groupId}-${selectedFinish.finishIndex}`
											: undefined
									}
								/>
							) : (
								<div className="panel-placeholder">
									Изображение панели скоро появится
								</div>
							)}
						</div>
					</aside>

					<div className="panel-config-column">
						<div className="panel-config-scroll">
							{/* ─── Шаг 1 — Материал (компактные пиктограммы) ───── */}
							<section className="panel-config-step">
								<p className="panel-step-number">Шаг 1</p>
								<p className="panel-form-name">Форма · {panel.name}</p>
								<h2>
									Материал. <span>Выберите характер поверхности.</span>
								</h2>
								<div className="panel-picto-grid" ref={textureGridRef}>
									{textureGroups.map((group) => {
										const active = group.id === selectedTexture?.id;
										return (
											<button
												type="button"
												key={group.id}
												data-texture-id={group.id}
												className={`panel-picto-card${active ? " is-active" : ""}`}
												onClick={() => selectTexture(group)}
												aria-pressed={active}
											>
												<div className="panel-picto-swatch">
													{group.swatchImage ? (
														<img
															src={imageSrc(group.swatchImage)}
															alt={group.name}
														/>
													) : (
														<span className="panel-picto-placeholder" />
													)}
												</div>
												<span className="panel-picto-label">{group.name}</span>
											</button>
										);
									})}
								</div>
								{variantsError ? (
									<p className="panel-inline-error">
										Варианты временно недоступны. Обновите страницу позже.
									</p>
								) : null}
							</section>

							{/* ─── Шаг 2 — Исполнение (конкретный цвет) ─────── */}
							{selectedTexture ? (
								<section className="panel-config-step panel-finish-step">
									<p className="panel-step-number">Шаг 2</p>
									<h2 className="panel-finish-heading">
										Исполнение.{" "}
										<span>
											{selectedTexture.name} · {selectedTexture.images.length}{" "}
											{formatVariantCount(selectedTexture.images.length)}
										</span>
									</h2>
									<div className="panel-finish-grid" ref={finishGridRef}>
										{selectedTexture.images.map((path, index) => {
											const active =
												index === (selectedFinish?.finishIndex ?? 0);
											return (
												<button
													type="button"
													key={path}
													data-finish-index={index}
													className={`panel-finish-card${active ? " is-active" : ""}`}
													onClick={() => selectFinish(index)}
													aria-pressed={active}
												>
													<img src={imageSrc(path)} alt="" />
													<span>Исполнение {index + 1}</span>
													{active ? (
														<CheckOutlined className="panel-check" />
													) : null}
												</button>
											);
										})}
									</div>
								</section>
							) : null}

							{/* ─── Шаг 3 — Размер ──────────────────────────── */}
							<section className="panel-config-step panel-size-step">
								<p className="panel-step-number">Шаг 3</p>
								<h2>Размер.</h2>
								<SizeSelector
									activeSizeKey={activeSizeKey}
									onChange={setActiveSizeKey}
									designPrice={selectedVariant ? DESIGN_OVERLAY_PRICE : 0}
									showLabel={false}
									compact
								/>
							</section>

							{/* ─── Шаг 4 — Количество + CTA ──────────────────── */}
							<section className="panel-config-step panel-order-step">
								<p className="panel-step-number">Шаг 4</p>
								<h2>
									Количество. <span>Добавьте нужное число модулей.</span>
								</h2>
								<div className="panel-quantity-row">
									<div
										className="panel-quantity-control"
										aria-label="Количество панелей"
									>
										<button
											type="button"
											aria-label="Уменьшить количество"
											onClick={() =>
												setQuantity((value) => Math.max(1, value - 1))
											}
											disabled={quantity === 1}
										>
											<MinusOutlined />
										</button>
										{editingQuantity ? (
											<input
												ref={quantityInputRef}
												type="number"
												min={1}
												max={99}
												value={quantity}
												onChange={(e) => {
													const val = parseInt(e.target.value, 10);
													if (!isNaN(val) && val >= 1 && val <= 99)
														setQuantity(val);
												}}
												onBlur={() => setEditingQuantity(false)}
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														(e.target as HTMLInputElement).blur();
													}
												}}
												style={{
													width: 48,
													textAlign: "center",
													border: "none",
													background: "transparent",
													font: "inherit",
													fontSize: 16,
													fontWeight: 700,
													outline: "none",
												}}
											/>
										) : (
											<strong
												style={{ cursor: "pointer" }}
												onClick={() => {
													setEditingQuantity(true);
													setTimeout(
														() => quantityInputRef.current?.focus(),
														0,
													);
												}}
											>
												{quantity}
											</strong>
										)}
										<button
											type="button"
											aria-label="Увеличить количество"
											onClick={() =>
												setQuantity((value) => Math.min(99, value + 1))
											}
										>
											<PlusOutlined />
										</button>
									</div>
									<div className="panel-order-actions">
										<button
											className="panel-buy-button"
											type="button"
											onClick={handleAddToCart}
											disabled={!selectedVariant}
										>
											<ShoppingOutlined /> Добавить в корзину
										</button>
										<button
											className="panel-secondary-button"
											type="button"
											onClick={() => setIsCalculatorOpen(true)}
										>
											Рассчитать проект
										</button>
									</div>
								</div>
								{/* PDP-06 / PDP-10 — после выбора показываем согласованную
								    цену; до выбора — покупка заблокирована. */}
								{selectedVariant ? (
									<p
										className="panel-price-final"
										style={{
											marginTop: 16,
											fontSize: 18,
											fontWeight: 600,
											color: DARK,
										}}
									>
										{quantity} × {unitPrice.toLocaleString("ru-RU")} ₽ ={" "}
										{totalPrice.toLocaleString("ru-RU")} ₽
									</p>
								) : (
									<p
										className="panel-price-final"
										style={{
											marginTop: 16,
											fontSize: 14,
											color: MUTED,
										}}
									>
										Выберите материал и исполнение, чтобы увидеть цену
									</p>
								)}
								<ul className="panel-order-notes">
									<li>
										<CheckOutlined /> Фактура, исполнение и размер сохранятся в
										корзине
									</li>
									<li>
										<CheckOutlined /> Поможем проверить расчёт перед заказом
									</li>
								</ul>
							</section>

							{/* Технические характеристики — визуально под Шагом 4 */}
							<div className="panel-spec-after-step4">
								<SpecList
									specs={[]}
									panelSize={`${activeSize.width}x${activeSize.height}`}
									execution={
										selectedTexture?.name?.toLowerCase().includes("кож")
											? "кожа"
											: selectedTexture?.name?.toLowerCase().includes("ткан")
												? "ткань"
												: undefined
									}
									thickness={
										typeof panel.thickness_mm === "number"
											? `${panel.thickness_mm} мм`
											: undefined
									}
								/>
								{/* На мобильных «Сочетается с» идёт после характеристик. */}
								{companions.length > 0 ? (
									<div className="panel-companions-mobile">
										<CompanionsCarousel
											title={`Сочетается в размере ${activeSize.label}`}
											products={companions}
										/>
									</div>
								) : null}
							</div>
						</div>
					</div>
				</section>

				{/* На ПК «Сочетается с» — отдельная секция на ширину обеих колонок. */}
				{companions.length > 0 ? (
					<div className="panel-companions-desktop panel-companions-wide">
						<CompanionsCarousel
							title={`Сочетается в размере ${activeSize.label}`}
							products={companions}
						/>
					</div>
				) : null}

				{/* Блок «Просто.» остаётся; скрыта только «Продуманная система». */}
				<section
					className="panel-tech-luxury-wrap"
					aria-label="Технологическая роскошь"
				>
					<TechLuxuryBlock variant="compact" />
				</section>

				{/* PDP-12 — CTA в конфигуратор с выбранной панелью. */}
				<section className="panel-configurator-cta">
					<div className="panel-configurator-cta-inner">
						<p className="panel-configurator-cta-eyebrow">
							Готовы увидеть на своей стене?
						</p>
						<h3>Ваш интерьер начинается здесь.</h3>
						<p className="panel-configurator-cta-sub">
							Сфотографируйте стену — мы покажем, как эта панель будет выглядеть
							именно у вас дома.
						</p>
						<button
							type="button"
							onClick={() => {
								const params = new URLSearchParams({
									panelId: selectedVariant?.panel_id ?? panel.id,
									sizeKey: activeSizeKey,
								});
								if (selectedVariant?.texture_id) {
									params.set("textureId", selectedVariant.texture_id);
								}
								navigate(`/configurator?${params.toString()}`);
							}}
						>
							Открыть конфигуратор →
						</button>
					</div>
				</section>
			</main>

			<div className="panel-mobile-buybar">
				<div>
					<span>
						{panel.name} · {quantity} шт.
					</span>
					<strong>{totalPrice.toLocaleString("ru-RU")} ₽</strong>
				</div>
				<button
					type="button"
					onClick={handleAddToCart}
					disabled={!selectedVariant}
				>
					В корзину
				</button>
			</div>

			{/* PC-CALC — боковая панель расчёта проекта. */}
			<CalculatorSidebar
				isOpen={isCalculatorOpen}
				onClose={() => setIsCalculatorOpen(false)}
				onSelectPanel={(nextPanel) => navigate(`/catalog/${nextPanel.id}`)}
				context={{
					panelId: panel.id,
					panels: (panelsData?.items ?? []).map((base) => ({
						id: base.id,
						name: base.name,
						image:
							base.form_preview_path ||
							base.photo_paths?.[0] ||
							base.photo_path ||
							(allVariants ?? []).find(
								(v) => v.panel_id === base.id && v.image_paths.length,
							)?.image_paths[0],
						textures: getTextureGroups(
							(allVariants ?? []).filter((v) => v.panel_id === base.id),
							textureSwatches,
						).map((group) => ({
							id: group.id,
							name: group.name,
							image:
								textureSwatches.get(group.id) ||
								group.variants[0]?.image_paths[0],
							colors: group.variants.map((v, i) => ({
								id: v.id,
								name: v.name?.trim() || `Исполнение ${i + 1}`,
								image: v.image_paths[0],
							})),
						})),
					})),
					productName: panel.name,
					productImage: selectedImage ? imageSrc(selectedImage) : undefined,
					textureChoices: textureGroups.map((group) => ({
						id: group.id,
						name: group.name,
						image: group.swatchImage || group.images[0],
						swatchImage: group.swatchImage || undefined,
						colors: group.variants.map((variant, index) => ({
							id: variant.id,
							name: variant.name?.trim() || `Исполнение ${index + 1}`,
							image: variant.image_paths[0],
							swatchImage: group.swatchImage || undefined,
						})),
					})),
					onSelectTexture: ({ textureId, colorId }) => {
						const group = textureGroups.find((item) => item.id === textureId);
						const variant = group?.variants.find((item) => item.id === colorId);
						if (!group || !variant) return;
						const finishIndex = group.images.indexOf(variant.image_paths[0]);
						if (finishIndex < 0) return;
						setSelectedFinish({ groupId: group.id, finishIndex });
					},
					textureName: selectedTexture?.name,
					textureId: selectedVariant?.texture_id,
					colorName:
						selectedVariant?.name?.trim() ||
						(selectedFinish
							? `Исполнение ${selectedFinish.finishIndex + 1}`
							: undefined),
					colorId: selectedVariant?.id,
					sizeKey: activeSizeKey,
					// Справочник для второй позиции комбо: все фактуры панели
					// с их исполнениями (вариантами).
					textures: textureGroups.map((group) => ({
						id: group.id,
						name: group.name,
						colors: group.variants.map((variant, index) => ({
							id: variant.id,
							name: variant.name?.trim() || `Исполнение ${index + 1}`,
						})),
					})),
				}}
				onAddToCart={(result, _sizeKey, positions) => {
					if (positions?.length) {
						const resolved = positions.map((pos) => ({
							pos,
							variant: (allVariants ?? []).find(
								(v) =>
									v.id === pos.colorId &&
									v.panel_id === pos.panelId &&
									v.texture_id === pos.textureId,
							),
						}));
						if (resolved.some((x) => !x.variant)) {
							message.warning(
								"Выберите базовую панель, текстуру и исполнение обеих позиций",
							);
							return;
						}
						resolved.forEach(({ pos, variant }, index) => {
							if (!variant) return;
							const line = result.breakdown?.[index];
							const count =
								line?.panels_count ??
								pos.boxes *
									(pos.sizeKey === "600x600"
										? 4
										: pos.sizeKey === "300x600"
											? 6
											: 12);
							addToCart(
								{
									id: `panel-${variant.id}-${pos.sizeKey}-calc`,
									productId: variant.panel_id,
									variantId: variant.id,
									executionName: variant.name || "",
									name: `${pos.panelName} — ${pos.textureName}`,
									price: line?.price_per_panel ?? 0,
									image: variant.image_paths[0],
									color: "",
									colorName: pos.colorName || "",
									textureId: variant.texture_id,
									textureName: variant.texture_name,
									sizeKey: pos.sizeKey,
									size: pos.sizeKey.replace("x", "×") + " мм",
									area: line?.actual_area ?? 0,
								},
								count,
							);
						});
						message.success("Обе позиции проекта добавлены в корзину");
						setIsCalculatorOpen(false);
						openCart(true);
						return;
					}
					if (!panel || !selectedVariant) {
						message.warning("Выберите фактуру и исполнение панели");
						return;
					}
					const panelsCount = result.panels_count || 1;
					addToCart(
						{
							id: `panel-${selectedVariant.id}-${activeSizeKey}-calc`,
							productId: selectedVariant.panel_id,
							variantId: selectedVariant.id,
							executionName: selectedVariant.name || "",
							name: `${panel.name} — ${selectedTexture?.name || "Базовая фактура"}`,
							price:
								result.price_per_panel && result.price_per_panel > 0
									? result.price_per_panel
									: Math.round(result.purchase_price / panelsCount),
							image: selectedImage,
							color: "",
							colorName: `Исполнение ${(selectedFinish?.finishIndex ?? 0) + 1}`,
							area: result.actual_area,
							textureId: selectedVariant.texture_id,
							textureName: selectedVariant.texture_name || "",
							sizeKey: activeSizeKey,
							size: `${activeSize.width}×${activeSize.height} мм`,
						},
						panelsCount,
					);
					message.success(
						`Проект добавлен в корзину: ${result.boxes_count} коробок, ${panelsCount} панелей`,
					);
					setIsCalculatorOpen(false);
					openCart(true);
				}}
				onSubscribe={(result) => {
					const params = new URLSearchParams({
						area: String(result.actual_area),
					});
					if (result.subscription_plan_id)
						params.set("plan", result.subscription_plan_id);
					setIsCalculatorOpen(false);
					navigate(`/pricing?${params.toString()}`);
				}}
			/>

			{/* PDP-07 — Lightbox на интерьерных миниатюрах. */}
			<AnimatePresence>
				{lightboxImage ? (
					<motion.div
						className="panel-lightbox"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						role="dialog"
						aria-modal="true"
						aria-label={lightboxImage.title}
						onClick={() => setLightboxImage(null)}
						onKeyDown={(e) => {
							if (e.key === "Escape") setLightboxImage(null);
						}}
					>
						<button
							className="panel-lightbox-close"
							type="button"
							aria-label="Закрыть"
							onClick={() => setLightboxImage(null)}
						>
							<CloseOutlined />
						</button>
						<motion.img
							key={lightboxImage.id}
							src={imageSrc(lightboxImage.url)}
							alt={lightboxImage.title}
							initial={{ scale: 0.92, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.92, opacity: 0 }}
							transition={{ duration: 0.25 }}
							onClick={(e) => e.stopPropagation()}
						/>
						<div
							className="panel-lightbox-caption"
							onClick={(e) => e.stopPropagation()}
						>
							<strong>{lightboxImage.title}</strong>
							{lightboxImage.subtitle ? (
								<span>{lightboxImage.subtitle}</span>
							) : null}
						</div>
					</motion.div>
				) : null}
			</AnimatePresence>

			<PanelPageStyles />
		</div>
	);
}

function PanelPageSkeleton() {
	return (
		<div className="panel-page panel-skeleton-page">
			<div className="panel-intro">
				<Skeleton active paragraph={{ rows: 2 }} />
			</div>
			<div className="panel-buy-layout">
				<Skeleton.Image active className="panel-skeleton-image" />
				<Skeleton active paragraph={{ rows: 12 }} />
			</div>
			<PanelPageStyles />
		</div>
	);
}

function PanelPageStyles() {
	return (
		<style>{`
			.panel-page{min-height:100vh;padding-top:72px;background:#fff;color:${DARK};font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.panel-page *{box-sizing:border-box}.panel-product-header{position:sticky;top:48px;z-index:40;background:rgba(255,255,255,.9);border-bottom:1px solid rgba(0,0,0,.08);backdrop-filter:saturate(180%) blur(18px)}.panel-header-inner{max-width:1320px;height:52px;margin:0 auto;padding:0 32px;display:flex;align-items:center;justify-content:space-between}.panel-back-link{display:inline-flex;align-items:center;gap:7px;color:${MUTED};text-decoration:none;font-size:13px}.panel-header-actions{display:flex;align-items:center;gap:20px;font-size:13px;font-weight:600}.panel-header-actions button{border:0;border-radius:999px;background:${BLUE};color:#fff;padding:7px 14px;cursor:pointer}.panel-intro{max-width:1320px;margin:0 auto;padding:38px 32px 54px}.panel-intro-copy{width:480px;text-align:left}.panel-eyebrow{margin:0 0 10px;color:#bf4800;font-size:13px;font-weight:600}.panel-intro h1{margin:0;color:${DARK};font-size:clamp(36px,4vw,52px);line-height:1;letter-spacing:-.04em}.panel-price-lead{margin:12px 0 0;font-size:15px;color:${MUTED}}.panel-buy-layout{max-width:1320px;margin:0 auto;padding:0 32px 120px;display:flex;align-items:flex-start;gap:72px}.panel-visual-column{min-width:0;flex:0 0 480px;align-self:flex-start}.panel-config-scroll{flex:1 1 auto;min-width:0;align-self:flex-start;width:100%}.panel-config-scroll::-webkit-scrollbar{width:4px}.panel-config-scroll::-webkit-scrollbar-track{background:transparent}.panel-config-scroll::-webkit-scrollbar-thumb{background:#d2d2d7;border-radius:2px}.panel-main-image{position:relative;min-height:610px;aspect-ratio:1.35;background:transparent;border-radius:28px;overflow:hidden}.panel-main-image>img{width:100%;height:100%;object-fit:contain;display:block;padding:44px}.panel-image-caption{position:absolute;left:22px;right:22px;bottom:18px;display:flex;justify-content:space-between;color:${MUTED};font-size:12px}.panel-placeholder{height:100%;min-height:610px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:${MUTED}}.panel-placeholder span{width:170px;aspect-ratio:1;border-radius:22px;background:#e8e8ed;display:flex;align-items:center;justify-content:center;color:${DARK};font-size:22px;font-weight:600}.panel-benefits{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}.panel-benefits>div{padding:18px;border-radius:18px;background:${SURFACE};display:flex;flex-direction:column;gap:5px}.panel-benefits strong{font-size:13px}.panel-benefits span{color:${MUTED};font-size:12px;line-height:1.35}.panel-config-column{min-width:0}.panel-config-step{padding:8px 0 46px;margin-bottom:38px;border-bottom:1px solid #d2d2d7}.panel-step-number{margin:0 0 8px;color:${MUTED};font-size:13px;font-weight:600}.panel-config-step h2{margin:0 0 24px;font-size:24px;line-height:1.2;letter-spacing:-.025em}.panel-form-name{margin:-2px 0 8px;color:${DARK};font-size:15px;font-weight:600;letter-spacing:-.01em}.panel-config-step h2 span{color:#86868b}.panel-picto-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.panel-finish-grid{display:grid;gap:12px}.panel-picto-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 2px 4px;border:2px solid #d2d2d7;background:#fff;border-radius:12px;cursor:pointer;color:${DARK};transition:border-color .2s ease}.panel-picto-card:hover{border-color:#86868b}.panel-picto-card.is-active{border-color:${BLUE};box-shadow:0 0 0 1px ${BLUE}}.panel-finish-card{position:relative;width:100%;border:2px solid #d2d2d7;background:#fff;border-radius:14px;cursor:pointer;color:${DARK};transition:border-color .2s ease,box-shadow .2s ease}.panel-finish-card:hover{border-color:#86868b}.panel-finish-card.is-active{border-color:${BLUE};box-shadow:0 0 0 1px ${BLUE}}.panel-picto-swatch{width:48px;height:48px;border-radius:10px;overflow:hidden;background:${SURFACE}}.panel-picto-swatch img{width:100%;height:100%;object-fit:cover;display:block}.panel-picto-placeholder{display:block;width:48px;height:48px;border-radius:10px;background:${SURFACE}}.panel-picto-label{font-size:10px;font-weight:500;color:${MUTED};line-height:1.2;text-align:center;max-width:100%;word-break:break-word}.panel-picto-card.is-active .panel-picto-label{color:${DARK};font-weight:600}.panel-check{color:${BLUE};font-size:15px}.panel-finish-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.panel-finish-card{padding:6px 6px 8px;text-align:left}.panel-finish-card img{width:100%;aspect-ratio:1;object-fit:cover;display:block;border-radius:6px;background:${SURFACE}}.panel-finish-card span:not(.panel-check){display:block;padding:6px 2px 2px;font-size:12px;font-weight:600}.panel-finish-card .panel-check{position:absolute;right:12px;bottom:13px}.panel-inline-error{color:#b42318;font-size:13px;line-height:1.4}.panel-order-step{border-bottom:0;margin-bottom:0;padding-bottom:0}.panel-quantity-row{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:20px;margin-bottom:18px}.panel-quantity-control{flex:0 0 auto}.panel-quantity-control{display:grid;grid-template-columns:42px 52px 42px;align-items:center;border:1px solid #d2d2d7;border-radius:12px;overflow:hidden}.panel-quantity-control button{height:44px;border:0;background:#fff;color:${BLUE};cursor:pointer}.panel-quantity-control button:disabled{color:#b8b8bd;cursor:not-allowed}.panel-quantity-control strong{text-align:center}.panel-quantity-row>div:last-child:not(.panel-order-actions){display:flex;flex-direction:column;align-items:end;gap:4px}.panel-order-actions{flex:1 1 200px;min-width:200px;display:block}.panel-quantity-row>div:last-child strong{font-size:24px}.panel-quantity-row>div:last-child span{color:${MUTED};font-size:12px}.panel-buy-button,.panel-secondary-button{width:100%;height:52px;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 18px;white-space:nowrap;line-height:1}.panel-buy-button{border:0;background:${BLUE};color:#fff}.panel-buy-button:hover{background:#1B5E20}.panel-buy-button:disabled,.panel-mobile-buybar button:disabled,.panel-configurator-cta button:disabled{opacity:.45;cursor:not-allowed}.panel-secondary-button{margin-top:10px;border:1px solid #d2d2d7;background:#fff;color:${BLUE}}.panel-order-notes{list-style:none;padding:18px 0 0;margin:0;display:grid;gap:11px;color:${MUTED};font-size:12px}.panel-order-notes li{display:flex;gap:9px;align-items:start}.panel-order-notes .anticon{color:#34a853;margin-top:2px}
			@media(min-width:981px){
				.panel-config-column{max-width:460px}
				.panel-visual-column--base{margin-top:-95px}
				.panel-config-step{padding:2px 0 12px;margin-bottom:10px}
				.panel-finish-step{padding-bottom:10px;margin-bottom:8px}
				.panel-config-step h2{margin-bottom:8px;font-size:18px}
				.panel-size-step{padding-bottom:9px;margin-bottom:7px}
				.panel-size-step h2{margin-bottom:6px}
				.panel-step-number{margin-bottom:2px;font-size:11px}
				.panel-form-name{margin-bottom:3px;font-size:13px}
				.panel-picto-grid{gap:6px}.panel-finish-grid{gap:6px}


				.panel-picto-swatch{width:44px;height:44px;border-radius:9px}.panel-picto-placeholder{width:44px;height:44px;border-radius:9px}
				.panel-picto-label{font-size:9px}

				.panel-finish-card{padding:4px 4px 5px}
				.panel-finish-card span:not(.panel-check){padding:4px 1px 1px;font-size:10px}
				.panel-quantity-row{gap:10px;margin-bottom:8px}
				.panel-order-actions{display:flex;gap:6px;min-width:0}
				.panel-buy-button,.panel-secondary-button{height:40px;font-size:12px;padding:0 10px}
				.panel-secondary-button{margin-top:0}
				.panel-price-final{margin-top:8px !important}
				.panel-order-notes{padding-top:8px;gap:5px;font-size:10px}
				.panel-order-step{padding-bottom:0;margin-bottom:0}
			}

			.panel-companions-mobile{display:none}
			@media(min-width:981px){
				.panel-buy-layout{padding-bottom:44px}
				.panel-companions-wide{max-width:1320px;margin:0 auto;padding:0 32px 40px}
				.panel-companions-wide .panel-companions-section{padding:0 !important;width:100%;max-width:100%;overflow:hidden}
				.panel-companions-wide .panel-companions-inner{max-width:none !important;margin:0 !important}
				.panel-companions-wide .panel-companions-track{gap:16px !important;overflow-x:hidden !important}
				.panel-companions-wide .panel-companion-card{width:calc((100% - 48px)/4) !important;min-width:0}
			}
			/* ТЗ-блок «Просто.» и секция «Продуманная система» — минимальный промежуток между ними */
			.panel-tech-luxury-wrap{padding:56px max(32px,calc((100% - 1256px)/2));background:#f5f5f7;margin-top:0}
			.panel-tech-luxury-wrap>.tech-luxury-block{margin:0 !important;padding:0 !important;max-width:1256px !important;margin-left:auto !important;margin-right:auto !important}
			.panel-buy-layout+.panel-tech-luxury-wrap{padding-top:8px}
			.panel-tech-luxury-wrap+.panel-story-section{padding-top:8px}
			
			
			.tech-luxury-block[data-variant="compact"]{margin-top:0 !important}
			.panel-story-section{padding-top:16px !important}
			@media(max-width:980px){.panel-tech-luxury-wrap{padding:0 14px 32px}.panel-tech-luxury-wrap+.panel-story-section{padding-top:8px}.panel-story-section{padding-top:12px !important}}

			/* Главное фото остаётся в плоском слое и на мобильных: отсутствие
			   rotate/scale сохраняет исходную пиксельную резкость фактуры. */
			.panel-mobile-preview{position:absolute;inset:0;width:100%;height:100%}
			.panel-mobile-preview img{width:100%;height:100%;max-width:none;max-height:none;object-fit:contain;display:block;padding:0}
			.panel-base-preview{width:100%;height:100%;object-fit:contain;display:block;padding:0;border:0;outline:0;box-shadow:none;transform:none;background:transparent;filter:none;clip-path:none;mask:none}

			/* Интерьерные миниатюры (PDP-05/PDP-07) — КОМПАКТНО */
			.panel-interiors{padding:48px max(24px,calc((100% - 1200px)/2));background:#fff}.panel-interiors-inner{max-width:1200px;margin:0 auto}.panel-interiors-eyebrow{margin:0 0 4px;color:#bf4800;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.panel-interiors-title{margin:0 0 18px;color:${DARK};font-size:clamp(20px,2.2vw,26px);font-weight:700;letter-spacing:-.02em;line-height:1.15}.panel-interiors-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}.panel-interiors-grid:has(.panel-interiors-card:only-child){justify-content:flex-start;max-width:240px;margin-left:0}.panel-interiors-card{position:relative;border:0;background:transparent;padding:0;cursor:zoom-in;border-radius:14px;overflow:hidden;text-align:left}.panel-interiors-card img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;transition:transform .4s ease}.panel-interiors-card:hover img{transform:scale(1.03)}.panel-interiors-card span{position:absolute;left:10px;bottom:10px;right:10px;color:#fff;display:flex;flex-direction:column;gap:1px;text-shadow:0 2px 8px rgba(0,0,0,.5)}.panel-interiors-card strong{font-size:13px;font-weight:600;line-height:1.2}.panel-interiors-card small{font-size:11px;opacity:.9;line-height:1.2}
			/* Блок «в интерьере» в левой колонке под «Просто.»: на ширину
			   колонки, одна карточка во всю ширину. На мобильных видна копия
			   в потоке страницы (--flow), на десктопе — колоночная. */
			.panel-interiors--column{display:none}
			.panel-visual-column .panel-interiors{padding:20px 0 0;background:transparent}
			.panel-visual-column .panel-interiors-inner{max-width:none}
			.panel-visual-column .panel-interiors-grid{grid-template-columns:1fr}
			.panel-visual-column .panel-interiors-grid:has(.panel-interiors-card:only-child){max-width:none}
			.panel-visual-column .panel-interiors-title{font-size:20px;letter-spacing:-.02em}
			@media(min-width:981px){.panel-interiors--column{display:block}.panel-interiors--flow{display:none}}

			/* Lightbox (PDP-07) */
			.panel-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.86);z-index:200;display:flex;align-items:center;justify-content:center;padding:48px;cursor:zoom-out}.panel-lightbox img{max-width:90vw;max-height:80vh;object-fit:contain;border-radius:12px;cursor:default;box-shadow:0 24px 60px rgba(0,0,0,.4)}.panel-lightbox-close{position:absolute;top:24px;right:24px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.18);border:0;color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center}.panel-lightbox-close:hover{background:rgba(255,255,255,.32)}.panel-lightbox-caption{position:absolute;left:0;right:0;bottom:32px;text-align:center;color:#fff;display:flex;flex-direction:column;gap:4px;cursor:default}

			/* CTA конфигуратор */
			.panel-configurator-cta{padding:96px max(32px,calc((100% - 1256px)/2));background:${SURFACE}}.panel-configurator-cta-inner{max-width:760px;margin:0 auto;text-align:center}.panel-configurator-cta-eyebrow{margin:0 0 8px;color:#bf4800;font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase}.panel-configurator-cta h3{margin:0 0 16px;color:${DARK};font-size:clamp(28px,3vw,44px);letter-spacing:-.03em;line-height:1.05}.panel-configurator-cta-sub{margin:0 0 28px;color:${MUTED};font-size:17px;line-height:1.5}.panel-configurator-cta button{border:0;border-radius:999px;background:${BLUE};color:#fff;padding:14px 32px;font-size:16px;font-weight:600;cursor:pointer}.panel-configurator-cta button:hover{background:#1B5E20}

			.panel-mobile-buybar{display:none}
			.panel-state{display:flex;align-items:center;justify-content:center;text-align:center;padding-left:24px;padding-right:24px}.panel-state h1{font-size:38px;margin:0 0 12px}.panel-state p:not(.panel-eyebrow){color:${MUTED};margin-bottom:24px}.panel-primary-link{display:inline-flex;align-items:center;gap:8px;color:${BLUE};text-decoration:none}
			.panel-skeleton-page{padding-left:32px;padding-right:32px}.panel-skeleton-image{width:100%!important;height:600px!important}.panel-skeleton-page .panel-buy-layout{padding-left:0;padding-right:0}
			.panel-finish-heading{white-space:nowrap;color:${DARK}}
			.panel-finish-step .panel-finish-heading{margin-bottom:10px}
			@media(min-width:981px){.panel-finish-step{padding-bottom:10px;margin-bottom:8px}}
			@media(max-width:640px){.panel-finish-step{padding-bottom:12px;margin-bottom:10px}.panel-finish-step .panel-finish-heading{margin-bottom:8px}}
			@media(max-width:980px){.panel-intro{padding-bottom:36px}.panel-intro-copy{width:100%;text-align:left}.panel-buy-layout{display:flex;flex-direction:column;gap:38px}.panel-visual-column{flex:none;width:100%;position:static}.panel-visual-column--base{margin-top:0}.panel-config-scroll{flex:none;width:100%}.panel-main-image{min-height:auto}.panel-interiors{padding:32px 20px}.panel-interiors-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}

			/* Технические характеристики — визуально под Шагом 4 в правой колонке */
			.panel-spec-after-step4{margin-top:36px;padding-top:28px;border-top:1px solid #d2d2d7}
			.panel-spec-after-step4>section{margin:0 auto !important;padding:0 !important}
			@media(max-width:980px){.panel-spec-after-step4{margin-top:18px;padding-top:14px;border-top:1px solid #e5e5ea}.panel-companions-desktop{display:none}.panel-companions-mobile{display:block;margin-top:24px}.panel-companions-mobile .panel-companions-section{padding:32px 0 !important;width:100%;max-width:100%;overflow:hidden}}

			/* StoryFallback — десктоп по умолчанию */
			.panel-story-section{padding:88px max(32px,calc((100% - 1256px)/2));background:#fff}
			.panel-story-section>h2{margin:0 0 32px;color:#1d1d1f;font-size:clamp(28px,3vw,40px);letter-spacing:-.03em;line-height:1.05}
			.panel-story-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
			.panel-story-grid article{position:relative;padding:28px 26px 24px;border-radius:20px;background:#f5f5f7;display:flex;flex-direction:column;min-height:240px;transition:background .25s ease}
			.panel-story-grid article:hover{background:#ececef}
			.panel-story-grid article>span:first-child{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:14px;background:#fff;color:#bf4800;font-size:18px;font-weight:700;letter-spacing:.02em;margin:0 0 20px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
			.panel-story-grid h3{margin:0 0 10px;font-size:19px;line-height:1.2;letter-spacing:-.02em;color:#1d1d1f}
			.panel-story-grid p{margin:0;font-size:14px;line-height:1.5;color:#6e6e73}
			@media(max-width:640px){
				/* ─── Мобильная версия (≤ 640px) — КОМПАКТНАЯ ──────────────── */
				/* Общая раскладка — меньше расстояния между блоками */
				.panel-page{padding-top:56px;padding-bottom:84px;background:#fff}
				.panel-buy-layout{padding:0;display:flex;flex-direction:column;gap:14px}

				/* Шапка страницы (хедер + субхедер) */
				.panel-product-header{top:48px}
				.panel-header-inner{height:44px;padding:0 14px;gap:8px}
				.panel-header-actions{gap:10px;font-size:11px}
				.panel-header-actions button{padding:5px 10px;font-size:11px}

				/* Шапка продукта — компактно */
				.panel-intro{padding:18px 14px 8px;text-align:left}
				.panel-intro-copy{width:100%;text-align:left}
				.panel-eyebrow{margin:0 0 4px;font-size:11px;letter-spacing:.04em}
				.panel-intro h1{margin:0;font-size:24px;line-height:1.1;letter-spacing:-.035em}
				.panel-price-lead{margin:6px 0 0;font-size:13px;font-weight:500;color:#1d1d1f}
				.panel-price-lead span{color:#6e6e73;font-size:12px;font-weight:400}

				/* Изображение и его блок 3D-обёртки — занимает всю ширину */
				.panel-visual-column{flex:none;width:100%;position:static;padding:0}
				.panel-visual-column .panel-main-image{min-height:auto;width:100%;aspect-ratio:1/1;border-radius:0;margin:0 0 4px;max-width:none;margin-left:0;margin-right:0;background:transparent;position:relative;display:flex;align-items:center;justify-content:center;overflow:visible;box-shadow:none;border:none;perspective:1200px;perspective-origin:center center}
				.panel-visual-column .panel-main-image>img{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;padding:0!important;display:block;object-fit:contain}
				.panel-visual-column .panel-main-image>svg{display:block;width:100%!important;height:100%!important;position:absolute!important;inset:0;max-width:none!important;max-height:none!important}
				.panel-image-caption{left:14px;right:14px;bottom:10px;font-size:11px}

				/* Блоки преимуществ — только десктоп */
				.panel-benefits{display:none}

				/* Конфигуратор: шаги — компактно */
				.panel-config-column{flex:none;width:100%;padding:0 14px}
				.panel-config-step{padding:8px 0 10px;margin-bottom:8px;border-bottom:1px solid #e5e5ea}
				.panel-step-number{margin:0 0 2px;color:#6e6e73;font-size:9px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase}
				.panel-form-name{margin:0 0 3px;color:#6e6e73;font-size:11px;font-weight:500}
				.panel-config-step h2{margin:0 0 7px;font-size:16px;line-height:1.15;letter-spacing:-.025em}
				.panel-config-step h2 span{color:#86868b;font-size:12px;font-weight:400}
				.panel-size-step{padding-bottom:8px;margin-bottom:6px}
				.panel-size-step h2{margin-bottom:5px}

				/* Сетки выбора текстуры и отделок — компактнее */
				.panel-picto-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.panel-finish-grid{display:grid;gap:8px}

				.panel-finish-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}

				.panel-picto-swatch{width:40px;height:40px;border-radius:8px}.panel-picto-placeholder{width:40px;height:40px;border-radius:8px}
				.panel-picto-label{font-size:8px}

				.panel-finish-card{padding:4px 4px 6px;border-radius:10px}
				.panel-finish-card img{border-radius:5px}
				.panel-finish-card span:not(.panel-check){padding:4px 1px 2px;font-size:10px}
				.panel-check{right:7px;bottom:8px;font-size:11px}

				/* Шаг заказа / кнопок — компактно в один ряд */
				.panel-order-step{padding:8px 0 10px;border-bottom:1px solid #e5e5ea;margin-bottom:8px}
				.panel-quantity-row{flex-direction:row;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;flex-wrap:nowrap}
				.panel-quantity-row>div:last-child{align-items:flex-end;gap:0}
				.panel-quantity-control{justify-self:start;width:124px;grid-template-columns:36px 52px 36px;border-radius:10px}
				.panel-quantity-control button{height:40px;font-size:14px}
				.panel-quantity-control strong{font-size:15px}
				.panel-quantity-row>div:last-child strong{font-size:18px;line-height:1.1}
				.panel-quantity-row>div:last-child span{font-size:10px}
				.panel-order-actions{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:6px}
				.panel-buy-button,.panel-secondary-button{height:38px;border-radius:9px;font-size:11px;padding:0 9px}
				.panel-price-final{margin-top:7px !important}
				.panel-order-notes{padding:7px 0 0;gap:4px;font-size:9px}

				/* Секция интерьеров — компактно */
				.panel-interiors{padding:32px 14px}
				.panel-interiors-eyebrow{margin:0 0 4px;font-size:11px}
				.panel-interiors-title{margin:0 0 14px;font-size:20px;letter-spacing:-.03em}
				.panel-interiors-grid{grid-template-columns:1fr;gap:10px}
				.panel-interiors-card{border-radius:14px}
				.panel-interiors-card img{aspect-ratio:1/1}
				.panel-interiors-card strong{font-size:13px}
				.panel-interiors-card small{font-size:11px}

				/* Блок "Продуманная система" (StoryFallback) — мобильный */
				.panel-story-section{padding:32px 14px}.panel-story-section>h2{margin:0 0 14px;font-size:20px;letter-spacing:-.03em}
				.panel-story-grid{grid-template-columns:1fr;gap:8px}
				.panel-story-grid article{padding:12px 14px 14px;border-radius:12px;background:#f5f5f7;min-height:auto;display:grid;grid-template-columns:auto 1fr;column-gap:12px;align-items:start;transition:background .2s ease}
				.panel-story-grid article:active{background:#ececef}
				.panel-story-grid article>span:first-child{grid-row:span 2;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:#fff;color:#bf4800;font-size:13px;font-weight:700;margin:0;box-shadow:0 1px 2px rgba(0,0,0,.04);align-self:start}
				.panel-story-grid h3{margin:0 0 2px;font-size:14px;line-height:1.2;letter-spacing:-.02em;color:#1d1d1f;grid-column:2}
				.panel-story-grid p{margin:0;font-size:11px;line-height:1.35;color:#6e6e73;grid-column:2}

				/* CTA — компактно */
				.panel-configurator-cta{padding:40px 14px 56px}
				.panel-companions-section{padding:32px 14px}.panel-companions-section h2{font-size:20px;margin:0 0 14px}
				.panel-configurator-cta-inner h3{font-size:20px}
				.panel-configurator-cta-sub{font-size:13px;margin:0 0 16px}
				.panel-configurator-cta button{padding:11px 24px;font-size:14px}

				/* Lightbox — компактно */
				.panel-lightbox{padding:14px}
				.panel-lightbox-close{top:14px;right:14px;width:38px;height:38px;font-size:16px}
				.panel-lightbox-caption{bottom:14px;font-size:11px;padding:0 14px}

				/* Фиксированная мобильная витрина покупки — компактно */
				.panel-mobile-buybar{position:fixed;left:0;right:0;bottom:0;z-index:60;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 14px max(8px,env(safe-area-inset-bottom));background:rgba(255,255,255,.94);border-top:1px solid rgba(0,0,0,.08);backdrop-filter:blur(18px)}
				.panel-mobile-buybar>div{display:flex;flex-direction:column;gap:0}
				.panel-mobile-buybar span{color:#6e6e73;font-size:9px}
				.panel-mobile-buybar strong{font-size:15px;color:#1d1d1f;font-weight:600;line-height:1.1}
				.panel-mobile-buybar button{height:40px;padding:0 18px;border:0;border-radius:10px;background:#2E7D32;color:#fff;font-weight:600;font-size:13px}

				/* Skeleton — компактно */
				.panel-skeleton-page{padding-left:14px;padding-right:14px}
				.panel-skeleton-image{height:300px!important}

				/* PDP-rotation — поворот превью по клику работает и на мобильных. */
			}
		`}</style>
	);
}
