/**
 * Mock API Server — возвращает мок-данные для frontend-разработки
 * Запускается на порту 8001 (proxy target)
 */

import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join } from "path";

const UPLOADS_DIR = join(__dirname, "..", "uploads");
const MIME_TYPES: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
};

// ─── Мок-данные каталога ────────────────────────────────────────────────────

const categories = [
	{ key: "all", label: "Все формы", image: "", count: 37 },
	{
		key: "cat-30x30",
		label: "30×30 см",
		image: "/uploads/forms/30x30/flat-s-01-front.png",
		count: 14,
	},
	{
		key: "cat-30x60",
		label: "30×60 см",
		image: "/uploads/forms/30x60/flat-m-01-front.png",
		count: 12,
	},
	{
		key: "cat-60x60",
		label: "60×60 см",
		image: "/uploads/forms/60x60/crel-l-03-front.png",
		count: 11,
	},
];

const designs = [
	{
		id: "wav-s-10",
		name: "Волна",
		category: "cat-30x30",
		categoryLabel: "30×30 см",
		style: "Модерн",
		material: "Пластик ABS",
		price: 1200,
		priceUnit: "/шт",
		image: "/uploads/forms/30x30/wav-s-10-front.png",
		previewImage: "/uploads/forms/30x30/wav-s-10-front.png",
		gallery: [],
		description:
			"Классическая волна — мягкие переливы поверхности, которые оживают в лучах бокового света.",
		specs: { Вес: "200 г", Материал: "ABS пластик", Покрытие: "Глянцевое" },
		colors: [],
		sizes: ["30×30", "30×60", "60×60"],
		rating: 4.9,
		reviews: 87,
		badge: "Новинка",
		inStock: true,
		room: ["Гостиная", "Спальня", "Кабинет"],
		usageExamples: [
			{
				room: "Гостиная",
				image:
					"https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&h=500&fit=crop",
				caption: "Волна в светлой гостиной",
			},
			{
				room: "Спальня",
				image:
					"https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&h=500&fit=crop",
				caption: "Акцентная стена в спальне",
			},
		],
	},
	{
		id: "flat-s-01",
		name: "Плоская",
		category: "cat-30x30",
		categoryLabel: "30×30 см",
		style: "Минимализм",
		material: "Пластик ABS",
		price: 1200,
		priceUnit: "/шт",
		image: "/uploads/forms/30x30/flat-s-01-front.png",
		previewImage: "/uploads/forms/30x30/flat-s-01-front.png",
		gallery: [],
		description: "Гладкая плоская панель — чистый холст для любой текстуры.",
		specs: { Вес: "180 г", Материал: "ABS пластик", Покрытие: "Матовый" },
		colors: [],
		sizes: ["30×30", "30×60", "60×60"],
		rating: 4.8,
		reviews: 64,
		badge: "Популярное",
		inStock: true,
		room: ["Гостиная", "Холл", "Офис"],
		usageExamples: [
			{
				room: "Холл",
				image:
					"https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&h=500&fit=crop",
				caption: "Минимализм в холле",
			},
			{
				room: "Офис",
				image:
					"https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=500&fit=crop",
				caption: "Панели в офисном пространстве",
			},
		],
	},
	{
		id: "crel-l-03",
		name: "Классический рельеф",
		category: "cat-60x60",
		categoryLabel: "60×60 см",
		style: "Классика",
		material: "Пластик ABS",
		price: 1200,
		priceUnit: "/шт",
		image: "/uploads/forms/60x60/crel-l-03-front.png",
		previewImage: "/uploads/forms/60x60/crel-l-03-front.png",
		gallery: [],
		description: "Традиционный филёнчатый рельеф большого формата.",
		specs: { Вес: "650 г", Материал: "ABS пластик", Покрытие: "Глянцевое" },
		colors: [],
		sizes: ["30×30", "30×60", "60×60"],
		rating: 4.9,
		reviews: 72,
		badge: "Популярное",
		inStock: true,
		room: ["Гостиная", "Спальня", "Ресторан"],
		usageExamples: [
			{
				room: "Гостиная",
				image:
					"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=500&fit=crop",
				caption: "Классика в просторной гостиной",
			},
			{
				room: "Ресторан",
				image:
					"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=500&fit=crop",
				caption: "Рельефная стена в ресторане",
			},
		],
	},
	{
		id: "kess-l-01",
		name: "Кессон",
		category: "cat-60x60",
		categoryLabel: "60×60 см",
		style: "Классика",
		material: "Пластик ABS",
		price: 1200,
		priceUnit: "/шт",
		image: "/uploads/forms/60x60/kess-l-01-front.png",
		previewImage: "/uploads/forms/60x60/kess-l-01-front.png",
		gallery: [],
		description: "Элегантный кессон для создания рельефной стены.",
		specs: { Вес: "600 г", Материал: "ABS пластик", Покрытие: "Глянцевое" },
		colors: [],
		sizes: ["30×30", "30×60", "60×60"],
		rating: 4.7,
		reviews: 45,
		badge: "",
		inStock: true,
		room: ["Гостиная", "Кабинет", "Ресторан"],
		usageExamples: [],
	},
	{
		id: "wav-m-01",
		name: "Волна средняя",
		category: "cat-30x60",
		categoryLabel: "30×60 см",
		style: "Модерн",
		material: "Пластик ABS",
		price: 1200,
		priceUnit: "/шт",
		image: "/uploads/forms/30x60/wav-m-01-front.png",
		previewImage: "/uploads/forms/30x60/wav-m-01-front.png",
		gallery: [],
		description: "Вытянутая волна для вертикальных композиций.",
		specs: { Вес: "380 г", Материал: "ABS пластик", Покрытие: "Глянцевое" },
		colors: [],
		sizes: ["30×30", "30×60", "60×60"],
		rating: 4.8,
		reviews: 52,
		badge: "",
		inStock: true,
		room: ["Гостиная", "Спальня"],
		usageExamples: [],
	},
	{
		id: "geo-l-01",
		name: "Геометрия",
		category: "cat-60x60",
		categoryLabel: "60×60 см",
		style: "Лофт",
		material: "Пластик ABS",
		price: 1200,
		priceUnit: "/шт",
		image: "/uploads/forms/60x60/geo-l-01-front.png",
		previewImage: "/uploads/forms/60x60/geo-l-01-front.png",
		gallery: [],
		description: "Современный геометрический паттерн.",
		specs: { Вес: "620 г", Материал: "ABS пластик", Покрытие: "Матовый" },
		colors: [],
		sizes: ["30×30", "30×60", "60×60"],
		rating: 4.6,
		reviews: 38,
		badge: "",
		inStock: true,
		room: ["Офис", "Холл"],
		usageExamples: [],
	},
];

