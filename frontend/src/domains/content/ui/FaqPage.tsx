import React from 'react';
import { Collapse, Button } from 'antd';
import { QuestionCircleOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

// ─── Style constants ──────────────────────────────────────────────────────────

const BLUE = '#0071e3';
const DARK = '#1d1d1f';
const GRAY_TEXT = '#86868b';
const FONT = 'Inter, sans-serif';
const MAX_WIDTH: React.CSSProperties = { maxWidth: 1080, margin: '0 auto' };

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1.0], delay: i * 0.08 },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

// ─── Answer helper ────────────────────────────────────────────────────────────

const ans = (text: string) => (
  <p style={{ fontFamily: FONT, fontSize: 14, color: GRAY_TEXT, margin: 0, lineHeight: 1.75 }}>
    {text}
  </p>
);

// ─── FAQ categories ───────────────────────────────────────────────────────────

const categories: Array<{
  key: string;
  title: string;
  icon: React.ReactNode;
  items: Array<{ key: string; label: string; children: React.ReactNode }>;
}> = [
  {
    key: 'order',
    title: 'Заказ и доставка',
    icon: <QuestionCircleOutlined style={{ fontSize: 18, color: DARK }} />,
    items: [
      {
        key: 'order-1',
        label: 'Как оформить заказ?',
        children: ans(
          'Выберите панели в каталоге, добавьте их в корзину и нажмите «Оформить заказ». ' +
          'Заполните контактные данные, выберите способ доставки и оплаты. После подтверждения ' +
          'заказа мы свяжемся с вами для уточнения деталей в течение 2 часов.'
        ),
      },
      {
        key: 'order-2',
        label: 'Сколько времени занимает доставка?',
        children: ans(
          'По Москве и МО — 1–2 рабочих дня. По России транспортными компаниями — 3–7 рабочих дней ' +
          'в зависимости от региона. Точные сроки мы сообщим при подтверждении заказа. ' +
          'Крупные партии (от 50 м²) отгружаются по отдельному графику.'
        ),
      },
      {
        key: 'order-3',
        label: 'Можно ли отменить или изменить заказ?',
        children: ans(
          'Да, вы можете изменить или отменить заказ в течение 24 часов после оформления, ' +
          'связавшись с нами по телефону или email. Если панели уже переданы в производство ' +
          '(нестандартные размеры), отмена может быть невозможна.'
        ),
      },
      {
        key: 'order-4',
        label: 'Как отслеживать статус заказа?',
        children: ans(
          'После отправки заказа мы пришлём трек-номер на ваш email. Также вы можете уточнить ' +
          'статус у менеджера по телефону или в чате на сайте. В личном кабинете доступна ' +
          'история всех ваших заказов.'
        ),
      },
    ],
  },
  {
    key: 'mounting',
    title: 'Монтаж',
    icon: <QuestionCircleOutlined style={{ fontSize: 18, color: DARK }} />,
    items: [
      {
        key: 'mount-1',
        label: 'Могу ли я установить панели самостоятельно?',
        children: ans(
          'Большинство наших панелей рассчитаны на самостоятельный монтаж — в комплекте идёт ' +
          'подробная инструкция и все необходимые крепёжные элементы. Однако для получения ' +
          'гарантии на монтаж рекомендуем воспользоваться услугами наших сертифицированных мастеров.'
        ),
      },
      {
        key: 'mount-2',
        label: 'Нужна ли специальная подготовка стен перед монтажом?',
        children: ans(
          'Стены должны быть сухими, чистыми и ровными (перепад не более 5 мм на 2 м). ' +
          'Свежую штукатурку выдерживайте минимум 28 дней. Обои необходимо снять. ' +
          'Мастер при визите оценит состояние стен и при необходимости порекомендует подготовительные работы.'
        ),
      },
      {
        key: 'mount-3',
        label: 'Что делать, если панель повредилась при монтаже?',
        children: ans(
          'Позвоните нам или напишите на email, приложив фото повреждения. Если дефект возник ' +
          'по вине производства или нашего мастера, мы заменим панель бесплатно. ' +
          'При механическом повреждении сторонними лицами действуют стандартные условия продажи.'
        ),
      },
      {
        key: 'mount-4',
        label: 'Можно ли демонтировать панели без повреждения стен?',
        children: ans(
          'Да. Наша система клипс-крепления позволяет снять панели, не повредив ни их поверхность, ' +
          'ни стену. На стене могут остаться следы от крепёжных планок, которые легко закрасить. ' +
          'Это особенно удобно при переезде или смене дизайна.'
        ),
      },
    ],
  },
  {
    key: 'payment',
    title: 'Оплата',
    icon: <QuestionCircleOutlined style={{ fontSize: 18, color: DARK }} />,
    items: [
      {
        key: 'pay-1',
        label: 'Какие способы оплаты доступны?',
        children: ans(
          'Мы принимаем банковские карты (Visa, Mastercard, МИР), оплату через СБП, ' +
          'безналичный расчёт для юридических лиц, а также наличные при самовывозе или ' +
          'при оплате курьеру. Доступна рассрочка от 3 до 24 месяцев без переплат через банки-партнёры.'
        ),
      },
      {
        key: 'pay-2',
        label: 'Как оформить рассрочку?',
        children: ans(
          'В корзине выберите «Рассрочка» в качестве способа оплаты. Вам будет предложено ' +
          'оформить заявку через один из наших банков-партнёров (Тинькофф, Сбер, ВТБ). ' +
          'Одобрение занимает 2–5 минут. Минимальная сумма для рассрочки — 15 000 ₽.'
        ),
      },
      {
        key: 'pay-3',
        label: 'Выдаёте ли вы чек и закрывающие документы?',
        children: ans(
          'Да. Физическим лицам мы отправляем электронный чек на email сразу после оплаты. ' +
          'Юридическим лицам предоставляем полный комплект: счёт, акт, ТОРГ-12, УПД. ' +
          'Работаем с НДС и без НДС.'
        ),
      },
    ],
  },
  {
    key: 'subscription',
    title: 'Подписка',
    icon: <QuestionCircleOutlined style={{ fontSize: 18, color: DARK }} />,
    items: [
      {
        key: 'sub-1',
        label: 'Как работает подписка на обновление интерьера?',
        children: ans(
          'Каждый месяц вы выбираете новые панели в пределах квоты вашего тарифа. ' +
          'Мастер демонтирует старые панели и устанавливает новые. Снятые панели ' +
          'переходят к нам для восстановления и повторного использования — это экологично и экономично.'
        ),
      },
      {
        key: 'sub-2',
        label: 'Можно ли приостановить или отменить подписку?',
        children: ans(
          'Вы можете приостановить подписку на срок до 3 месяцев — квота перенесётся. ' +
          'Отменить подписку можно в личном кабинете не позднее чем за 5 дней до очередного списания. ' +
          'Возврат средств за текущий период не предусмотрен.'
        ),
      },
      {
        key: 'sub-3',
        label: 'Что входит в стоимость подписки?',
        children: ans(
          'В подписку входят: материалы (в рамках квоты), доставка, демонтаж старых и монтаж новых панелей. ' +
          'Если вы хотите панели сверх квоты — доплатите по стандартному прайсу. ' +
          'Дополнительные комнаты также оплачиваются отдельно.'
        ),
      },
      {
        key: 'sub-4',
        label: 'Можно ли перейти на другой тарифный план?',
        children: ans(
          'Да, вы можете повысить или понизить тариф в любой момент. Изменения вступят в силу ' +
          'со следующего расчётного периода. При переходе на более высокий тариф немедленный ' +
          'апгрейд квоты доступен за доплату разницы.'
        ),
      },
    ],
  },
];

