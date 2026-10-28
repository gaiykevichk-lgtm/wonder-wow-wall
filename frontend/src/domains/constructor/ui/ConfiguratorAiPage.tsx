import React, { useEffect, useRef, useState } from "react";
import {
	App as AntApp,
	Button,
	Form,
	Input,
	InputNumber,
	Modal,
	Segmented,
	Select,
	Spin,
	Tag,
	Switch,
	Alert,
} from "antd";
import {
	CameraOutlined,
	CheckCircleOutlined,
	InfoCircleOutlined,
	RobotOutlined,
	SwapOutlined,
	ThunderboltOutlined,
	WarningOutlined,
} from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePersistedState } from "../../../shared/lib/usePersistedState";
import { PageMeta } from "../../../shared/ui/PageMeta";
import { useCartStore } from "../../order/model/cartStore";
import {
	createSession,
	DEFAULT_ANSWERS,
	generateProposals,
	getSession,
	stitchPanorama,
} from "../api/configuratorApi";
import type { DialogAnswers, Proposal, ZoneRect } from "../api/configuratorApi";

import { usePanels, useTextures, usePanelVariants } from "../../catalog/api/catalogApi";

const STEP_KEY = "www.configurator.step";
const SESSION_KEY = "www.configurator.session";
const INSTRUCTION_SEEN_KEY = "www.configurator.instructionSeen";

const STYLES = ["Современный", "Скандинавский", "Лофт", "Неоклассика"] as const;
const MATERIALS = [
	"Камень и дерево",
	"Только дерево",
	"Кожа и текстиль",
	"Металл и бетон",
] as const;

const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

// ─── Component ──────────────────────────────────────────────────────

