/** WwwInDesignSection — статичный информационный блок для CatalogPanelPage.
 *
 * Показывает story-блок «Продуманная система» с тремя шагами выбора панели.
 *
 * Раньше здесь также рендерилась карточка визуализации выбранной фактуры
 * (VizInfoCard), но она дублировала блок «Сценарии в интерьере»: при выбранной
 * фактуре на странице появлялся лишний блок с картинкой. Теперь визуализация
 * фактуры подставляется прямо в блок «в интерьере» (panel-interiors через
 * useInteriorImages), а этот компонент всегда остаётся одним и тем же
 * story-блоком — новых блоков при выборе фактуры не появляется.
 */
interface WwwInDesignSectionProps {
	panel: {
		name: string;
		size_label: string;
	};
	textureGroups: Array<{ id: string; name: string }>;
	selectedTextureId?: string;
}

/**
 * Карточка с описанием «продуманной системы» — три шага выбора панели.
 */
function StoryFallback({
	panel,
	textureGroups,
}: {
	panel: { name: string; size_label: string };
	textureGroups: Array<{ id: string; name: string }>;
}) {
	return (
		<section className="panel-story-section">
			<p className="panel-eyebrow">Продуманная система</p>
			<h2>
				Одна основа.
				<br />
				Много вариантов интерьера.
			</h2>
			<div className="panel-story-grid">
				<article>
					<span>01</span>
					<h3>Выберите форму</h3>
					<p>
						{panel.name} — модуль {panel.size_label}, который удобно
						комбинировать на стене.
					</p>
				</article>
				<article>
					<span>02</span>
					<h3>Настройте поверхность</h3>
					<p>
						{textureGroups.map((group) => group.name).join(", ") || "Фактуры"} —
						доступные варианты для этой формы.
					</p>
				</article>
				<article>
					<span>03</span>
					<h3>Меняйте без ремонта</h3>
					<p>
						Магнитное крепление помогает обновить композицию без демонтажа всей
						системы.
					</p>
				</article>
			</div>
		</section>
	);
}

export default function WwwInDesignSection({
	panel,
	textureGroups,
}: WwwInDesignSectionProps) {
	return <StoryFallback panel={panel} textureGroups={textureGroups} />;
}
