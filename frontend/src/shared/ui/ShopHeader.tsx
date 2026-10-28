import { useState, useEffect, useRef } from "react";
import { Badge, Button, Drawer, Input, Tag, Tooltip, Dropdown } from "antd";
import type { MenuProps } from "antd";
import {
	ShoppingOutlined,
	HeartOutlined,
	UserOutlined,
	MenuOutlined,
	CloseOutlined,
	CrownOutlined,
	SearchOutlined,
	DownOutlined,
} from "@ant-design/icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCartStore } from "../../domains/order/model/cartStore";
import { useSubscriptionStore } from "../../domains/subscription/model/subscriptionStore";
import { useAuthStore } from "../../domains/auth/model/authStore";
import { useAccountStore } from "../../domains/account/model/accountStore";

const NAV_ITEMS = [
	{ path: "/catalog", label: "Каталог" },
	{ path: "/spaces", label: "Пространства" },
	{ path: "/configurator", label: "Конфигуратор" },
	{ path: "/pricing", label: "Подписка" },
	{ path: "/simple", label: "Просто" },
	{ path: "/professionals", label: "Профессионалам" },
];

const MOBILE_NAV_ITEMS = [
	...NAV_ITEMS,
	
	{ path: "/blog", label: "Блог" },
	{ path: "/about", label: "О нас" },
	{ path: "/contacts", label: "Контакты" },
	{ path: "/faq", label: "FAQ" },
];

const DESKTOP_EXTRA_ITEMS: MenuProps["items"] = [
	{ key: "/configurator", label: <Link to="/configurator">Конфигуратор</Link> },
	{ key: "/blog", label: <Link to="/blog">Блог</Link> },
	{ key: "/about", label: <Link to="/about">О нас</Link> },
	{ key: "/contacts", label: <Link to="/contacts">Контакты</Link> },
	{ key: "/faq", label: <Link to="/faq">FAQ</Link> },
];

