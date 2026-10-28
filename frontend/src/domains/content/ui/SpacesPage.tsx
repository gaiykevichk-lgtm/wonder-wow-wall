import { useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Modal, Skeleton } from "antd";
import {
	ArrowRightOutlined,
	CheckOutlined,
	SwapOutlined,
	ReloadOutlined,
} from "@ant-design/icons";
import { SpaceDetailModal } from "./SpaceDetailModal";
import type { SpaceCardItem } from "../model/spacesApi";
import { usePanelVariants, usePanels } from "../../catalog/api/catalogApi";
import { PageMeta } from "../../../shared/ui/PageMeta";
import { imageSrc } from "../../../shared/lib/imageSrc";
import "./SpacesPage.css";
import {
	resolveSpaceRender,
	resolveCatalogBinding,
} from "../model/spacePresentation";
import {
	buildTextureFamilyIndex,
	resolveSpacePhoto,
	resolveVariantPhoto,
} from "../model/spaceTextureImages";
import {
	useSpaceCards,
	useSpacesInteriors,
	useSpaceTextureImages,
} from "../model/spacesApi";
import {
	SPACES_CATEGORIES,
	SPACES_STYLES,
	SPACES_TEXTURES,
	availableRoomOptions,
	availableZoneOptions,
	estimateSpacePrice,
	formatSpacePrice,
	type SpaceCategoryKey,
	type SpaceInterior,
} from "../model/spacesData";

const FOCUS_RING =
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4CAF50]";

/** Русская плюрализация: 1 фактура / 2 фактуры / 5 фактур. */
function plural(n: number, one: string, few: string, many: string) {
	const m10 = n % 10;
	const m100 = n % 100;
	if (m10 === 1 && m100 !== 11) return one;
	if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
	return many;
}

/**
 * SPC-06/SPC-07: схема раскладки панелей. Реагирует и на выбранную фактуру,
 * и на режим: «моно» — одна фактура на всю стену, «комбинация» — вертикальные
 * пояса из разных фактур той же сцены.
 *
 * Это именно схема, а не сфабрикованное фото: ТЗ 06 запрещает «выдуманные
 * фотографии интерьеров», а SPC-08 требует сохранять ту же сцену при смене
 * фактуры, поэтому фото подложки не подменяется.
 */
function WallLayoutPreview({
	interior,
	textureIndex,
	combined,
}: {
	interior: SpaceInterior;
	textureIndex: number;
	combined: boolean;
}) {
	const COLS = 6;
	const ROWS = 3;
	const FALLBACK = "#8a8a8e";
	const active = interior.textures[textureIndex];
	// Для комбинации берём не больше трёх фактур — иначе пояса читаются плохо.
	const palette = interior.textures.slice(0, 3);

	const colorForColumn = (col: number) => {
		if (!combined) return active?.colorHex || FALLBACK;
		const band = Math.floor(((col + 0.5) / COLS) * palette.length);
		return palette[Math.min(band, palette.length - 1)]?.colorHex || FALLBACK;
	};

	const [w, h] = interior.panelSize.split("x").map(Number);
	const aspect = w && h ? w / h : 1;
	// Высокие панели (300×600) на мобильной ширине дали бы схему под два
	// экрана — рядов меньше, пропорции те же.
	const ROWS_REAL = aspect < 1 ? 2 : ROWS;

	const label = combined
		? `Схема раскладки: комбинация из ${palette.length} ${plural(
				palette.length,
				"фактуры",
				"фактур",
				"фактур",
			)} поясами`
		: `Схема раскладки: моно, фактура ${active?.name || "базовая"}`;

	return (
		<div className="rounded-xl bg-[#f5f5f7] p-2">
			<div
				role="img"
				aria-label={label}
				className="grid gap-1"
				style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
			>
				{Array.from({ length: COLS * ROWS_REAL }).map((_, i) => {
					const col = i % COLS;
					return (
						<span
							key={i}
							className="rounded-[3px] transition-colors duration-300"
							style={{
								aspectRatio: String(aspect),
								backgroundColor: colorForColumn(col),
								boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
							}}
						/>
					);
				})}
			</div>
			<p className="mt-2 flex flex-wrap items-center gap-x-2 text-[10px] uppercase tracking-wider text-neutral-400">
				<span>{label}</span>
				<span aria-hidden>·</span>
				<span>{interior.panelSize.replace("x", "×")} мм</span>
			</p>
		</div>
	);
}

