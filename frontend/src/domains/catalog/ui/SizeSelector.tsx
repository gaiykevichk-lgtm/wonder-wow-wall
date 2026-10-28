import { useCallback, useRef } from "react";
import {
	PANEL_SIZES,
	BASE_PANEL_PRICES,
	DESIGN_OVERLAY_PRICE,
} from "../../../shared/config/constants";

interface Props {
	activeSizeKey: string;
	onChange: (sizeKey: string) => void;
	designPrice?: number;
	showLabel?: boolean;
	compact?: boolean;
}

const sizeKeys = PANEL_SIZES.map((s) => `${s.width}x${s.height}`);

export default function SizeSelector({
	activeSizeKey,
	onChange,
	designPrice,
	showLabel = true,
	compact = false,
}: Props) {
	const groupRef = useRef<HTMLDivElement>(null);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			const idx = sizeKeys.indexOf(activeSizeKey);
			let next = idx;
			if (e.key === "ArrowRight" || e.key === "ArrowDown") {
				next = (idx + 1) % sizeKeys.length;
				e.preventDefault();
			} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
				next = (idx - 1 + sizeKeys.length) % sizeKeys.length;
				e.preventDefault();
			} else {
				return;
			}
			onChange(sizeKeys[next]);
			const el = groupRef.current?.querySelector(
				`[data-size-key="${sizeKeys[next]}"]`,
			) as HTMLElement | null;
			el?.focus();
		},
		[activeSizeKey, onChange],
	);

	return (
		<div>
			{showLabel ? (
				<div
					id="size-selector-label"
					style={{
						fontSize: 12,
						fontWeight: 600,
						color: "#6B7280",
						textTransform: "uppercase",
						letterSpacing: "0.08em",
						marginBottom: 12,
						textAlign: "center",
					}}
				>
					Размер
				</div>
			) : null}
			<div
				ref={groupRef}
				role="radiogroup"
				aria-labelledby={showLabel ? "size-selector-label" : undefined}
				aria-label={showLabel ? undefined : "Выбор размера"}
				onKeyDown={handleKeyDown}
				style={{
					display: "flex",
					justifyContent: "space-between",
					gap: 8,
					flexWrap: "wrap",
					width: "100%",
				}}
			>
				{PANEL_SIZES.map((s) => {
					const key = `${s.width}x${s.height}`;
					const active = key === activeSizeKey;
					const price =
						(BASE_PANEL_PRICES[key] ?? 0) +
						(designPrice ?? DESIGN_OVERLAY_PRICE);
					return (
						<button
							key={key}
							data-size-key={key}
							role="radio"
							aria-checked={active}
							aria-label={`${s.label}, ${price.toLocaleString("ru-RU")} рублей`}
							tabIndex={active ? 0 : -1}
							onClick={() => onChange(key)}
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
								gap: compact ? 1 : 2,
								padding: compact ? "6px 5px" : "8px 6px",
								borderRadius: compact ? 9 : 10,
								fontSize: 12,
								fontWeight: 600,
								cursor: "pointer",
								border: "1.5px solid",
								borderColor: active ? "#4CAF50" : "#D1D5DB",
								background: active ? "#4CAF50" : "#FFFFFF",
								color: active ? "#FFFFFF" : "#2D2D2D",
								transition: "all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)",
								flex: "1 1 0",
								minWidth: 0,
								textAlign: "center",
								whiteSpace: "nowrap",
							}}
						>
							<span>{s.label}</span>
							<span
								style={{
									fontSize: 10,
									fontWeight: 500,
									opacity: 0.85,
									whiteSpace: "nowrap",
								}}
							>
								{price.toLocaleString("ru-RU")} ₽
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
