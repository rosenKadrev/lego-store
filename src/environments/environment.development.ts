// Local development: `npx supabase start` (Docker). Publishable key printed by `npx supabase status`.
export const environment = {
  production: false,
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  /** Ad tracking — keep empty locally so test orders don't reach the ad accounts. See core/analytics.ts */
  // TODO: dummy IDs so the cookie banner shows locally — set back to '' before testing real orders
  metaPixelId: '1234567890',
  /** Google tag ID, e.g. 'AW-1234567890' */
  googleTagId: 'AW-1234567890',
  /** Google Ads purchase conversion, 'AW-1234567890/AbCdEfGh' (Google Ads → Goals → Conversions → Tag setup) */
  googleAdsPurchase: '',
};
