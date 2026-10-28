import { Input, Button } from "antd";
import {
	SendOutlined,
	PhoneOutlined,
	MailOutlined,
	EnvironmentOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

export function ShopFooter() {
	return (
		<>
			<style>{`
				.shop-footer{background:#F5F5F5;color:#2D2D2D;padding:48px 24px 24px}
				.shop-footer-inner{max-width:1280px;margin:0 auto}
				.shop-footer-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:48px;margin-bottom:48px}
				.shop-footer-brand img{height:48px;margin-bottom:16px}
				.shop-footer-brand p{font-size:13px;color:#545B66;line-height:1.6;margin-bottom:20px}
				.shop-footer-socials{display:flex;gap:12px}
				.shop-footer-socials>div{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#545B66;cursor:pointer;transition:color .2s}
				.shop-footer-socials>div:hover{color:#2D2D2D}
				.shop-footer-col h4{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 16px;color:#2D2D2D}
				.shop-footer-col a{display:block;color:#424245;text-decoration:none;font-size:13px;margin-bottom:10px;transition:color .2s}
				.shop-footer-col a:hover{color:#2D2D2D}
				.shop-footer-contacts{display:flex;flex-direction:column;gap:12px}
				.shop-footer-contacts>div{display:flex;align-items:center;gap:10px;color:#545B66;font-size:13px}
				.shop-footer-newsletter p{font-size:13px;color:#545B66;margin:0 0 12px;line-height:1.5}
				.shop-footer-newsletter-form{display:flex;gap:8px}
				.shop-footer-bottom{border-top:1px solid #E5E7EB;padding-top:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
				.shop-footer-bottom>span{font-size:12px;color:#545B66}
				.shop-footer-bottom-links{display:flex;gap:24px}
				.shop-footer-bottom-links a,.shop-footer-bottom-links span{font-size:12px;color:#545B66;text-decoration:none;cursor:pointer}
				@media(max-width:640px){
					.shop-footer{padding:28px 14px 18px}
					.shop-footer-grid{grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px}
					.shop-footer-brand{grid-column:1 / -1}
					.shop-footer-brand img{height:36px;margin-bottom:10px}
					.shop-footer-brand p{font-size:12px;margin-bottom:10px;line-height:1.5}
					.shop-footer-socials{gap:8px}
					.shop-footer-col h4{font-size:11px;letter-spacing:.06em;margin:0 0 10px}
					/* padding keeps link tap targets ≥24px high on touch screens */
					.shop-footer-col a{font-size:13px;margin-bottom:2px;padding:4px 0}
					.shop-footer-contacts{gap:7px}
					.shop-footer-contacts>div{font-size:12px;gap:7px}
					.shop-footer-newsletter{grid-column:1 / -1;border-top:1px solid #E5E7EB;padding-top:14px;margin-top:4px}
					.shop-footer-newsletter h4{font-size:11px;margin:0 0 6px !important}
					.shop-footer-newsletter p{font-size:12px;margin:0 0 8px !important}
					.shop-footer-bottom{padding-top:10px;flex-direction:column;align-items:flex-start;gap:6px}
					.shop-footer-bottom>span{font-size:12px}
					.shop-footer-bottom-links{gap:14px;flex-wrap:wrap}
					.shop-footer-bottom-links a,.shop-footer-bottom-links span{font-size:12px;padding:4px 0;display:inline-block}
				}
			`}</style>
			<footer className="shop-footer">
				<div className="shop-footer-inner">
					<div className="shop-footer-grid">
						{/* Brand */}
						<div className="shop-footer-brand">
							<img src="/www_logo.svg" alt="Wonder Wow Wall" />
							<p>
								Инновационный сервис отделки стен модульными пластинами.
								100&nbsp;000+ вариантов дизайна.
							</p>
							<div className="shop-footer-socials">
								{["VK", "TG", "YT"].map((s) => (
									<div key={s}>{s}</div>
								))}
							</div>
						</div>

						{/* Navigation */}
						<div className="shop-footer-col">
							<h4>Навигация</h4>
							<Link to="/catalog">Каталог</Link>
							<Link to="/pricing">Тарифы</Link>
							<Link to="/about">О компании</Link>
							<Link to="/blog">Блог</Link>
							<Link to="/faq">FAQ</Link>
						</div>

						{/* Contacts */}
						<div className="shop-footer-col">
							<h4>Контакты</h4>
							<div className="shop-footer-contacts">
								<div>
									<PhoneOutlined /> +7 (800) 555-35-35
								</div>
								<div>
									<MailOutlined /> info@wonderwowwall.ru
								</div>
								<div>
									<EnvironmentOutlined /> Москва, ул. Дизайна, 1
								</div>
							</div>
						</div>

						{/* Newsletter */}
						<div className="shop-footer-newsletter">
							<h4>Подписка на новинки</h4>
							<p>Получайте информацию о новых дизайнах и акциях</p>
							<div className="shop-footer-newsletter-form">
								<Input
									placeholder="Ваш email"
									style={{
										background: "#fff",
										border: "1px solid #E5E7EB",
										color: "#2D2D2D",
										borderRadius: 8,
									}}
								/>
								<Button
									type="primary"
									icon={<SendOutlined />}
									style={{
										background: "#4CAF50",
										border: "none",
										borderRadius: 8,
									}}
								/>
							</div>
						</div>
					</div>

					{/* Bottom */}
					<div className="shop-footer-bottom">
						<span>© 2026 Wonder Wow Wall. Все права защищены.</span>
						<div className="shop-footer-bottom-links">
							<Link to="/privacy-policy">Политика конфиденциальности</Link>
							<span>Пользовательское соглашение</span>
						</div>
					</div>
				</div>
			</footer>
		</>
	);
}
