// Sends the queued order e-mails (table public.order_emails) through the Brevo API:
//   'placed'  → confirmation to the customer + "new order" notice to the shop (admin_email())
//   'shipped' → tracking number to the customer
// The site calls it right after placing an order / marking one shipped. It takes no input and only
// sends what the database queued, so it is safe to expose without a login (verify_jwt = false).
//
// Secret: BREVO_API_KEY  (`npx supabase secrets set BREVO_API_KEY=...`)
// Optional: SHOP_SENDER_EMAIL (default noreply@tuhlensvyat.com), SITE_URL (default https://tuhlensvyat.com)

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SHOP_NAME = 'ТухленСвят';
const SENDER_EMAIL = Deno.env.get('SHOP_SENDER_EMAIL') ?? 'noreply@tuhlensvyat.com';
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://tuhlensvyat.com').replace(/\/$/, '');

type EmailJob = { id: number; order_id: number; kind: 'placed' | 'shipped' };
type Order = {
  id: number;
  number: string;
  user_id: string | null;
  customer_name: string;
  phone: string;
  email: string;
  delivery_type: 'office' | 'address' | 'pickup';
  courier: 'econt' | 'speedy' | null;
  office_code: string | null;
  address: string | null;
  city: string | null;
  note: string | null;
  subtotal: number;
  shipping_price: number | null;
  total: number;
  tracking_number: string | null;
};
type OrderItem = { name: string; item_num: string; condition: 'new' | 'used'; unit_price: number; quantity: number };
type Settings = { pickup_address: string | null; pickup_hours: string | null };
type Mail = { to: string; toName?: string; replyTo?: string; subject: string; html: string };

const COURIER = { econt: 'Еконт', speedy: 'Спиди' } as const;
const CONDITION = { new: 'Ново', used: 'Употребявано' } as const;
const money = new Intl.NumberFormat('bg-BG', { style: 'currency', currency: 'EUR' });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function trackingUrl(courier: Order['courier'], number: string): string | null {
  const n = encodeURIComponent(number);
  if (courier === 'econt') return `https://www.econt.com/services/track-shipment/${n}`;
  if (courier === 'speedy') return `https://www.speedy.bg/bg/track-shipment?shipmentNumber=${n}`;
  return null;
}

function deliveryText(order: Order, settings: Settings): string {
  if (order.delivery_type === 'pickup') {
    const place = settings.pickup_address ? `: ${settings.pickup_address}` : ' — адреса ще ви кажем при потвърждението';
    return `Взимане на място${place}${settings.pickup_hours ? ` (${settings.pickup_hours})` : ''}`;
  }
  const courier = order.courier ? COURIER[order.courier] : 'Куриер';
  return order.delivery_type === 'office'
    ? `${courier} — до офис ${order.office_code ?? ''}`
    : `${courier} — до адрес: ${order.address ?? ''}, ${order.city ?? ''}`;
}

function shippingText(order: Order): string {
  if (order.delivery_type === 'pickup') return 'безплатно';
  return order.shipping_price == null ? 'ще ви я кажем по телефона' : money.format(order.shipping_price);
}

// ---- HTML (same look as supabase/templates/*.html) ----

