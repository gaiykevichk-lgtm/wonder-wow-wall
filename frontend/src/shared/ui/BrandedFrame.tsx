/**
 * BrandedFrame — Wonder Wow Wall corporate "certificate" frame.
 *
 * Replicates the print marketing frame the brand uses on collateral:
 * a thin double border (outer + inner with a small gap) and the WWW
 * logo embedded into the bottom-right of the inner border so the inner
 * line visually "breaks" around the logo.
 *
 * Where to use:
 *   - "Moment of pride" screens: order success, subscription success.
 *   - Showcase tiles: saved constructor / visualizer projects.
 *   - Certificate-like reports: admin dashboard hero.
 *
 * Where NOT to use:
 *   - Any dense list / table where the double border eats horizontal
 *     space and competes with row separators.
 *   - Mobile-first lists; on narrow viewports the two strokes read as
 *     "container outline" and the brand intent is lost.
 *
 * Two variants:
 *   - `compact` (default) — only the double border, no logo. Cheap,
 *     works for tiles and inline cards.
 *   - `full` — adds the logo + flanking tick marks. Reserve for hero /
 *     success states.
 *
 * Implementation note:
 *   Done with two nested `<div>`s carrying CSS borders, not SVG. This
 *   keeps the component compositional (any aspect ratio, any content),
 *   keeps strokes 1 device-pixel sharp on retina without dealing with
 *   `vector-effect: non-scaling-stroke`, and lets the inner-line break
 *   under the logo be implemented as a tiny absolutely-positioned plate
 *   with `background: bgColor` covering the line where it crosses.
 */

import type { ReactNode, CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";

const DEFAULT_TONE = "#2D2D2D";
const DEFAULT_BG = "#FFFFFF";

export interface BrandedFrameProps {
	variant?: "full" | "compact";
	tone?: string;
	bgColor?: string;
	padding?: number | string;
	gap?: number;
	strokeWidth?: number;
	borderRadius?: number;
	animate?: boolean;
	logoHeight?: number;
	className?: string;
	style?: CSSProperties;
	children?: ReactNode;
}

export const BrandedFrame: React.FC<BrandedFrameProps> = ({
	variant = "compact",
	tone = DEFAULT_TONE,
	bgColor = DEFAULT_BG,
	padding = 24,
	gap = 8,
	strokeWidth = 1,
	borderRadius = 0,
	animate = false,
	logoHeight = 56,
	className,
	style,
	children,
}) => {
	const reduced = useReducedMotion();
	const Outer = animate && !reduced ? motion.div : "div";
	const outerProps =
		animate && !reduced
			? {
					initial: { opacity: 0, scale: 0.985 },
					animate: { opacity: 1, scale: 1 },
					transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1.0] as const },
				}
			: {};

	const showLogo = variant === "full";
	const innerBR = Math.max(0, borderRadius - gap);

	return (
		<Outer
			{...outerProps}
			className={className}
			style={{
				border: `${strokeWidth}px solid ${tone}`,
				borderRadius,
				padding: gap,
				background: bgColor,
				...style,
			}}
		>
			<div
				style={{
					position: "relative",
					border: `${strokeWidth}px solid ${tone}`,
					borderRadius: innerBR,
					padding,
					background: bgColor,
				}}
			>
				{children}

				{showLogo && (
					<BrandLogoOverlay
						tone={tone}
						bgColor={bgColor}
						logoHeight={logoHeight}
						strokeWidth={strokeWidth}
					/>
				)}
			</div>
		</Outer>
	);
};

// ─── Logo overlay ─────────────────────────────────────────────────────────
//
// Sits flush against the inner border's bottom edge. The plate uses
// `background: bgColor` to mask the inner rule where the logo crosses
// it, recreating the "border breaks around the logo" detail from the
// printed asset. Two tick marks flank the logo on either side, also
// floating on the bottom border.

interface BrandLogoOverlayProps {
	tone: string;
	bgColor: string;
	logoHeight: number;
	strokeWidth: number;
}

const TICK_LEN = 18;
const LOGO_GUTTER = 12;

const BrandLogoOverlay: React.FC<BrandLogoOverlayProps> = ({
	tone,
	bgColor,
	logoHeight,
	strokeWidth,
}) => {
	// The plate sits flush against the inner border's bottom edge, with
	// its own bottom aligned to the rule (so the logo extends UP into the
	// frame, not hanging off below). The plate's `background: bgColor`
	// masks the rule under it; the two tick marks are 1-px line segments
	// anchored to the same y as the rule, extending its visual presence
	// on either side of the logo cut-out — matches the printed asset.
	return (
		<div
			aria-hidden="true"
			style={{
				position: "absolute",
				right: 28,
				bottom: 0,
				height: logoHeight,
				display: "flex",
				alignItems: "flex-end",
				gap: LOGO_GUTTER,
				pointerEvents: "none",
			}}
		>
			<span
				style={{
					height: strokeWidth,
					width: TICK_LEN,
					background: tone,
					display: "block",
					// Push the tick down by half its own height so its centre line
					// sits exactly on the inner border. With strokeWidth=1 this is
					// a no-op visually but keeps integer-pixel alignment for retina.
					marginBottom: 0,
				}}
			/>
			<span
				style={{
					background: bgColor,
					padding: "0 6px",
					display: "inline-flex",
					alignItems: "center",
					// Pull the plate up by `strokeWidth` so it covers the rule
					// beneath the logo (the rule lives at exactly bottom: 0).
					marginBottom: -strokeWidth,
				}}
			>
				<img
					src="/logo.png"
					alt=""
					style={{
						height: logoHeight,
						display: "block",
					}}
				/>
			</span>
			<span
				style={{
					height: strokeWidth,
					width: TICK_LEN,
					background: tone,
					display: "block",
				}}
			/>
		</div>
	);
};

export default BrandedFrame;
