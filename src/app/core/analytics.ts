import { effect, inject, Injectable, untracked } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConsentService } from './consent';

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[] };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export type TrackedItem = { id: number; name: string; price: number; quantity: number };

const CURRENCY = 'EUR';
/** First-party cookies the two tags set; removed when consent is withdrawn */
const AD_COOKIES = /^(_fbp|_fbc|_gcl_\w+|_ga\w*)$/;

/**
 * Meta Pixel + Google tag for ad conversions and remarketing. Nothing is loaded until the visitor
 * accepts the cookie banner ("basic" Consent Mode); before that every call here is a no-op.
 * Product ids sent are listing ids — a product feed for Merchant Center / Meta catalog must use the same ids.
 */
@Injectable({ providedIn: 'root' })
export class Analytics {
  private readonly consent = inject(ConsentService);
  private loaded = false;
  private lastPage: string | null = null;

  constructor() {
    if (!this.consent.needed) return;
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.pageView());
    effect(() => {
      const granted = this.consent.choice() === 'granted';
      untracked(() => {
        if (granted && !this.loaded) {
          this.load();
          this.pageView();
        } else if (!granted && this.loaded) {
          this.revoke();
        }
      });
    });
  }

  viewItem(item: Omit<TrackedItem, 'quantity'>): void {
    this.gtag('event', 'view_item', { currency: CURRENCY, value: item.price, items: [googleItem({ ...item, quantity: 1 })] });
    this.fbq('track', 'ViewContent', { ...metaContents([{ ...item, quantity: 1 }]), value: item.price, currency: CURRENCY });
  }

  addToCart(item: TrackedItem): void {
    const value = round2(item.price * item.quantity);
    this.gtag('event', 'add_to_cart', { currency: CURRENCY, value, items: [googleItem(item)] });
    this.fbq('track', 'AddToCart', { ...metaContents([item]), value, currency: CURRENCY });
  }

  beginCheckout(items: TrackedItem[], value: number): void {
    this.gtag('event', 'begin_checkout', { currency: CURRENCY, value, items: items.map(googleItem) });
    this.fbq('track', 'InitiateCheckout', { ...metaContents(items), value, currency: CURRENCY });
  }

  /** `value` is the products only — courier shipping is priced later by phone */
  purchase(orderNumber: string, items: TrackedItem[], value: number): void {
    this.gtag('event', 'purchase', { transaction_id: orderNumber, currency: CURRENCY, value, items: items.map(googleItem) });
    if (environment.googleAdsPurchase) {
      this.gtag('event', 'conversion', {
        send_to: environment.googleAdsPurchase,
        transaction_id: orderNumber,
        currency: CURRENCY,
        value,
      });
    }
    // eventID lets Meta drop duplicates if the Conversions API is added later
    this.fbq('track', 'Purchase', { ...metaContents(items), value, currency: CURRENCY }, { eventID: orderNumber });
  }

  private pageView(): void {
    if (!this.loaded) return;
    const page = location.pathname + location.search;
    if (page === this.lastPage) return;
    this.lastPage = page;
    this.gtag('event', 'page_view', { page_location: location.href });
    this.fbq('track', 'PageView');
  }

  private load(): void {
    this.loaded = true;
    const { googleTagId, metaPixelId } = environment;
    if (googleTagId) {
      window.dataLayer = window.dataLayer ?? [];
      // gtag.js expects the `arguments` object itself, not an array
      window.gtag = function () {
        window.dataLayer!.push(arguments);
      };
      const granted = 'granted';
      window.gtag('consent', 'default', {
        ad_storage: granted,
        ad_user_data: granted,
        ad_personalization: granted,
        analytics_storage: granted,
      });
      window.gtag('js', new Date());
      // Page views are sent by hand on every route change (single-page app)
      window.gtag('config', googleTagId, { send_page_view: false });
      addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleTagId)}`);
    }
    if (metaPixelId) {
      // Meta's standard loader stub: queues calls until fbevents.js arrives
      const fbq = function () {
        if (fbq.callMethod) fbq.callMethod(...arguments);
        else fbq.queue.push(arguments);
      } as Fbq & { push?: Fbq; loaded?: boolean; version?: string };
      fbq.queue = [];
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      window.fbq = window._fbq = fbq;
      window.fbq('init', metaPixelId);
      addScript('https://connect.facebook.net/en_US/fbevents.js');
    }
  }

  /** Consent withdrawn: tell both tags, delete their cookies and reload so the scripts are gone */
  private revoke(): void {
    const denied = 'denied';
    this.gtag('consent', 'update', {
      ad_storage: denied,
      ad_user_data: denied,
      ad_personalization: denied,
      analytics_storage: denied,
    });
    this.fbq('consent', 'revoke');
    const host = location.hostname;
    const domains = ['', host, `.${host.split('.').slice(-2).join('.')}`];
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0].trim();
      if (!AD_COOKIES.test(name)) continue;
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`;
      }
    }
    location.reload();
  }

  private gtag(...args: unknown[]): void {
    if (this.loaded) window.gtag?.(...args);
  }

  private fbq(...args: unknown[]): void {
    if (this.loaded) window.fbq?.(...args);
  }
}

function addScript(src: string): void {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function googleItem(item: TrackedItem) {
  return {
    id: String(item.id),
    item_id: String(item.id),
    item_name: item.name,
    price: item.price,
    quantity: item.quantity,
    google_business_vertical: 'retail',
  };
}

function metaContents(items: TrackedItem[]) {
  return {
    content_type: 'product',
    content_ids: items.map((i) => String(i.id)),
    contents: items.map((i) => ({ id: String(i.id), quantity: i.quantity })),
    num_items: items.reduce((n, i) => n + i.quantity, 0),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
