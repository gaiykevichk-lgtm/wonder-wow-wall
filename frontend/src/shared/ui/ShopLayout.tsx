import { Outlet, useLocation } from "react-router-dom";
import { ShopHeader } from "./ShopHeader";
import { ShopFooter } from "./ShopFooter";
import { CartDrawer } from "./CartDrawer";
import { SubscriptionModal } from "./SubscriptionModal";
import { SupportFab } from "./SupportFab";
import { ScrollToTop } from "./ScrollToTop";

export function ShopLayout() {
	const location = useLocation();
	// На карточке товара (/catalog/:panelId) плавающая кнопка чата
	// перекрывает мобильную панель покупки — скрываем её там.
	const isPanelCard = /^\/catalog\/[^/]+/.test(location.pathname);

	return (
		<>
			<ScrollToTop />
			<ShopHeader />
			<main style={{ minHeight: "100vh" }}>
				<Outlet />
			</main>
			<ShopFooter />
			<CartDrawer />
			<SubscriptionModal />
			{!isPanelCard && <SupportFab />}
		</>
	);
}
