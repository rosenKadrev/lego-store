import { Database, Tables } from './database.types';

type Enums = Database['public']['Enums'];

export type ItemType = Enums['item_type'];
export type ItemCondition = Enums['item_condition'];
export type OrderStatus = Enums['order_status'];
export type DeliveryType = Enums['delivery_type'];
export type Courier = Enums['courier'];

export type Theme = Tables<'themes'>;
export type LegoSet = Tables<'sets'>;
export type Minifig = Tables<'minifigs'>;
export type Part = Tables<'parts'>;
export type Color = Tables<'colors'>;
export type PartCategory = Tables<'part_categories'>;
export type Listing = Tables<'listings'>;
export type ListingImage = Tables<'listing_images'>;
export type Profile = Tables<'profiles'>;
export type Order = Tables<'orders'>;
export type OrderItem = Tables<'order_items'>;
export type ShopSettings = Tables<'shop_settings'>;

/** Row of the `catalog_listings` view; columns of a view are nullable in generated types. */
export type CatalogListing = Tables<'catalog_listings'>;

export const SHOP_NAME = 'ТухленСвят';

/** Contact e-mail shown on the info pages (returns, complaints, privacy requests). */
export const SHOP_EMAIL = 'tuhlensvyat@gmail.com';

/** Contact phone shown in the footer, on the info pages and after an order (non-breaking spaces: never split across lines). */
export const SHOP_PHONE = { display: '0885 621 924', href: 'tel:+359885621924' };

/** The legal entity behind the shop (seller in the terms, data controller in the privacy policy). `vat` is '' when not VAT-registered. */
export const SHOP_COMPANY = {
  name: '„Чистач вредители“ ЕООД',
  eik: '203010585',
  vat: 'BG203010585',
  address: 'гр. София 1680, р-н Искър, жк. Дружба, бл. 410, вх. Б, ет. 1, ап. 33',
};

export const CONDITION_LABEL: Record<ItemCondition, string> = {
  new: 'Ново',
  used: 'Употребявано',
};

/** Short label for a new, sealed set whose box has cosmetic damage. */
export const BOX_DAMAGED_LABEL = 'Ударена кутия';

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  set: 'Сет',
  minifig: 'Минифигурка',
  part: 'Част',
  magazine: 'Списание',
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Нова',
  confirmed: 'Потвърдена',
  shipped: 'Изпратена',
  delivered: 'Доставена',
  paid: 'Платена',
  cancelled: 'Отказана',
  refused: 'Неприета пратка',
  returned: 'Върната',
};

export const DELIVERY_LABEL: Record<DeliveryType, string> = {
  office: 'до офис',
  address: 'до адрес',
  pickup: 'лично взимане',
};

export const COURIER_LABEL: Record<Courier, string> = {
  econt: 'Еконт',
  speedy: 'Спиди',
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * PostgREST `or` filter for a storefront search term: name, item number and — for a number —
 * the LEGO element ID printed in instructions (e.g. 6265148 → part 2569 in Black).
 * `term` must already be stripped of , ( ) * %.
 */
export function searchFilter(term: string): string {
  // name is Bulgarian when the set has a Bulgarian name; name_en keeps the original English one searchable
  const filters = [`name.ilike.*${term}*`, `name_en.ilike.*${term}*`, `item_num.ilike.${term}*`];
  if (/^\d{4,8}$/.test(term)) filters.push(`element_ids.cs.{${term}}`);
  return filters.join(',');
}

/** Magazines have no catalog number; their item_num is an internal 'M-<listing id>'. */
export function isMagazineNum(itemNum: string | null | undefined): boolean {
  return /^M-\d+$/.test(itemNum ?? '');
}

/** Rebrickable set numbers carry a '-1' variant suffix that buyers don't need to see; magazines show their kind. */
export function displayItemNum(itemNum: string | null | undefined): string {
  if (isMagazineNum(itemNum)) return ITEM_TYPE_LABEL.magazine;
  return (itemNum ?? '').replace(/-1$/, '');
}
