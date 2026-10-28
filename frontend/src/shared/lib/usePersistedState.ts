import { useState, useEffect } from "react";

/**
 * Сохраняет состояние в localStorage. При первом рендере подставляет
 * сохранённое значение, далее синхронизирует каждое изменение.
 * Не падает при недоступности storage (SSR, инкогнито, квоты).
 */
export function usePersistedState<T>(
	key: string,
	initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
	const [value, setValue] = useState<T>(() => {
		if (typeof window === "undefined") return initial;
		try {
			const raw = window.localStorage.getItem(key);
			if (raw === null) return initial;
			return JSON.parse(raw) as T;
		} catch {
			return initial;
		}
	});

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			window.localStorage.setItem(key, JSON.stringify(value));
		} catch {
			// ignore quota / privacy mode
		}
	}, [key, value]);

	return [value, setValue];
}
