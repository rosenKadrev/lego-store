import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Database } from './database.types';

export const LISTING_IMAGES_BUCKET = 'listing-images';

@Injectable({ providedIn: 'root' })
export class Supabase {
  readonly client: SupabaseClient<Database> = createClient<Database>(
    environment.supabaseUrl,
    environment.supabaseKey,
  );

  listingImageUrl(path: string): string {
    return this.client.storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  /** Own photo first (used items), otherwise the Rebrickable catalog image. */
  coverUrl(listing: { cover_path: string | null; catalog_img_url: string | null }): string | null {
    return listing.cover_path ? this.listingImageUrl(listing.cover_path) : listing.catalog_img_url;
  }
}