export function ShopHeader() {
	const [, setScrolled] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchValue, setSearchValue] = useState("");
	const [hoveredMore, setHoveredMore] = useState(false);
	const moreRef = useRef<HTMLDivElement>(null);
	const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const location = useLocation();
	const navigate = useNavigate();
	const setCartOpen = useCartStore((s) => s.setOpen);
	const totalItems = useCartStore((s) => s.totalItems);
	const activePlan = useSubscriptionStore((s) => s.getActivePlan);
	const openSubModal = useSubscriptionStore((s) => s.openModal);
	const isAuth = useAuthStore((s) => s.isAuth);
	const user = useAuthStore((s) => s.user);
	const favoriteCount = useAccountStore((s) => s.favoriteIds.length);

	const handleSearch = () => {
		const q = searchValue.trim();
		if (q) {
			navigate(`/catalog?search=${encodeURIComponent(q)}`);
			setSearchOpen(false);
			setSearchValue("");
		}
	};

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 40);
		window.addEventListener("scroll", onScroll);
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const textColor = "#2D2D2D";

	// Check if current path matches any extra item
	const hasActiveExtra =
		DESKTOP_EXTRA_ITEMS?.some((item) => item?.key === location.pathname) ??
		false;

	return (
		<>
			<header
				style={{
					position: "fixed",
					top: 0,
					left: 0,
					right: 0,
					zIndex: 1000,
					background: "rgba(255,255,255,0.72)",
					backdropFilter: "saturate(180%) blur(20px)",
					WebkitBackdropFilter: "saturate(180%) blur(20px)",
					borderBottom: "1px solid rgba(0,0,0,0.04)",
					transition: "all 0.3s ease",
					padding: "0 24px",
				}}
			>
				<div
					style={{
						maxWidth: 1280,
						margin: "0 auto",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						height: 48,
					}}
				>
					{/* Logo */}
					<Link
						to="/"
						style={{
							display: "flex",
							alignItems: "center",
							gap: 10,
							textDecoration: "none",
							color: textColor,
							transition: "color 0.3s",
						}}
					>
						<img
							src="/www_logo.svg"
							alt="Wonder Wow Wall"
							style={{
								height: 36,
								transition: "filter 0.3s",
								background: "transparent",
							}}
						/>
					</Link>

					{/* Desktop Nav */}
					<nav
						style={{
							display: "flex",
							gap: 28,
							alignItems: "center",
						}}
						className="desktop-nav"
					>
						{NAV_ITEMS.map((item) => {
							const isActive = location.pathname === item.path;
							return (
								<Link
									key={item.path}
									to={item.path}
									style={{
										textDecoration: "none",
										fontSize: 12,
										fontWeight: isActive ? 600 : 400,
										color: "#2D2D2D",
										opacity: isActive ? 1 : 0.85,
										transition: "opacity 0.3s, color 0.2s",
										padding: "4px 0",
										borderBottom: isActive
											? "2px solid #4CAF50"
											: "2px solid transparent",
									}}
								>
									{item.label}
								</Link>
							);
						})}
						{/* More dropdown */}
						<div
							ref={moreRef}
							onMouseEnter={() => {
								if (hoverTimeoutRef.current)
									clearTimeout(hoverTimeoutRef.current);
								setHoveredMore(true);
							}}
							onMouseLeave={() => {
								hoverTimeoutRef.current = setTimeout(
									() => setHoveredMore(false),
									150,
								);
							}}
							style={{ position: "relative" }}
						>
							<button
								type="button"
								aria-expanded={hoveredMore}
								aria-haspopup="menu"
								aria-label="Ещё"
								onClick={() => setHoveredMore((open) => !open)}
								style={{
									background: "transparent", border: 0, cursor: "pointer", fontFamily: "inherit",
									textDecoration: "none",
									fontSize: 12,
									fontWeight: hasActiveExtra ? 600 : 400,
									color: "#2D2D2D",
									opacity: hasActiveExtra ? 1 : 0.85,
									transition: "opacity 0.3s",
									display: "flex",
									alignItems: "center",
									gap: 4,
									padding: "4px 0",
									borderBottom: hasActiveExtra
										? "2px solid #4CAF50"
										: "2px solid transparent",
								}}
							>
								Ещё
								<DownOutlined style={{ fontSize: 10 }} />
							</button>
							<Dropdown
								menu={{ items: DESKTOP_EXTRA_ITEMS }}
								open={hoveredMore}
								placement="bottomLeft"
								trigger={[]}
								getPopupContainer={() => moreRef.current || document.body}
							>
								<div
									style={{
										position: "absolute",
										top: "100%",
										left: 0,
										minWidth: 160,
									}}
								/>
							</Dropdown>
						</div>
					</nav>

					{/* Actions */}
					<div
						className="header-actions"
						style={{ display: "flex", alignItems: "center", gap: 8 }}
					>
						{activePlan() ? (
							<Tag
								icon={<CrownOutlined />}
								color="#2E7D32"
								style={{
									borderRadius: 16,
									fontWeight: 600,
									fontSize: 11,
									padding: "2px 10px",
									cursor: "pointer",
									margin: 0,
								}}
								onClick={() => openSubModal()}
							>
								{activePlan()!.name}
							</Tag>
						) : (
							<Button
								size="small"
								onClick={() => openSubModal()}
								className="sub-btn-desktop"
								style={{
									borderRadius: 16,
									border: "1px solid #2E7D32",
									color: "#2E7D32",
									background: "transparent",
									fontWeight: 600,
									fontSize: 12,
									transition: "all 0.3s",
								}}
							>
								Подписка
							</Button>
						)}
						{searchOpen ? (
							<Input
								size="small"
								placeholder="Поиск..."
								value={searchValue}
								onChange={(e) => setSearchValue(e.target.value)}
								onPressEnter={handleSearch}
								onBlur={() => {
									if (!searchValue) setSearchOpen(false);
								}}
								autoFocus
								style={{ width: 160, borderRadius: 16, fontSize: 12 }}
								suffix={
									<SearchOutlined
										style={{ color: "#6B7280", cursor: "pointer" }}
										onClick={handleSearch}
									/>
								}
							/>
						) : (
							<Button
								type="text"
								icon={<SearchOutlined style={{ fontSize: 18 }} />}
								onClick={() => setSearchOpen(true)}
								style={{ color: textColor, transition: "color 0.3s" }}
							/>
						)}
						<Badge count={favoriteCount} size="small" color="#4CAF50">
							<Button
								type="text"
								icon={<HeartOutlined style={{ fontSize: 18 }} />}
								onClick={() => {
									if (isAuth) navigate("/account/favorites");
									else navigate("/login?redirect=/account/favorites");
								}}
								style={{ color: textColor, transition: "color 0.3s" }}
							/>
						</Badge>
						<Badge count={totalItems()} size="small" color="#4CAF50">
							<Button
								type="text"
								icon={<ShoppingOutlined style={{ fontSize: 18 }} />}
								onClick={() => setCartOpen(true)}
								style={{ color: textColor, transition: "color 0.3s" }}
							/>
						</Badge>
						{isAuth ? (
							<Tooltip title={user?.name || "Кабинет"}>
								<Button
									type="text"
									onClick={() => navigate("/account")}
									style={{
										color: textColor,
										transition: "color 0.3s",
										display: "flex",
										alignItems: "center",
										gap: 4,
									}}
								>
									<UserOutlined style={{ fontSize: 18 }} />
								</Button>
							</Tooltip>
						) : (
							<Button
								type="text"
								icon={<UserOutlined style={{ fontSize: 18 }} />}
								onClick={() => navigate("/login")}
								style={{ color: textColor, transition: "color 0.3s" }}
							/>
						)}
						<Button
							type="text"
							icon={<MenuOutlined style={{ fontSize: 18 }} />}
							onClick={() => setMobileOpen(true)}
							style={{ color: textColor, display: "none" }}
							className="mobile-menu-btn"
						/>
					</div>
				</div>
			</header>

			{/* Mobile Drawer */}
			<Drawer
				title={
					<img
						src="/www_logo.svg"
						alt="Wonder Wow Wall"
						style={{ height: 44 }}
					/>
				}
				open={mobileOpen}
				onClose={() => setMobileOpen(false)}
				placement="right"
				styles={{ wrapper: { width: 300 } }}
				closeIcon={<CloseOutlined />}
			>
				<nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
					{MOBILE_NAV_ITEMS.map((item) => (
						<Link
							key={item.path}
							to={item.path}
							aria-disabled={item.path === "/showrooms"}
							onClick={(event) => { if (item.path === "/showrooms") event.preventDefault(); else setMobileOpen(false); }}
							style={{
								textDecoration: "none",
								fontSize: 15,
								fontWeight: location.pathname === item.path ? 600 : 400,
								color: location.pathname === item.path ? "#2E7D32" : "#2D2D2D",
								padding: "12px 16px",
								borderRadius: 8,
								background:
									location.pathname === item.path
										? "rgba(46,125,50,0.08)"
										: "transparent",
							}}
						>
							{item.label}
						</Link>
					))}
				</nav>
			</Drawer>

			<style>{`
				/* Touch-friendly icon buttons: keep ≥44px hit area on phones */
				@media (max-width: 768px) {
					.header-actions .ant-btn { min-width: 44px; min-height: 44px; }
					.desktop-nav { display: none !important; }
					.mobile-menu-btn { display: inline-flex !important; }
					.sub-btn-desktop { display: none !important; }
				}
				@media (max-width: 1024px) {
					.desktop-nav { display: none !important; }
					.mobile-menu-btn { display: inline-flex !important; }
				}
			`}</style>
		</>
	);
}
