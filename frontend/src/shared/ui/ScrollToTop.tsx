import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Starts every client-side route at the top of the document.
 * React Router keeps the previous scroll position by default, which is
 * especially noticeable when opening a product card from a long mobile list.
 */
export function ScrollToTop() {
	const { pathname } = useLocation();

	useLayoutEffect(() => {
		window.scrollTo({ top: 0, left: 0, behavior: "auto" });
	}, [pathname]);

	return null;
}