const reviews = [
	{
		id: "cr-1",
		author: "Анна Смирнова",
		rating: 5,
		text: "Панели превзошли все ожидания! Установка прошла легко, результат потрясающий.",
		date: "2025-03-15",
	},
	{
		id: "cr-2",
		author: "Михаил Козлов",
		rating: 5,
		text: "Заказывал «Волну» для спальни. Качество отличное, рельеф именно такой, как на фото.",
		date: "2025-02-28",
	},
	{
		id: "cr-3",
		author: "Елена Новикова",
		rating: 4,
		text: "Красивые панели, хороший сервис. Доставка чуть задержалась, но результат стоит того.",
		date: "2025-04-03",
	},
];

const subscriptions = [
	{
		id: "sub-starter",
		name: "Starter",
		description: "Идеально для первых шагов в обновлении интерьера.",
		price: 4900,
		period: "месяц",
		panelLimit: 4,
		features: [
			"4 накладки в месяц",
			"Бесплатная доставка",
			"Рекомендации по стилю",
			"Доступ к архиву",
		],
		isPopular: false,
	},
	{
		id: "sub-premium",
		name: "Premium",
		description: "Для тех, кто любит частые обновления.",
		price: 9900,
		period: "месяц",
		panelLimit: 9,
		features: [
			"9 накладок в месяц",
			"Приоритетная доставка",
			"Персональный менеджер",
			"Ранний доступ к новинкам",
			"Скидка 15% на панели",
		],
		isPopular: true,
	},
	{
		id: "sub-elite",
		name: "Elite",
		description: "Максимум возможностей для безграничного творчества.",
		price: 19900,
		period: "месяц",
		panelLimit: 20,
		features: [
			"20 накладок в месяц",
			"Экспресс-доставка",
			"Персональный дизайнер",
			"Эксклюзивные коллекции",
			"Скидка 25% на панели",
			"Бесплатная замена",
		],
		isPopular: false,
	},
];

// ─── Помощник ответа ───────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
	return JSON.stringify(data);
}

// ─── Роутер ────────────────────────────────────────────────────────────────

const routes: Record<
	string,
	(path: string, body: unknown) => { data: unknown; status: number } | null