export default function ConfiguratorAiPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const queryClient = useQueryClient();
	const addItem = useCartStore((s) => s.addItemWithQuantity);
	const { message } = AntApp.useApp();

	const [step, setStep] = usePersistedState<1 | 2 | 3>(STEP_KEY, 1);
	const [sessionId, setSessionId] = usePersistedState<string | null>(
		SESSION_KEY,
		null,
	);
	const [answers, setAnswers] = useState<DialogAnswers>(DEFAULT_ANSWERS);
	const [activeProposalIndex, setActiveProposalIndex] = useState(0);
	// Сгенерированные варианты держатся и в локальном стейте: кеш useQuery
	// может быть перезаписан рефетчем GET /sessions, и тогда шаг 3 остался бы
	// пустым экраном.
	const [generatedProposals, setGeneratedProposals] = useState<Proposal[] | null>(
		null,
	);
	// Auto-open instruction modal on first visit (CFG-02 [Р]). Lazy init
	// keeps the read out of the render body — localStorage is an external
	// store that doesn't change during this component's lifetime.
	const [instructionOpen, setInstructionOpen] = useState<boolean>(
		() => localStorage.getItem(INSTRUCTION_SEEN_KEY) === null,
	);

	// A session created on the home page is handed off once, not uploaded again.
	const importedSession = useRef<string | null>(null);
	useEffect(() => {
		const session = location.state?.uploadedSession;
		if (!session || typeof session.id !== "string" || typeof session.photo_url !== "string" || importedSession.current === session.id) return;
		importedSession.current = session.id;
		queryClient.setQueryData(["configurator", session.id], {
			id: session.id, photo_url: session.photo_url, answers: null, proposals: [],
		});
		// Synchronize the external Router handoff with the persisted session.
		setSessionId(session.id);
		setAnswers(DEFAULT_ANSWERS);
		setGeneratedProposals(null);
		setActiveProposalIndex(0);
		setStep(2);
		setInstructionOpen(false);
		localStorage.setItem(INSTRUCTION_SEEN_KEY, "1");
		navigate(location.pathname, { replace: true, state: null });
	// Persisted setters are intentionally excluded: recreated each render.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [location.state, location.pathname, navigate, queryClient]);

	// ─── Session query ────────────────────────────────────────────────
	const sessionQuery = useQuery({
		queryKey: ["configurator", sessionId],
		queryFn: () => getSession(sessionId!),
		enabled: !!sessionId,
	});

	// Hydrate answers from the server mirror once the session arrives.
	// We track the hydrated session id in a ref so the sync runs only on
	// the *first* load of a new session, avoiding cascading renders when
	// the user edits the form.
	const hydratedFor = useRef<string | null>(null);
	useEffect(() => {
		const remote = sessionQuery.data?.answers;
		const id = sessionQuery.data?.id;
		if (remote && id && hydratedFor.current !== id) {
			hydratedFor.current = id;
			setAnswers({ ...DEFAULT_ANSWERS, ...remote });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sessionQuery.data?.id]);

	// ─── Photo upload ─────────────────────────────────────────────────
	const uploadMut = useMutation({
		mutationFn: createSession,
		onSuccess: ({ id, photo_url }) => {
			setSessionId(id);
			localStorage.setItem(INSTRUCTION_SEEN_KEY, "1");
			setInstructionOpen(false);
			setStep(2);
			message.success("Фото стены загружено — подбираем варианты…");
			void photo_url;
		},
		onError: (err: Error) => {
			message.error(`Не удалось загрузить фото: ${err.message}`);
		},
	});

	// ─── Generate proposals ──────────────────────────────────────────
	// Отдельный PUT /sessions с answersMut убран: POST /proposals сам сохраняет
	// ответы (backend: session.answers = body.model_dump()), а его
	// invalidateQueries запускал рефетч GET, который приходил позже и затирал
	// proposals в кеше — шаг 3 рендерился пустым.
	const proposalsMut = useMutation({
		mutationFn: () => generateProposals(sessionId!, answers),
		onSuccess: (resp) => {
			setActiveProposalIndex(0);
			setStep(3);
			setGeneratedProposals(resp.proposals);
			queryClient.setQueryData(["configurator", sessionId], (prev: unknown) => {
				if (!prev || typeof prev !== "object") return prev;
				return { ...(prev as object), proposals: resp.proposals };
			});
			const failed = resp.proposals.filter(
				(p) => p.status === "visualization_failed",
			).length;
			if (failed > 0 && failed < resp.proposals.length) {
				message.warning(
					`Часть визуализаций не удалась (${failed} из ${resp.proposals.length})`,
				);
			} else if (failed === resp.proposals.length) {
				message.error("Не удалось сгенерировать превью — попробуйте позже");
			} else {
				message.success("Готово! Три варианта на вашем фото");
			}
		},
		onError: (err: Error) => {
			message.error(`Ошибка генерации: ${err.message}`);
		},
	});

	// ─── Panorama stitch ─────────────────────────────────────────────
	const stitchMut = useMutation({
		mutationFn: stitchPanorama,
		onSuccess: () => message.success("Панорама склеена"),
		onError: (err: Error) => {
			const code = (err as Error & { body?: { detail?: { code?: string } } })
				.body?.detail?.code;
			message.warning(
				code === "stitch_unavailable"
					? "Склейка временно недоступна — продолжите с одним фото"
					: `Не удалось склеить: ${err.message}`,
			);
		},
	});

	const onPhotosSelected = (files: File[]) => {
		if (!files.length) return;
		const tooBig = files.find((f) => f.size > MAX_PHOTO_BYTES);
		if (tooBig) {
			message.error(`Файл «${tooBig.name}» больше 20 МБ`);
			return;
		}
		const wrong = files.find((f) => !ALLOWED_MIME.includes(f.type));
		if (wrong) {
			message.error(
				`Формат «${wrong.type || "неизвестный"}» не поддерживается — нужен JPG/PNG/WebP`,
			);
			return;
		}
		if (files.length >= 2) {
			stitchMut.mutate(files);
			return;
		}
		uploadMut.mutate(files[0]);
	};

	const onSubmitDialog = () => {
		if (!sessionId) return;
		// Одна мутация вместо двух гонящихся: ответы уходят в теле POST /proposals.
		proposalsMut.mutate();
	};

	const onResetSession = () => {
		setSessionId(null);
		setAnswers(DEFAULT_ANSWERS);
		setActiveProposalIndex(0);
		setGeneratedProposals(null);
		setStep(1);
		localStorage.removeItem(INSTRUCTION_SEEN_KEY);
	};

	// Persisted step without a live session (phone killed the tab, backend
	// restarted, TTL expired) would render a blank page. Fall back to step 1
	// so the upload form is always reachable.
	const sessionUsable = !!sessionId && !sessionQuery.isError;
	const visibleStep: 1 | 2 | 3 = step > 1 && !sessionUsable ? 1 : step;

	// Локальный источник важнее кеша: он не может быть перезаписан рефетчем.
	const proposals = generatedProposals ?? sessionQuery.data?.proposals ?? null;

	return (
		<>
			<PageMeta
				title="Конфигуратор"
				description="Подберите панели под ваше фото стены"
			/>
			<div className="www-configurator">
				<Stepper step={visibleStep} />

				{visibleStep === 1 && (
					<StepUpload
						busy={uploadMut.isPending || stitchMut.isPending}
						onPhotos={onPhotosSelected}
						onOpenInstructions={() => setInstructionOpen(true)}
					/>
				)}

				{visibleStep >= 2 && !sessionQuery.data && sessionQuery.isLoading && (
					<div
						className="www-configurator-step-panel"
						style={{ textAlign: "center", padding: "64px 24px" }}
					>
						<Spin size="large" />
						<p style={{ marginTop: 16, color: "#6b7280", marginBottom: 0 }}>
							Загружаем данные сессии…
						</p>
					</div>
				)}

				{/* `>= 2` оставлял форму диалога на экране и на шаге 3: варианты
				    дописывались под неё, и страница выглядела сломанной. */}
				{visibleStep === 2 && sessionQuery.data && (
					<StepDialog
						photoUrl={sessionQuery.data.photo_url}
						answers={answers}
						setAnswers={setAnswers}
						busy={proposalsMut.isPending}
						onSubmit={onSubmitDialog}
						onZoneChange={(zone) =>
							setAnswers((a) => ({ ...a, zone, area_choice: "custom" }))
						}
					/>
				)}

				{visibleStep === 3 && proposals && (
					<StepProposals
						proposals={proposals}
						activeIndex={activeProposalIndex}
						onSelect={setActiveProposalIndex}
						onAddToCart={(p) => {
							if (!p.calc) return;
							addItem(
								{
									id: `cfg-${p.id}`,
									productId: p.id,
									name: `${p.texture_name} (${p.coverage})`,
									image: p.preview_url ?? "",
									price: p.calc.purchase_price,
									area: p.area_m2,
									color: "#FFFFFF",
									colorName: p.color_name,
									size: `${p.area_m2.toFixed(2)} м²`,
								},
								p.calc.boxes_count,
							);
							message.success("Добавлено в корзину");
							navigate("/checkout");
						}}
					/>
				)}

				<div className="www-configurator-footer">
					{visibleStep > 1 && (
						<Button onClick={() => setStep((visibleStep - 1) as 1 | 2 | 3)}>
							← Назад
						</Button>
					)}
					{sessionId && (
						<Button type="link" danger onClick={onResetSession}>
							Начать заново
						</Button>
					)}
				</div>

				<Modal
					open={instructionOpen}
					onCancel={() => {
						localStorage.setItem(INSTRUCTION_SEEN_KEY, "1");
						setInstructionOpen(false);
					}}
					footer={null}
					width={640}
					title={
						<span>
							<InfoCircleOutlined style={{ marginRight: 8 }} />
							Как сделать хорошее фото
						</span>
					}
				>
					<InstructionBody />
				</Modal>
			</div>
		</>
	);
}

// ─── Stepper ────────────────────────────────────────────────────────

function Stepper({ step }: { step: 1 | 2 | 3 }) {
	const items = [
		{ id: 1, label: "Фото стены", icon: <CameraOutlined /> },
		{ id: 2, label: "Диалог с ИИ-дизайнером", icon: <RobotOutlined /> },
		{ id: 3, label: "Варианты", icon: <ThunderboltOutlined /> },
	];
	return (
		<div className="www-configurator-stepper">
			{items.map((it) => (
				<div
					key={it.id}
					className={`www-configurator-step ${step === it.id ? "active" : step > it.id ? "done" : ""}`}
				>
					<span className="step-icon">
						{step > it.id ? <CheckCircleOutlined /> : it.icon}
					</span>
					<span className="step-label">{it.label}</span>
				</div>
			))}
		</div>
	);
}

// ─── Step 1: Upload ─────────────────────────────────────────────────

function StepUpload({
	busy,
	onPhotos,
	onOpenInstructions,
}: {
	busy: boolean;
	onPhotos: (files: File[]) => void;
	onOpenInstructions: () => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	return (
		<div className="www-configurator-step-panel">
			<h2>Загрузите фото вашей стены</h2>
			<p className="lead">
				JPG / PNG / WebP, до 20&nbsp;МБ. Можно прислать 2–6 фото — мы склеим
				панораму.
			</p>
			<div className="upload-card" onClick={() => inputRef.current?.click()}>
				<CameraOutlined className="upload-icon" />
				<p className="upload-title">Нажмите, чтобы выбрать файл</p>
				<p className="upload-hint">или перетащите сюда</p>
				<input
					ref={inputRef}
					type="file"
					accept={ALLOWED_MIME.join(",")}
					multiple
					hidden
					onChange={(e) => onPhotos(Array.from(e.target.files ?? []))}
				/>
			</div>
			<div className="upload-actions">
				<Button
					type="link"
					icon={<InfoCircleOutlined />}
					onClick={onOpenInstructions}
				>
					Памятка по съёмке
				</Button>
				{busy && <Tag color="processing">Обрабатываем…</Tag>}
			</div>
		</div>
	);
}

// ─── Step 2: Dialogue ───────────────────────────────────────────────

function StepDialog({
	photoUrl,
	answers,
	setAnswers,
	busy,
	onSubmit,
	onZoneChange,
}: {
	photoUrl: string;
	answers: DialogAnswers;
	setAnswers: React.Dispatch<React.SetStateAction<DialogAnswers>>;
	busy: boolean;
	onSubmit: () => void;
	onZoneChange: (zone: ZoneRect) => void;
}) {
	const panelsQuery = usePanels();
	const texturesQuery = useTextures();
	const variantsQuery = usePanelVariants();
	const variants = (variantsQuery.data ?? []).filter(v => v.is_active);
	const panels = (panelsQuery.data?.items ?? []).filter(p => p.is_active && variants.some(v => v.panel_id === p.id));
	const textures = (texturesQuery.data ?? []).filter(t => variants.some(v => v.panel_id === answers.panel_id && v.texture_id === t.id));
	const executions = variants.filter(v => v.panel_id === answers.panel_id && v.texture_id === answers.texture_id);
	const media = (path?: string) => !path ? "" : /^(https?:|data:|\/)/.test(path) ? path : `/uploads/${path}`;
	const label = (name: string, image?: string) => <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
		{image ? <img src={media(image)} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} /> : <span style={{ width: 32, height: 32, borderRadius: 6, background: "#f0f0f0" }} />}
		<span>{name}</span>
	</span>;
	return (
		<div className="www-configurator-step-panel two-col">
			<div className="dialog-photo">
				<img src={photoUrl} alt="Ваша стена" />
				{answers.area_choice === "custom" ? (
					<ZoneSelector
						onChange={onZoneChange}
						zone={answers.zone}
						onClear={() => setAnswers((a) => ({ ...a, zone: null }))}
					/>
				) : (
					<span className="dialog-photo-badge">Выделена вся стена</span>
				)}
			</div>
			<Form
				layout="vertical"
				className="dialog-form"
				// Ant Design вызывает onFinish(values), а не onFinish(event):
				// здесь `values` — пустой объект (ни одно поле не имеет `name`),
				// поэтому `values.preventDefault()` бросал TypeError и генерация
				// не запускалась никогда. Нативный submit формы и так отменяется
				// внутри @rc-component/form, так что preventDefault тут не нужен.
				onFinish={() => { if (!answers.pro_mode || (answers.panel_id && answers.texture_id && answers.variant_id)) onSubmit(); }}
			>
				<div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
					<Switch checked={!!answers.pro_mode} checkedChildren="PRO" unCheckedChildren="PRO" aria-label="Режим PRO" disabled={busy} onChange={value => setAnswers(a => ({ ...a, pro_mode: value, panel_id: null, texture_id: null, variant_id: null }))} />
				</div>
				<Form.Item label="Что выделяем">
					<Segmented
						value={answers.area_choice}
						onChange={(v) =>
							setAnswers((a) => ({
								...a,
								area_choice: v as "whole" | "custom",
								// Возврат к «всей стене» не должен оставлять висящий
								// фрагмент — иначе в расчёт уйдёт противоречивый ответ.
								zone: v === "whole" ? null : a.zone,
							}))
						}
						options={[
							{ label: "Вся стена", value: "whole" },
							{ label: "Только фрагмент", value: "custom" },
						]}
					/>
				</Form.Item>
				<div className="dialog-row">
					<Form.Item label="Ширина, м">
						<InputNumber
							min={0.3}
							max={30}
							step={0.1}
							value={answers.width_m}
							onChange={(v) =>
								setAnswers((a) => ({ ...a, width_m: Number(v) || 3.2 }))
							}
						/>
					</Form.Item>
					<Form.Item label="Высота, м">
						<InputNumber
							min={0.3}
							max={10}
							step={0.1}
							value={answers.height_m}
							onChange={(v) =>
								setAnswers((a) => ({ ...a, height_m: Number(v) || 2.7 }))
							}
						/>
					</Form.Item>
				</div>
				{!answers.pro_mode ? <>
				<Form.Item label="Стиль">
					<Select
						value={answers.style}
						onChange={(v) => setAnswers((a) => ({ ...a, style: v }))}
						options={STYLES.map((s) => ({ label: s, value: s }))}
					/>
				</Form.Item>
				<Form.Item label="Материал">
					<Select
						value={answers.material}
						onChange={(v) => setAnswers((a) => ({ ...a, material: v }))}
						options={MATERIALS.map((m) => ({ label: m, value: m }))}
					/>
				</Form.Item>
                </> : <>
                  {(panelsQuery.isError || texturesQuery.isError || variantsQuery.isError) && <Alert type="error" message="Не удалось загрузить каталог" />}
                  <Form.Item label="Базовая панель">
                    <Select aria-label="Базовая панель" placeholder="Выберите панель" loading={panelsQuery.isLoading || variantsQuery.isLoading} value={answers.panel_id ?? undefined} disabled={busy} onChange={id => setAnswers(a => ({ ...a, panel_id: id, texture_id: null, variant_id: null }))} options={panels.map(p => ({ value: p.id, label: label(p.name, p.form_preview_path || p.photo_path) }))} />
                  </Form.Item>
                  <Form.Item label="Текстура">
                    <Select aria-label="Текстура" placeholder="Выберите текстуру" value={answers.texture_id ?? undefined} disabled={busy || !answers.panel_id} onChange={id => setAnswers(a => ({ ...a, texture_id: id, variant_id: null }))} options={textures.map(t => ({ value: t.id, label: label(t.name, t.swatch_image) }))} />
                  </Form.Item>
                  <Form.Item label="Вариант исполнения">
                    <Select aria-label="Вариант исполнения" placeholder="Выберите исполнение" value={answers.variant_id ?? undefined} disabled={busy || !answers.texture_id} onChange={id => setAnswers(a => ({ ...a, variant_id: id }))} options={executions.map(v => ({ value: v.id, label: label(v.name || `${v.panel_name} · ${v.texture_name} · ${v.panel_size}`, v.design_image_paths?.[0] || v.image_paths[0]) }))} />
                  </Form.Item>
                </>}
				<Form.Item label="Пожелания (необязательно)">
					<Input.TextArea
						rows={3}
						value={answers.comment}
						onChange={(e) =>
							setAnswers((a) => ({ ...a, comment: e.target.value }))
						}
						placeholder="Например: тёплый уют, без бликов, чтобы было похоже на камень…"
					/>
				</Form.Item>
				<Button
					type="primary"
					htmlType="button"
					onClick={onSubmit}
					disabled={!!answers.pro_mode && (!answers.panel_id || !answers.texture_id || !answers.variant_id)}
					loading={busy}
					block
					size="large"
				>
					Подобрать варианты
				</Button>
			</Form>
		</div>
	);
}

// ─── Step 3: Proposals ──────────────────────────────────────────────

function StepProposals({
	proposals,
	activeIndex,
	onSelect,
	onAddToCart,
}: {
	proposals: Proposal[];
	activeIndex: number;
	onSelect: (i: number) => void;
	onAddToCart: (p: Proposal) => void;
}) {
	// Swipe navigation
	const touchRef = useRef<{ x: number; y: number } | null>(null);
	const onTouchStart = (e: React.TouchEvent) => {
		touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
	};
	const onTouchEnd = (e: React.TouchEvent) => {
		if (!touchRef.current) return;
		const dx = e.changedTouches[0].clientX - touchRef.current.x;
		if (Math.abs(dx) > 50) {
			const next = dx > 0 ? activeIndex - 1 : activeIndex + 1;
			if (next >= 0 && next < proposals.length) onSelect(next);
		}
		touchRef.current = null;
	};

	const active = proposals[activeIndex];
	return (
		<div className="www-configurator-step-panel">
			<div className="proposals-tabs">
				{proposals.map((p, i) => (
					<button
						key={p.id}
						className={`proposal-tab ${activeIndex === i ? "active" : ""}`}
						onClick={() => onSelect(i)}
					>
						Вариант {i + 1}: {p.texture_name}
					</button>
				))}
			</div>
			{active && (
				<div
					className="proposal-card"
					onTouchStart={onTouchStart}
					onTouchEnd={onTouchEnd}
				>
					<div className="proposal-image">
						{active.preview_url ? (
							<img src={active.preview_url} alt={active.texture_name} />
						) : (
							<div className="proposal-image-empty">
								<WarningOutlined />
								<p>Превью не получилось — но расчёт ниже верный</p>
							</div>
						)}
						<Tag
							color={active.status === "ready" ? "success" : "warning"}
							className="proposal-status"
						>
							{active.status === "ready" ? "Готово" : "Расчёт без визуализации"}
						</Tag>
					</div>
					<div className="proposal-meta">
						<h3>{active.texture_name}</h3>
						<p className="proposal-subtitle">
							{active.color_name} · {active.style}
						</p>
						<p className="proposal-coverage">{active.coverage}</p>
						<p className="proposal-reason">{active.reason}</p>
						{active.calc && (
							<div className="proposal-calc">
								<div>
									<strong>{active.calc.boxes_count}</strong> коробок
								</div>
								<div>
									<strong>{active.calc.panels_count}</strong> панелей
								</div>
								<div>
									<strong>{active.calc.actual_area.toFixed(2)}</strong> м²
								</div>
								<div className="proposal-price">
									<strong>
										{active.calc.purchase_price.toLocaleString("ru-RU")}
									</strong>{" "}
									₽
								</div>
							</div>
						)}
						<div className="proposal-actions">
							<Button
								type="primary"
								size="large"
								icon={<SwapOutlined />}
								onClick={() => onAddToCart(active)}
								disabled={!active.calc}
							>
								Заказать этот вариант
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

// ─── Zone selector — выделение фрагмента (Pointer Events) ───────────

/**
 * Обработчики намеренно pointer-, а не mouse-овые: `onMouseDown/Move/Up`
 * не покрывают касание, из-за чего на телефоне рамку нельзя было протянуть
 * физически. Pointer Events закрывают мышью, палец и стилус одним набором,
 * а `touch-action: none` в CSS не даёт скроллу перехватить жест.
 */
function ZoneSelector({
	onChange,
	zone,
	onClear,
}: {
	onChange: (zone: ZoneRect) => void;
	zone: ZoneRect | null;
	onClear: () => void;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const startRef = useRef<{ x: number; y: number } | null>(null);
	const dragRef = useRef<ZoneRect | null>(null);
	const [drag, setDragState] = useState<ZoneRect | null>(null);

	const setDrag = (value: ZoneRect | null) => {
		dragRef.current = value;
		setDragState(value);
	};

	/** Нормализация в 0..1 строго по боксу фото, с защитой от нулевой ширины. */
	const normalize = (clientX: number, clientY: number) => {
		const rect = ref.current?.getBoundingClientRect();
		if (!rect || !rect.width || !rect.height) return null;
		return {
			x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
			y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
		};
	};

	const onPointerDown = (e: React.PointerEvent) => {
		const point = normalize(e.clientX, e.clientY);
		if (!point) return;
		e.currentTarget.setPointerCapture?.(e.pointerId);
		startRef.current = point;
		setDrag({ x: point.x, y: point.y, w: 0, h: 0 });
	};

	const onPointerMove = (e: React.PointerEvent) => {
		const start = startRef.current;
		if (!start) return;
		const point = normalize(e.clientX, e.clientY);
		if (!point) return;
		setDrag({
			x: Math.min(start.x, point.x),
			y: Math.min(start.y, point.y),
			w: Math.abs(point.x - start.x),
			h: Math.abs(point.y - start.y),
		});
	};

	const finish = (e: React.PointerEvent) => {
		if (!startRef.current) return;
		startRef.current = null;
		e.currentTarget.releasePointerCapture?.(e.pointerId);
		const rect = dragRef.current;
		setDrag(null);
		// Случайный тап не должен молча «съедать» выборку.
		if (rect && rect.w > 0.05 && rect.h > 0.05) onChange(rect);
	};

	const shown = drag ?? zone;

	return (
		<div
			ref={ref}
			className="zone-selector"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={finish}
			onPointerCancel={finish}
		>
			{!shown && (
				<p className="zone-selector-hint">
					Зажмите и протяните рамку по стене — так ИИ увидит нужную область
				</p>
			)}
			{shown && shown.w > 0 && shown.h > 0 && (
				<div
					className={`zone-selector-rect${drag ? " is-dragging" : ""}`}
					style={{
						left: `${shown.x * 100}%`,
						top: `${shown.y * 100}%`,
						width: `${shown.w * 100}%`,
						height: `${shown.h * 100}%`,
					}}
				/>
			)}
			{zone && !drag && (
				<button
					type="button"
					className="zone-selector-clear"
					onPointerDown={(e) => e.stopPropagation()}
					onClick={(e) => {
						e.stopPropagation();
						onClear();
					}}
				>
					Сбросить выделение
				</button>
			)}
		</div>
	);
}

// ─── Instruction body — CFG-02 ──────────────────────────────────────

function InstructionBody() {
	return (
		<div className="instruction-body">
			<ul>
				<li>Снимайте при дневном свете, без вспышки.</li>
				<li>Держите камеру параллельно стене — иначе ИИ «увидит» трапецию.</li>
				<li>
					Уберите лишние предметы из кадра (рамки, провода, мебель вплотную).
				</li>
				<li>Формат: JPG / PNG / WebP, до 20&nbsp;МБ.</li>
				<li>Если стена длинная — пришлите 2–6 фото, мы склеим панораму.</li>
			</ul>
		</div>
	);
}
