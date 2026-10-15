import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

/**
 * Per-page tags for search engines that run JavaScript (Google): the canonical URL and
 * schema.org data. Link-preview crawlers (Facebook, Viber) don't run it and see index.html's tags.
 */
@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly doc = inject(DOCUMENT);

  /** `null` removes it (pages without one fall back to their own URL) */
  setCanonical(url: string | null): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!url) {
      link?.remove();
      return;
    }
    if (!link) {
      link = this.doc.createElement('link');
      link.rel = 'canonical';
      this.doc.head.appendChild(link);
    }
    link.href = url;
  }

  /** One JSON-LD block per `id`; `null` removes it */
  setJsonLd(id: string, data: object | null): void {
    const existing = this.doc.getElementById(id);
    if (!data) {
      existing?.remove();
      return;
    }
    const script = existing ?? this.doc.createElement('script');
    script.id = id;
    script.setAttribute('type', 'application/ld+json');
    script.textContent = JSON.stringify(data);
    if (!existing) this.doc.head.appendChild(script);
  }
}