function layout(body: string): string {
  return `<!doctype html>
<html lang="bg">
  <body style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#16161d">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border-top:6px solid #d01012">
      <tr>
        <td style="padding:32px 32px 8px">
          <p style="margin:0 0 28px;font-size:24px;font-weight:800;letter-spacing:-0.5px">Тухлен<span style="color:#d01012">Свят</span></p>
          ${body}
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 28px">
          <p style="margin:0;padding-top:16px;border-top:1px solid #e4e4e7;font-size:12px;line-height:1.5;color:#a1a1aa">
            ${SHOP_NAME} · <a href="${SITE_URL}" style="color:#a1a1aa">${esc(SITE_URL.replace(/^https?:\/\//, ''))}</a> · наложен платеж с Еконт и Спиди
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const h1 = (text: string) => `<h1 style="margin:0 0 12px;font-size:21px;line-height:1.3">${text}</h1>`;
const p = (html: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46">${html}</p>`;
const small = (html: string) => `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#71717a">${html}</p>`;
const button = (href: string, label: string) =>
  `<p style="margin:8px 0 16px"><a href="${esc(href)}" style="display:inline-block;padding:14px 28px;background:#d01012;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;font-size:15px">${label}</a></p>`;

function infoTable(rows: [string, string][]): string {
  const cells = rows
    .map(
      ([label, value]) => `<tr>
        <td style="width:1%;padding:6px 16px 6px 0;font-size:14px;color:#71717a;vertical-align:top;white-space:nowrap">${label}</td>
        <td style="padding:6px 0;font-size:14px;color:#16161d;vertical-align:top">${value}</td>
      </tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%">${cells}</table>`;
}

function itemsTable(order: Order, items: OrderItem[]): string {
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:10px 8px 10px 0;border-bottom:1px solid #f4f4f5;font-size:14px;line-height:1.4">
          <b>${esc(i.name)}</b><br />
          <span style="font-size:12px;color:#71717a">${esc(i.item_num)} · ${CONDITION[i.condition]}</span>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #f4f4f5;font-size:14px;text-align:center;white-space:nowrap">× ${i.quantity}</td>
        <td style="padding:10px 0 10px 8px;border-bottom:1px solid #f4f4f5;font-size:14px;text-align:right;white-space:nowrap">${money.format(i.unit_price * i.quantity)}</td>
      </tr>`,
    )
    .join('');
  const sum = (label: string, value: string, bold = false) => `<tr>
      <td colspan="2" style="padding:6px 8px 0 0;font-size:14px;color:${bold ? '#16161d' : '#71717a'};${bold ? 'font-weight:700;' : ''}">${label}</td>
      <td style="padding:6px 0 0 8px;font-size:14px;text-align:right;white-space:nowrap;${bold ? 'font-weight:700;' : ''}">${value}</td>
    </tr>`;
  const shippingKnown = order.delivery_type === 'pickup' || order.shipping_price != null;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%">
      ${rows}
      ${sum('Продукти', money.format(order.subtotal))}
      ${sum('Доставка', esc(shippingText(order)))}
      ${sum(shippingKnown ? 'Общо за плащане' : 'Общо без доставката', money.format(order.total), true)}
    </table>`;
}

// ---- The three e-mails ----

function customerPlaced(order: Order, items: OrderItem[], settings: Settings, shopEmail: string): Mail {
  const pickup = order.delivery_type === 'pickup';
  const steps = [
    `Ще се свържем с вас на ${esc(order.phone)}, за да потвърдим поръчката${pickup ? '' : ' и цената на доставката'}.`,
    pickup
      ? 'Подготвяме поръчката и ви се обаждаме, когато е готова за взимане.'
      : 'Изпращаме пратката и ви пращаме номера на товарителницата по имейл.',
    pickup ? 'Идвате, преглеждате поръчката и плащате на място.' : 'Преглеждате пратката и плащате на куриера (наложен платеж).',
  ];
  const body = [
    h1(`Благодарим за поръчката, ${esc(order.customer_name.split(' ')[0])}!`),
    p(`Приехме поръчка <b>${esc(order.number)}</b>. Ето какво поръчахте:`),
    itemsTable(order, items),
    infoTable([
      ['Доставка', esc(deliveryText(order, settings))],
      ['Плащане', pickup ? 'В брой на място' : 'Наложен платеж при получаване'],
      ['Телефон', esc(order.phone)],
      ...(order.note ? ([['Бележка', esc(order.note)]] as [string, string][]) : []),
    ]),
    `<p style="margin:0 0 8px;font-size:15px;font-weight:700">Какво следва</p>`,
    `<ol style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.6;color:#3f3f46">${steps.map((s) => `<li style="margin-bottom:6px">${s}</li>`).join('')}</ol>`,
    order.user_id ? button(`${SITE_URL}/account`, 'Моите поръчки') : '',
    small(`Имате въпрос? Отговорете на този имейл или пишете на <a href="mailto:${esc(shopEmail)}" style="color:#71717a">${esc(shopEmail)}</a>.`),
  ];
  return {
    to: order.email,
    toName: order.customer_name,
    replyTo: shopEmail,
    subject: `Поръчка ${order.number} е приета — ${SHOP_NAME}`,
    html: layout(body.join('\n')),
  };
}

function shopPlaced(order: Order, items: OrderItem[], settings: Settings, shopEmail: string): Mail {
  const body = [
    h1(`Нова поръчка ${esc(order.number)}`),
    infoTable([
      ['Клиент', esc(order.customer_name)],
      ['Телефон', `<a href="tel:${esc(order.phone)}" style="color:#d01012;font-weight:700">${esc(order.phone)}</a>`],
      ['Имейл', `<a href="mailto:${esc(order.email)}" style="color:#16161d">${esc(order.email)}</a>`],
      ['Доставка', esc(deliveryText(order, settings))],
      ['Профил', order.user_id ? 'Регистриран клиент' : 'Без регистрация'],
      ...(order.note ? ([['Бележка', `<b>${esc(order.note)}</b>`]] as [string, string][]) : []),
    ]),
    itemsTable(order, items),
    button(`${SITE_URL}/admin/orders`, 'Към поръчките'),
    small(order.delivery_type === 'pickup' ? 'Взимане на място — обадете се на клиента за потвърждение.' : 'Обадете се на клиента, за да потвърдите поръчката и цената на доставката.'),
  ];
  return {
    to: shopEmail,
    replyTo: order.email,
    subject: `Нова поръчка ${order.number} — ${money.format(order.total)} — ${order.customer_name}`,
    html: layout(body.join('\n')),
  };
}

/** For pickup orders "shipped" means ready to collect */
function customerReadyForPickup(order: Order, items: OrderItem[], settings: Settings, shopEmail: string): Mail {
  const body = [
    h1('Поръчката ви е готова за взимане!'),
    p(`Поръчка <b>${esc(order.number)}</b> ви очаква.`),
    infoTable([
      ['Къде', esc(settings.pickup_address ?? 'ще ви кажем по телефона')],
      ...(settings.pickup_hours ? ([['Кога', esc(settings.pickup_hours)]] as [string, string][]) : []),
      ['За плащане', `<b>${money.format(order.total)}</b> в брой на място`],
    ]),
    p('Можете да прегледате поръчката, преди да платите.'),
    `<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.6;color:#3f3f46">${items
      .map((i) => `<li>${esc(i.name)} (${esc(i.item_num)})${i.quantity > 1 ? ` × ${i.quantity}` : ''}</li>`)
      .join('')}</ul>`,
    small(`Имате въпрос? Отговорете на този имейл или пишете на <a href="mailto:${esc(shopEmail)}" style="color:#71717a">${esc(shopEmail)}</a>.`),
  ];
  return {
    to: order.email,
    toName: order.customer_name,
    replyTo: shopEmail,
    subject: `Поръчка ${order.number} е готова за взимане — ${SHOP_NAME}`,
    html: layout(body.join('\n')),
  };
}

function customerShipped(order: Order, items: OrderItem[], settings: Settings, shopEmail: string): Mail {
  if (order.delivery_type === 'pickup') return customerReadyForPickup(order, items, settings, shopEmail);
  const courier = order.courier ? COURIER[order.courier] : 'куриер';
  const url = order.tracking_number ? trackingUrl(order.courier, order.tracking_number) : null;
  const body = [
    h1('Поръчката ви е на път!'),
    p(`Изпратихме поръчка <b>${esc(order.number)}</b> с ${esc(courier)}.`),
    order.tracking_number
      ? infoTable([
          ['Товарителница', `<b style="font-size:16px">${esc(order.tracking_number)}</b>`],
          ['Доставка', esc(deliveryText(order, settings))],
          ['За плащане', `<b>${money.format(order.total)}</b> при получаване`],
        ])
      : infoTable([
          ['Доставка', esc(deliveryText(order, settings))],
          ['За плащане', `<b>${money.format(order.total)}</b> при получаване`],
        ]),
    url ? button(url, 'Проследи пратката') : '',
    p(
      order.delivery_type === 'office'
        ? `${esc(courier)} ще ви уведоми, когато пратката пристигне в офиса. Можете да я прегледате, преди да платите.`
        : `Куриерът ще ви се обади преди доставката. Можете да прегледате пратката, преди да платите.`,
    ),
    `<p style="margin:0 0 8px;font-size:15px;font-weight:700">В пратката</p>`,
    `<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.6;color:#3f3f46">${items
      .map((i) => `<li>${esc(i.name)} (${esc(i.item_num)})${i.quantity > 1 ? ` × ${i.quantity}` : ''}</li>`)
      .join('')}</ul>`,
    small(`Имате въпрос? Отговорете на този имейл или пишете на <a href="mailto:${esc(shopEmail)}" style="color:#71717a">${esc(shopEmail)}</a>.`),
  ];
  return {
    to: order.email,
    toName: order.customer_name,
    replyTo: shopEmail,
    subject: `Поръчка ${order.number} е изпратена — ${SHOP_NAME}`,
    html: layout(body.join('\n')),
  };
}

// ---- Sending ----

async function send(apiKey: string, mail: Mail): Promise<void> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: SHOP_NAME, email: SENDER_EMAIL },
      to: [{ email: mail.to, ...(mail.toName ? { name: mail.toName } : {}) }],
      ...(mail.replyTo ? { replyTo: { email: mail.replyTo } } : {}),
      subject: mail.subject,
      htmlContent: mail.html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) return json({ error: 'BREVO_API_KEY is not set' }, 500);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: jobs, error: claimError } = await db.rpc('claim_order_emails');
  if (claimError) return json({ error: claimError.message }, 500);
  if (!jobs?.length) return json({ sent: 0, failed: 0 });

  const [{ data: shopEmail }, { data: settings }] = await Promise.all([
    db.rpc('admin_email'),
    db.from('shop_settings').select('pickup_address, pickup_hours').limit(1).maybeSingle(),
  ]);

  let sent = 0;
  let failed = 0;
  for (const job of jobs as EmailJob[]) {
    try {
      const [{ data: order, error: orderError }, { data: items, error: itemsError }] = await Promise.all([
        db.from('orders').select('*').eq('id', job.order_id).single(),
        db.from('order_items').select('name, item_num, condition, unit_price, quantity').eq('order_id', job.order_id).order('id'),
      ]);
      if (orderError || itemsError) throw new Error((orderError ?? itemsError)!.message);

      const args = [order as Order, (items ?? []) as OrderItem[], (settings ?? { pickup_address: null, pickup_hours: null }) as Settings, shopEmail as string] as const;
      const mails = job.kind === 'placed' ? [customerPlaced(...args), shopPlaced(...args)] : [customerShipped(...args)];
      // The customer's e-mail first: if it fails, the whole job is retried
      for (const mail of mails) await send(apiKey, mail);

      await db.from('order_emails').update({ sent_at: new Date().toISOString(), last_error: null }).eq('id', job.id);
      sent++;
    } catch (e) {
      failed++;
      const message = e instanceof Error ? e.message : String(e);
      console.error(`order e-mail ${job.id} (${job.kind}, order ${job.order_id}) failed:`, message);
      await db.from('order_emails').update({ claimed_at: null, last_error: message }).eq('id', job.id);
    }
  }
  return json({ sent, failed });
});