> = {
	// Каталог
	"GET /api/catalog/categories": () => ({
		data: { items: categories },
		status: 200,
	}),
	"GET /api/catalog/designs": (path) => {
		const url = new URL(path, "http://localhost");
		const category = url.searchParams.get("category");
		const search = url.searchParams.get("search")?.toLowerCase() || "";
		const limit = parseInt(url.searchParams.get("limit") || "20");

		let filtered = designs;
		if (category && category !== "all") {
			filtered = filtered.filter((d) => d.category === category);
		}
		if (search) {
			filtered = filtered.filter(
				(d) =>
					d.name.toLowerCase().includes(search) ||
					d.description.toLowerCase().includes(search),
			);
		}
		return {
			data: { items: filtered.slice(0, limit), total: filtered.length },
			status: 200,
		};
	},
	"GET /api/catalog/designs/:id": (path) => {
		const id = path.split("/").pop();
		const design = designs.find((d) => d.id === id);
		if (!design) return { data: { detail: "Design not found" }, status: 404 };
		return { data: design, status: 200 };
	},
	"GET /api/catalog/designs/:id/reviews": () => ({
		data: { items: reviews },
		status: 200,
	}),
	"GET /api/catalog/recommendations/:id": (path) => {
		const id = path.split("/").pop();
		const design = designs.find((d) => d.id === id);
		const recs = designs
			.filter((d) => d.id !== id && d.category === design?.category)
			.slice(0, 4);
		return { data: { items: recs }, status: 200 };
	},

	// Подписки
	"GET /api/subscriptions/plans": () => ({
		data: { items: subscriptions },
		status: 200,
	}),

	// Заказы
	"GET /api/orders": () => ({ data: { items: [] }, status: 200 }),
	"POST /api/orders": (path, body) => {
		const order = {
			id: `order-${Date.now()}`,
			...(body as object),
			status: "pending",
		};
		return { data: order, status: 201 };
	},

	// Визуализации
	"GET /api/visualizations": () => ({ data: { items: [] }, status: 200 }),
	"POST /api/visualizations": (path, body) => {
		const project = {
			id: `proj-${Date.now()}`,
			...(body as object),
			version: 1,
		};
		return { data: project, status: 201 };
	},

	// Пользователи
	"POST /api/auth/register": (path, body) => {
		const { email } = body as { email: string };
		return {
			data: {
				access_token: "mock-jwt-token-" + Date.now(),
				token_type: "bearer",
				user: { id: "user-1", email, name: "Тестовый Пользователь" },
			},
			status: 200,
		};
	},
	"POST /api/auth/login": (path, body) => {
		const { email } = body as { email: string };
		return {
			data: {
				access_token: "mock-jwt-token-" + Date.now(),
				token_type: "bearer",
				user: { id: "user-1", email, name: "Тестовый Пользователь" },
			},
			status: 200,
		};
	},
	"GET /api/auth/me": () => ({
		data: {
			id: "user-1",
			email: "test@example.com",
			name: "Тестовый Пользователь",
		},
		status: 200,
	}),
};

// ─── Сервер ────────────────────────────────────────────────────────────────

const PORT = 8001;

const server = createServer((req, res) => {
	// CORS заголовки
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, PATCH, DELETE, OPTIONS",
	);
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

	if (req.method === "OPTIONS") {
		res.writeHead(204);
		res.end();
		return;
	}

	const path = req.url?.split("?")[0] || "";
	const method = req.method || "GET";

	// Статические файлы из /uploads
	if (path.startsWith("/uploads/") && method === "GET") {
		const filePath = join(UPLOADS_DIR, path.replace("/uploads/", ""));
		if (existsSync(filePath)) {
			const ext = extname(filePath).toLowerCase();
			const mime = MIME_TYPES[ext] || "application/octet-stream";
			res.writeHead(200, { "Content-Type": mime });
			res.end(readFileSync(filePath));
			return;
		} else {
			res.writeHead(404);
			res.end("File not found");
			return;
		}
	}

	// Ищем подходящий роут
	let body = "";
	req.on("data", (chunk) => {
		body += chunk;
	});

	req.on("end", () => {
		let parsedBody: unknown = {};
		try {
			parsedBody = JSON.parse(body || "{}");
		} catch {
			/* ignore */
		}

		// Точный роут
		const routeKey = `${method} ${path}`;
		const handler = routes[routeKey];

		if (handler) {
			const result = handler(path, parsedBody);
			if (result) {
				res.writeHead(result.status, { "Content-Type": "application/json" });
				res.end(json(result.data));
				return;
			}
		}

		// Роут с параметрами (generic fallback)
		const entry = Object.entries(routes).find(([key]) => {
			if (!key.includes(":")) return false;
			const [m, routePath] = key.split(" ");
			if (m !== method) return false;
			const pattern = routePath.replace(/:[^/]+/g, "[^/]+");
			return new RegExp(`^${pattern}$`).test(path);
		});

		if (entry) {
			const result = entry[1](path, parsedBody);
			if (result) {
				res.writeHead(result.status, { "Content-Type": "application/json" });
				res.end(json(result.data));
				return;
			}
		}

		// Fallback: 404
		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(json({ detail: `Route not found: ${method} ${path}` }));
	});
});

server.listen(PORT, () => {
	console.log(`Mock API server running on http://localhost:${PORT}`);
});