// ─── FaqPage ──────────────────────────────────────────────────────────────────

const FaqPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: FONT, paddingTop: 72 }}>
      {/* Hero */}
      <section style={{ background: '#F5F5F7', padding: '120px 24px' }}>
        <div style={{ ...MAX_WIDTH, textAlign: 'center' }}>
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
          >
            <motion.div
              variants={fadeUp}
              custom={0}
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: DARK,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <QuestionCircleOutlined style={{ fontSize: 26, color: '#fff' }} />
            </motion.div>
            <motion.h1
              variants={fadeUp}
              custom={1}
              style={{
                fontFamily: FONT,
                fontSize: 'clamp(36px, 4vw, 52px)',
                fontWeight: 600,
                color: DARK,
                margin: 0,
                lineHeight: 1.15,
                letterSpacing: '-0.03em',
              }}
            >
              Часто задаваемые вопросы
            </motion.h1>
            <motion.p
              variants={fadeUp}
              custom={2}
              style={{
                fontFamily: FONT,
                fontSize: 17,
                color: GRAY_TEXT,
                margin: 0,
                maxWidth: 520,
                lineHeight: 1.65,
              }}
            >
              Найдите ответы на популярные вопросы о заказе, доставке, монтаже,
              оплате и подписке.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* FAQ categories */}
      <section style={{ background: '#fff', padding: '120px 24px' }}>
        <div style={{ ...MAX_WIDTH }}>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.05 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 48 }}
          >
            {categories.map((cat, catIdx) => (
              <motion.div
                key={cat.key}
                variants={fadeUp}
                custom={catIdx}
                style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
              >
                {/* Category header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: '#F5F5F7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {cat.icon}
                  </div>
                  <h2
                    style={{
                      fontFamily: FONT,
                      fontSize: 22,
                      fontWeight: 600,
                      color: DARK,
                      margin: 0,
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {cat.title}
                  </h2>
                </div>

                {/* Collapse */}
                <Collapse
                  items={cat.items}
                  style={{
                    borderRadius: 20,
                    border: '1px solid rgba(0,0,0,0.04)',
                    background: '#fff',
                    fontFamily: FONT,
                  }}
                  expandIconPosition="end"
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Contact CTA */}
      <section style={{ background: '#F5F5F7', padding: '0 24px 88px' }}>
        <div style={{ ...MAX_WIDTH }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1.0] }}
            style={{
              background: DARK,
              borderRadius: 20,
              padding: '56px 64px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontFamily: FONT,
                fontSize: 'clamp(24px, 3vw, 32px)',
                fontWeight: 600,
                color: '#fff',
                margin: 0,
                letterSpacing: '-0.03em',
              }}
            >
              Не нашли ответ?
            </h2>
            <p
              style={{
                fontFamily: FONT,
                fontSize: 16,
                color: 'rgba(255,255,255,0.65)',
                margin: 0,
                maxWidth: 480,
                lineHeight: 1.65,
              }}
            >
              Наши специалисты готовы ответить на любой вопрос — по телефону,
              email или в онлайн-чате на сайте.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
              <Button
                size="large"
                icon={<PhoneOutlined />}
                style={{
                  background: BLUE,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 980,
                  height: 52,
                  padding: '0 28px',
                  fontFamily: FONT,
                  fontWeight: 600,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                +7 (800) 555-35-35
              </Button>
              <Button
                size="large"
                icon={<MailOutlined />}
                onClick={() => navigate('/contacts')}
                style={{
                  background: 'transparent',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.35)',
                  borderRadius: 980,
                  height: 52,
                  padding: '0 28px',
                  fontFamily: FONT,
                  fontWeight: 600,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                Написать нам
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default FaqPage;
