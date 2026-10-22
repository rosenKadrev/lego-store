import { COURIER_LABEL, displayItemNum, SHOP_COMPANY, SHOP_NAME } from '../core/models';
import { AdminOrder } from './admin-orders.store';

const money = new Intl.NumberFormat('bg-BG', { style: 'currency', currency: 'EUR' });

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/**
 * The document the customer gets for every sale paid by наложен платеж through a postal money transfer
 * (Наредба Н-18, чл. 3, ал. 1 — at least the data under чл. 26, ал. 1, т. 1, 4, 7 и 8: seller name, address
 * and ЕИК; goods with quantity and value; total; payment method). Not a фискален бон and not a фактура.
 * Opens in a new tab and starts printing — print it for the parcel or "Save as PDF" to e-mail it.
 */
export function printSaleDocument(order: AdminOrder): void {
  const pickup = order.delivery_type === 'pickup';
  const payment = pickup
    ? 'Лично взимане'
    : `Наложен платеж чрез пощенски паричен превод${order.courier ? ` (${COURIER_LABEL[order.courier]})` : ''}`;
  const rows = order.order_items
    .map(
      (item, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(item.name)} <span class="muted">(${esc(displayItemNum(item.item_num))}, ${item.condition === 'new' ? 'ново' : 'употребявано'})</span></td>
        <td class="num">${item.quantity} бр.</td>
        <td class="num">${money.format(item.unit_price)}</td>
        <td class="num">${money.format(item.unit_price * item.quantity)}</td>
      </tr>`,
    )
    .join('');
  // The customer pays shipping straight to the courier — not part of this sale, only mentioned below the total
  const shipping = !pickup && order.shipping_price ? `<p>Доставката (${money.format(order.shipping_price)}) се заплаща отделно на куриера и не е включена в документа.</p>` : '';
  const vatNote = SHOP_COMPANY.vat
    ? `ДДС номер: ${esc(SHOP_COMPANY.vat)}`
    : 'Търговецът не е регистриран по ЗДДС — в цените не е начислен ДДС.';

  const html = `<!doctype html>
<html lang="bg">
<head>
<meta charset="utf-8" />
<title>Документ за продажба ${esc(order.number)}</title>
<style>
  body { font: 13px/1.45 system-ui, sans-serif; color: #111; max-width: 760px; margin: 32px auto; padding: 0 16px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .muted { color: #666; }
  .parties { display: flex; gap: 32px; margin: 20px 0; }
  .parties > div { flex: 1; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #666; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: left; vertical-align: top; }
  th { font-size: 12px; color: #666; }
  .num { text-align: right; white-space: nowrap; }
  .total td { font-weight: 700; border-bottom: 0; font-size: 15px; }
  .foot { margin-top: 24px; font-size: 12px; }
  @media print { body { margin: 0 auto; } }
</style>
</head>
<body>
  <h1>Документ за продажба № ${esc(order.number)}</h1>
  <p class="muted">Дата на издаване: ${new Date().toLocaleDateString('bg-BG')} · Поръчка от ${new Date(order.created_at).toLocaleDateString('bg-BG')}</p>

  <div class="parties">
    <div>
      <h2>Търговец</h2>
      <b>${esc(SHOP_COMPANY.name)}</b><br />
      ЕИК: ${esc(SHOP_COMPANY.eik)}<br />
      Адрес: ${esc(SHOP_COMPANY.address)}<br />
      Онлайн магазин: ${esc(SHOP_NAME)} — tuhlensvyat.com
    </div>
    <div>
      <h2>Купувач</h2>
      <b>${esc(order.customer_name)}</b><br />
      ${pickup ? 'Лично взимане' : esc([order.city, order.delivery_type === 'office' ? order.office_code : order.address].filter(Boolean).join(', '))}<br />
      Тел.: ${esc(order.phone)}
    </div>
  </div>

  <table>
    <thead><tr><th>№</th><th>Стока</th><th class="num">Количество</th><th class="num">Ед. цена</th><th class="num">Стойност</th></tr></thead>
    <tbody>
      ${rows}
      <tr class="total"><td></td><td colspan="3">Обща сума за плащане</td><td class="num">${money.format(order.total)}</td></tr>
    </tbody>
  </table>

  <div class="foot">
    <p><b>Начин на плащане:</b> ${esc(payment)}${!pickup && order.tracking_number ? ` · Товарителница: ${esc(order.tracking_number)}` : ''}</p>
    ${shipping}
    <p>${vatNote}</p>
    ${pickup ? '' : '<p class="muted">Документът не е фискален бон. Издава се на основание чл. 3, ал. 1 от Наредба № Н-18 от 13.12.2006 г.</p>'}
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const tab = window.open('', '_blank');
  if (!tab) return void alert('Браузърът блокира новия раздел — разрешете изскачащите прозорци за сайта.');
  tab.document.write(html);
  tab.document.close();
}