interface ChipOption {
	key: string;
	label: string;
}

/**
 * Группа фильтров-чипов с поддержкой клавиатуры (SPC-10):
 * roving tabindex, стрелки ←/→, Home/End, выбор Enter/Space.
 */
function FilterChipGroup({
	label,
	options,
	value,
	onChange,
	activeClass,
	idleClass,
}: {
	label: string;
	options: ChipOption[];
	value: string;
	onChange: (key: string) => void;
	activeClass: string;
	idleClass: string;
}) {
	const refs = useRef<(HTMLButtonElement | null)[]>([]);

	const handleKeyDown = (
		event: React.KeyboardEvent<HTMLButtonElement>,
		index: number,
	) => {
		let next: number | null = null;
		if (event.key === "ArrowRight") next = (index + 1) % options.length;
		else if (event.key === "ArrowLeft")
			next = (index - 1 + options.length) % options.length;
		else if (event.key === "Home") next = 0;
		else if (event.key === "End") next = options.length - 1;
		if (next === null) return;
		event.preventDefault();
		refs.current[next]?.focus();
	};

	return (
		<div role="group" aria-label={label} className="spaces-chip-group">
			{options.map((option, index) => {
				const isActive = value === option.key;
				return (
					<button
						key={option.key}
						ref={(el) => {
							refs.current[index] = el;
						}}
						type="button"
						aria-pressed={isActive}
						tabIndex={isActive ? 0 : -1}
						onClick={() => onChange(option.key)}
						onKeyDown={(e) => handleKeyDown(e, index)}
						className={`${FOCUS_RING} ${isActive ? activeClass : idleClass}`}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}

export default function SpacesPage() {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();

	// ─── Фильтры живут в URL (ТЗ 06 [Р]): восстановление, шаринг, возврат ───
	const selectedCategory = (searchParams.get("cat") ||
		"home") as SpaceCategoryKey;
	const selectedRoom = searchParams.get("room") || "all";
	const selectedZone = searchParams.get("zone") || "all_walls";
	const selectedStyle = searchParams.get("style") || "all";
	const selectedTexture = searchParams.get("tex") || "all";

	const applyParams = useCallback(
		(patch: Record<string, string | null>) => {
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					for (const [key, val] of Object.entries(patch)) {
						if (val === null || val === "") next.delete(key);
						else next.set(key, val);
					}
					return next;
				},
				{ replace: true },
			);
		},
		[setSearchParams],
	);

	const { status, data: interiors, page, retry } = useSpacesInteriors();
	const panels = usePanels();
	const panelVariants = usePanelVariants();
	// Карточки страницы — из админской вкладки «Изображения»: каждая строка
	// вкладки даёт карточку с фото и текстами. Старый каталог интерьеров
	// остаётся запасным вариантом, если карточки не загрузились.
	const {
		status: cardsStatus,
		data: cards,
		retry: retryCards,
	} = useSpaceCards();
	const cardsFailed = cardsStatus === "error";
	// Управляемые карточки берутся только когда они реально есть;
	// пустой список — это отсутствие карточек, а не пустая страница.
	const useManagedCards = cardsStatus === "success" && cards.length > 0;
	const filteredCards = useMemo(
		() =>
			(cards ?? []).filter(
				(card) =>
					(card.category || "home") === selectedCategory ||
					card.category === "mixed",
			),
		[cards, selectedCategory],
	);
	// Фото карточек и модалки — из админской вкладки «Изображения».
	const { textureImages, textureRefs } = useSpaceTextureImages();
	const textureFamilyIndex = useMemo(
		() => buildTextureFamilyIndex(textureRefs),
		[textureRefs],
	);

	// Смена назначения сбрасывает зависимые типы и зоны (ТЗ 06 [Р]).
	const handleCategoryChange = (cat: SpaceCategoryKey) => {
		applyParams({ cat, room: null, zone: null });
	};
	const handleRoomChange = (room: string) => {
		applyParams({ room, zone: null });
	};

	// Приёмка ТЗ 06: чипы показываются только для реально существующих
	// типов помещений и зон — иначе выбор заведомо даёт пустую выдачу.
	const roomOptions = useMemo(
		() => availableRoomOptions(selectedCategory, interiors),
		[selectedCategory, interiors],
	);

	// Значение из URL могло остаться от более полного набора данных
	// (например room=restaurant) — считаем его «все типами».
	const effectiveRoom = useMemo(
		() =>
			roomOptions.some((o) => o.key === selectedRoom) ? selectedRoom : "all",
		[roomOptions, selectedRoom],
	);

	const availableZones = useMemo(
		() => availableZoneOptions(selectedCategory, effectiveRoom, interiors),
		[selectedCategory, effectiveRoom, interiors],
	);

	const effectiveZone = useMemo(
		() =>
			availableZones.some((o) => o.key === selectedZone)
				? selectedZone
				: "all_walls",
		[availableZones, selectedZone],
	);

	const filteredInteriors = useMemo(() => {
		return interiors.filter((item) => {
			if (item.category !== selectedCategory) return false;
			if (effectiveRoom !== "all" && item.roomType !== effectiveRoom)
				return false;
			if (
				selectedCategory === "home" &&
				effectiveRoom !== "all" &&
				effectiveZone !== "all_walls"
			) {
				if (item.zone !== effectiveZone && item.zone !== "all_walls")
					return false;
			}
			if (selectedStyle !== "all" && item.style !== selectedStyle) return false;
			if (selectedTexture !== "all" && item.texture !== selectedTexture)
				return false;
			return true;
		});
	}, [
		interiors,
		selectedCategory,
		effectiveRoom,
		effectiveZone,
		selectedStyle,
		selectedTexture,
	]);

	// ─── Модалка «переодевания» (SPC-07) ───
	const [activeInterior, setActiveInterior] = useState<SpaceInterior | null>(
		null,
	);
	const [activeTextureIndex, setActiveTextureIndex] = useState(0);
	const [isCombinedMode, setIsCombinedMode] = useState(false);
	const [detailCard, setDetailCard] = useState<SpaceCardItem | null>(null);
	const [selectedPanelSlug, setSelectedPanelSlug] = useState<string>("");
	const touchStartX = useRef<number | null>(null);

	const openFittingModal = (interior: SpaceInterior) => {
		setActiveInterior(interior);
		setActiveTextureIndex(0);
		// SPC-06: модалка открывается в «родном» режиме интерьера,
		// а не всегда в моно.
		setIsCombinedMode(interior.mode === "combined");
		setSelectedPanelSlug(
			interior.defaultPanelSlug || interior.relatedPanels[0]?.slug || "",
		);
	};

	const stepTexture = (delta: number) => {
		if (!activeInterior) return;
		const total = activeInterior.textures.length;
		setActiveTextureIndex((i) => (i + delta + total) % total);
	};

	const handleModalKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "ArrowRight") {
			event.preventDefault();
			stepTexture(1);
		} else if (event.key === "ArrowLeft") {
			event.preventDefault();
			stepTexture(-1);
		}
	};

	const goToPanel = (
		slug: string,
		interior: SpaceInterior,
		variantId?: string,
	) => {
		const query = new URLSearchParams({ interiorId: interior.id });
		if (variantId) {
			query.set("variantId", variantId);
			const binding = resolveCatalogBinding(interior, slug, variantId);
			if (binding) {
				query.set("finishGroupId", binding.groupId);
				query.set("finishImage", binding.finishImage);
			}
		}
		navigate(`/catalog/${slug}?${query.toString()}`);
	};

	const activeRender = activeInterior
		? resolveSpaceRender(
				activeInterior,
				selectedPanelSlug,
				activeInterior.textures[activeTextureIndex]?.id || "",
				isCombinedMode ? "combined" : "mono",
			)
		: undefined;
	// Приоритет — фото из админской вкладки «Изображения» для выбранной фактуры/пары.
	const activeAdminPhoto = activeInterior
		? resolveVariantPhoto(
				textureImages,
				textureFamilyIndex,
				isCombinedMode ? "combined" : "mono",
				activeInterior.textures[activeTextureIndex]?.family,
				activeInterior,
			)
		: undefined;
	const activeSceneImage = imageSrc(
		activeAdminPhoto || activeRender?.image || activeInterior?.image || "",
	);
	const activePrice = activeInterior
		? estimateSpacePrice(activeInterior.areaM2, activeInterior.panelSize)
		: null;
	return (
		<div className="spaces-page spaces-light">
			<PageMeta
				title="Пространства — интерьерные решения Wonder Wow Wall"
				description="Коллекция готовых интерьеров для дома, бизнеса и социальных объектов. Примеряйте фактуры на стены и находите свой WOW!"
			/>

			<section className="spaces-hero">
				<h1>{page?.heading ?? "Время наполнять."}</h1>
				<p>
					{page?.intro ??
						"Коллекция интерьеров для дома, бизнеса и общественных пространств."}
				</p>
			</section>
			<section className="spaces-catalog">
				<div className="spaces-purpose">
					<FilterChipGroup
						label="Назначение пространства"
						options={[...SPACES_CATEGORIES]}
						value={selectedCategory}
						onChange={(key) => handleCategoryChange(key as SpaceCategoryKey)}
						activeClass="spaces-tab is-active"
						idleClass="spaces-tab"
					/>
				</div>
				{/* ─── Липкая стеклянная панель фильтров: только для каталога интерьеров;
				 когда страница управляется карточками из админки, фильтры не применимы. ─── */}
				{!useManagedCards && (
					<div className="spaces-filters">
						<div className="spaces-filter-rows">
							<div className="spaces-filter-row">
								<span className="spaces-filter-label">Тип</span>
								<FilterChipGroup
									label="Тип помещения"
									options={roomOptions}
									value={selectedRoom}
									onChange={handleRoomChange}
									activeClass="px-4 py-2 rounded-full text-xs md:text-sm font-medium transition-all shrink-0 cursor-pointer bg-[#1d1d1f] text-white shadow-sm"
									idleClass="px-4 py-2 rounded-full text-xs md:text-sm font-medium transition-all shrink-0 cursor-pointer bg-white border border-[#e5e5e7] text-[#6e6e73] hover:border-[#1d1d1f] hover:text-[#1d1d1f]"
								/>
							</div>

							{availableZones.length > 0 && (
								<div className="spaces-filter-row">
									<span className="spaces-filter-label">Зона</span>
									<FilterChipGroup
										label="Зона в комнате"
										options={availableZones}
										value={selectedZone}
										onChange={(zone) => applyParams({ zone })}
										activeClass="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer bg-[#2d2d2d] text-white"
										idleClass="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer bg-[#f5f5f7] text-[#6e6e73] hover:text-[#1d1d1f]"
									/>
								</div>
							)}

							<div className="spaces-filter-row">
								<span className="spaces-filter-label">Стиль</span>
								<FilterChipGroup
									label="Стиль (коллекция)"
									options={[...SPACES_STYLES]}
									value={selectedStyle}
									onChange={(style) => applyParams({ style })}
									activeClass="px-3 py-1 rounded-md text-xs font-bold cursor-pointer transition-all bg-[#f5f5f7] text-[#1d1d1f] border border-[#d2d2d7]"
									idleClass="px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-all text-[#6e6e73] hover:text-[#1d1d1f]"
								/>
							</div>

							<div className="spaces-filter-row">
								<span className="spaces-filter-label">Фактура</span>
								<FilterChipGroup
									label="Фактура"
									options={[...SPACES_TEXTURES]}
									value={selectedTexture}
									onChange={(tex) => applyParams({ tex })}
									activeClass="px-3 py-1 rounded-md text-xs font-bold cursor-pointer transition-all bg-[#f5f5f7] text-[#1d1d1f] border border-[#d2d2d7]"
									idleClass="px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-all text-[#6e6e73] hover:text-[#1d1d1f]"
								/>
							</div>
						</div>
					</div>
				)}

				{filteredInteriors.length > 0 &&
					(selectedStyle !== "all" ||
						selectedTexture !== "all" ||
						selectedRoom !== "all" ||
						selectedZone !== "all_walls") && (
						<button
							type="button"
							className="spaces-tab"
							onClick={() =>
								applyParams({ style: null, tex: null, room: null, zone: null })
							}
						>
							Сбросить фильтры
						</button>
					)}

				{/* ─── Состояния: загрузка / ошибка / пусто / успех ([Р]) ─── */}
				{status === "loading" || cardsStatus === "loading" ? (
					<div className="spaces-grid">
						{[1, 2, 3, 4, 5, 6].map((i) => (
							<div
								key={i}
								className="bg-white rounded-3xl border border-[#e5e5e7] overflow-hidden"
							>
								<Skeleton.Image style={{ width: "100%", height: 240 }} active />
								<div className="p-6">
									<Skeleton active paragraph={{ rows: 2 }} />
								</div>
							</div>
						))}
					</div>
				) : status === "error" && cardsFailed ? (
					<div className="text-center py-24 bg-white rounded-3xl border border-dashed border-[#d2d2d7]">
						<p className="text-lg font-semibold text-[#1d1d1f] mb-2">
							Не удалось загрузить интерьеры
						</p>
						<p className="text-sm text-[#545B66] mb-6">
							Проверьте соединение и попробуйте ещё раз
						</p>
						<button
							type="button"
							onClick={() => {
								retry();
								retryCards();
							}}
							className={`${FOCUS_RING} px-6 py-2.5 rounded-full bg-[#1d1d1f] text-white text-xs font-semibold hover:bg-neutral-800 transition-all cursor-pointer inline-flex items-center gap-2`}
						>
							<ReloadOutlined /> Повторить
						</button>
					</div>
				) : useManagedCards ? (
					filteredCards.length === 0 ? (
						<div className="text-center py-24 bg-white rounded-3xl border border-dashed border-[#d2d2d7]">
							<p className="text-lg font-semibold text-[#1d1d1f] mb-2">
								В этой категории пока нет объектов
							</p>
							<p className="text-sm text-[#545B66] mb-6">
								Заполните карточку пространства для этой категории в админке
							</p>
						</div>
					) : (
						<div className="spaces-grid">
							{filteredCards.map((card) => {
								const variants = card.configurations ?? [card];
								const panelNames = [
									...new Set(
										variants.map((item) => item.subtitle).filter(Boolean),
									),
								];
								return (
									<article key={card.id} className="group spaces-card">
										<button
											type="button"
											className="spaces-photo"
											aria-label={`Открыть пространство: ${card.title}`}
											onClick={() => setDetailCard(card)}
										>
											<img
												src={imageSrc(card.image)}
												alt={card.title}
												loading="lazy"
											/>
										</button>
										<div className="spaces-card-copy">
											{card.projectAddress && (
												<p className="spaces-meta">{card.projectAddress}</p>
											)}
											<h3>
												<button
													type="button"
													className="space-detail-title-button"
													onClick={() => setDetailCard(card)}
												>
													{card.title || "Без названия"}
												</button>
											</h3>
											{panelNames.length > 0 && (
												<p className="spaces-meta">
													Панели: {panelNames.join(", ")}
												</p>
											)}
											{variants.length > 1 && (
												<p className="spaces-meta">
													{variants.length} вариантов панелей и материалов
												</p>
											)}
											<div className="spaces-card-bottom">
												{(card.price || card.area) && (
													<p className="spaces-price">
														{card.price}
														{card.area && <span>{card.area}</span>}
													</p>
												)}
											</div>
										</div>
									</article>
								);
							})}
						</div>
					)
				) : filteredInteriors.length === 0 ? (
					<div className="text-center py-24 bg-white rounded-3xl border border-dashed border-[#d2d2d7]">
						<p className="text-lg font-semibold text-[#1d1d1f] mb-2">
							В этой комбинации пока нет интерьеров
						</p>
						<p className="text-sm text-[#545B66] mb-6">
							Попробуйте сбросить дополнительные фильтры стиля или фактуры
						</p>
						<button
							type="button"
							onClick={() =>
								applyParams({ style: null, tex: null, room: null, zone: null })
							}
							className={`${FOCUS_RING} px-6 py-2.5 rounded-full bg-[#1d1d1f] text-white text-xs font-semibold hover:bg-neutral-800 transition-all cursor-pointer`}
						>
							Сбросить фильтры
						</button>
					</div>
				) : (
					<div className="spaces-grid">
						{filteredInteriors.map((item) => {
							const price = estimateSpacePrice(item.areaM2, item.panelSize);
							const photo = imageSrc(
								resolveSpacePhoto(textureImages, textureFamilyIndex, item) ||
									item.image,
							);
							return (
								<article key={item.id} className="group spaces-card">
									<button
										type="button"
										className="spaces-photo"
										onClick={() => openFittingModal(item)}
										aria-label={`Посмотреть интерьер: ${item.title}`}
									>
										<img src={photo} alt={item.title} loading="lazy" />
									</button>
									<div className="spaces-card-copy">
										<p className="spaces-meta">
											{item.roomTypeLabel} · {item.zoneLabel}
										</p>
										<h3>{item.title}</h3>
										<p className="spaces-meta">
											{item.styleLabel} · {item.textureLabel} ·{" "}
											{item.mode === "combined" ? "комбинация" : "моно"}
										</p>
										<div className="spaces-card-bottom">
											{price && (
												<p className="spaces-price">
													от {formatSpacePrice(price.total)}
													<span>Стена {item.areaM2} м²</span>
												</p>
											)}
											<div className="spaces-card-actions">
												<button
													type="button"
													className="spaces-primary"
													onClick={() => openFittingModal(item)}
												>
													<SwapOutlined /> Переодеть фактуры
												</button>
												{item.defaultPanelSlug && (
													<button
														type="button"
														className="spaces-link"
														aria-label={`Открыть панель ${item.defaultPanelName || ""} в каталоге`}
														onClick={() =>
															goToPanel(
																item.defaultPanelSlug!,
																item,
																item.textures[0]?.id,
															)
														}
													>
														<ArrowRightOutlined />
													</button>
												)}
											</div>
										</div>
									</div>
								</article>
							);
						})}
					</div>
				)}
			</section>

			{/* ─── Модалка «Переодевание фактур» (SPC-07, SPC-10) ─── */}
			{detailCard && (
				<SpaceDetailModal
					key={detailCard.id}
					card={detailCard}
					onClose={() => setDetailCard(null)}
					onChoosePanel={(target) => {
						const selected = (panelVariants.data ?? []).find(
							(item) => item.id === target.executionVariantId,
						);
						const selectedInterior = interiors?.find(
							(item) => item.id === target.projectId,
						);
						const familySlug = (
							target.panelFamily1 ||
							target.panelFamily2 ||
							""
						).replace(/-(?:300x300|300x600|600x600)$/, "");
						const binding =
							selectedInterior && selected
								? resolveCatalogBinding(
										selectedInterior as Parameters<
											typeof resolveCatalogBinding
										>[0],
										familySlug,
										selected.texture_id,
									)
								: undefined;
						const panelsById = new Map(
							(panels.data?.items ?? []).map((panel) => [panel.id, panel]),
						);
						const targetPanelId = target.panelFamily1 || target.panelFamily2;
						const variant = selected;
						const panel = variant
							? panelsById.get(variant.panel_id)
							: (panels.data?.items ?? []).find(
									(item) =>
										item.id === targetPanelId || item.slug === targetPanelId,
								);
						setDetailCard(null);
						if (!panel) {
							navigate("/catalog");
							return;
						}
						const query = new URLSearchParams();
						if (target.executionVariantId) {
							query.set("variantId", target.executionVariantId);
						}
						if (selectedInterior) query.set("interiorId", selectedInterior.id);
						if (binding) {
							query.set("finishGroupId", binding.groupId);
							query.set("finishImage", binding.finishImage);
						}
						navigate(`/catalog/${panel.id}${query.size ? `?${query}` : ""}`);
					}}
				/>
			)}
			{activeInterior && (
				<Modal
					open={!!activeInterior}
					onCancel={() => setActiveInterior(null)}
					footer={null}
					width={1200}
					className="spaces-fitting"
					aria-label={activeInterior.title}
					centered
					closable={false}
					styles={{
						body: {
							padding: 0,
							borderRadius: 24,
							overflow: "hidden",
							background: "#fff",
							color: "#1d1d1f",
						},
					}}
				>
					<div className="space-viewer">
						<section
							className="space-viewer-scene"
							aria-label="Просмотр сцены"
							onTouchStart={(e) => {
								touchStartX.current = e.touches[0]?.clientX ?? null;
							}}
							onTouchEnd={(e) => {
								const start = touchStartX.current;
								touchStartX.current = null;
								if (start === null) return;
								const delta = (e.changedTouches[0]?.clientX ?? start) - start;
								if (Math.abs(delta) >= 40) stepTexture(delta < 0 ? 1 : -1);
							}}
						>
							<img
								src={activeSceneImage}
								alt={
									activeAdminPhoto || activeRender
										? `${activeInterior.title} — ${activeInterior.textures[activeTextureIndex]?.name}`
										: `${activeInterior.title} — исходное фото`
								}
							/>
							<div className="space-scene-caption">
								<strong>
									{activeAdminPhoto || activeRender
										? "Выбранная отделка"
										: "Исходный интерьер"}
								</strong>
								<span>
									{activeAdminPhoto || activeRender
										? activeInterior.textures[activeTextureIndex]?.name
										: "Фотография до изменения параметров"}
								</span>
							</div>
						</section>
						<section
							className="space-viewer-options"
							aria-label="Настройки интерьера"
						>
							<header>
								<p className="space-eyebrow">
									{activeInterior.categoryLabel} ·{" "}
									{activeInterior.roomTypeLabel}
								</p>
								<h2>{activeInterior.title}</h2>
								<p className="space-description">
									{activeInterior.description}
								</p>
							</header>
							<section className="space-option-section">
								<h3>
									01 <span>Режим отделки</span>
								</h3>
								<div className="space-mode-group">
									<button
										type="button"
										aria-pressed={!isCombinedMode}
										onClick={() => setIsCombinedMode(false)}
									>
										Моно
									</button>
									<button
										type="button"
										aria-pressed={isCombinedMode}
										onClick={() => setIsCombinedMode(true)}
									>
										Комбинация
									</button>
								</div>
							</section>
							<section className="space-option-section">
								<h3>
									02 <span>Форма панели</span>
								</h3>
								<div className="space-panel-group">
									{activeInterior.relatedPanels.map((rp) => (
										<button
											type="button"
											key={rp.slug}
											aria-pressed={selectedPanelSlug === rp.slug}
											onClick={() => setSelectedPanelSlug(rp.slug)}
										>
											{rp.name}
										</button>
									))}
								</div>
							</section>
							<section className="space-option-section">
								<h3>
									03 <span>Фактура поверхности</span>
								</h3>
								<div
									className="space-texture-group"
									onKeyDown={handleModalKeyDown}
								>
									{activeInterior.textures.map((tex, idx) => (
										<button
											key={tex.id}
											type="button"
											aria-pressed={activeTextureIndex === idx}
											onClick={() => setActiveTextureIndex(idx)}
										>
											<span
												className="space-texture-swatch"
												aria-hidden="true"
												style={{ backgroundColor: tex.colorHex || "#888" }}
											/>
											<span>{tex.name}</span>
											{activeTextureIndex === idx && <CheckOutlined />}
										</button>
									))}
								</div>
							</section>
							<div className="space-render-notice" role="status">
								{activeAdminPhoto
									? "Показано фото этой отделки из админской вкладки «Изображения»."
									: activeRender
										? "Показана визуализация выбранного варианта в этой же сцене."
										: "Для выбранного сочетания ещё нет фото в админке. Показано исходное изображение интерьера; выбранные параметры отражены в схеме ниже."}
							</div>
							<details className="space-layout-details" open>
								<summary>Схема выбранной раскладки</summary>
								<WallLayoutPreview
									interior={activeInterior}
									textureIndex={activeTextureIndex}
									combined={isCombinedMode}
								/>
							</details>
							<footer className="space-viewer-footer">
								{activePrice && (
									<p className="space-viewer-price">
										от {formatSpacePrice(activePrice.total)}
										<span>
											Ориентир для стены {activeInterior.areaM2} м². Итог — в
											карточке панели.
										</span>
									</p>
								)}
								{!resolveCatalogBinding(
									activeInterior,
									selectedPanelSlug,
									activeInterior.textures[activeTextureIndex]?.id || "",
								) && (
									<p className="space-description">
										Точное исполнение не связано с товаром. В карточке его нужно
										будет выбрать отдельно.
									</p>
								)}
								<button
									type="button"
									className="space-viewer-primary"
									onClick={() => {
										const variantId =
											activeInterior.textures[activeTextureIndex]?.id;
										const slug =
											selectedPanelSlug || activeInterior.defaultPanelSlug;
										setActiveInterior(null);
										if (slug) goToPanel(slug, activeInterior, variantId);
										else navigate("/catalog");
									}}
								>
									Перейти в карточку панели →
								</button>
								<button
									type="button"
									className="space-viewer-secondary"
									onClick={() => {
										setActiveInterior(null);
										navigate("/configurator");
									}}
								>
									Примерить на свою стену в Конфигураторе
								</button>
							</footer>
						</section>
					</div>
				</Modal>
			)}
		</div>
	);
}
