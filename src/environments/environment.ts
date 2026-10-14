// Production: the hosted Supabase project (the publishable key is meant for the browser)
export const environment = {
  production: true,
  supabaseUrl: 'https://wagtffhpvowbybhqpwfj.supabase.co',
  supabaseKey: 'sb_publishable_P-321mcpz1VPLRXQKU2FaQ_vwV-1TKe',
  /** Ad tracking — empty = off (no scripts, no cookie banner). See core/analytics.ts */
  metaPixelId: '',
  /** Google tag ID, e.g. 'AW-1234567890' */
  googleTagId: '',
  /** Google Ads purchase conversion, 'AW-1234567890/AbCdEfGh' (Google Ads → Goals → Conversions → Tag setup) */
  googleAdsPurchase: '',
};
