
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "colors": {
                  Row: {
                    "id": number,"is_trans": boolean,"name": string,"rgb": string
                  }
                  Insert: {
                    "id": number,"is_trans"?: boolean,"name": string,"rgb": string
                  }
                  Update: {
                    "id"?: number,"is_trans"?: boolean,"name"?: string,"rgb"?: string
                  }
                  Relationships: [
                    
                  ]
                },"elements": {
                  Row: {
                    "color_id": number,"element_id": string,"part_num": string
                  }
                  Insert: {
                    "color_id": number,"element_id": string,"part_num": string
                  }
                  Update: {
                    "color_id"?: number,"element_id"?: string,"part_num"?: string
                  }
                  Relationships: [
                    
                  ]
                },"listing_images": {
                  Row: {
                    "id": number,"listing_id": number,"path": string,"sort_order": number
                  }
                  Insert: {
                    "id"?: never,"listing_id": number,"path": string,"sort_order"?: number
                  }
                  Update: {
                    "id"?: never,"listing_id"?: number,"path"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_images_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "catalog_listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_images_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    }
                  ]
                },"listings": {
                  Row: {
                    "color_id": number | null,"compare_at_price": number | null,"condition": Database["public"]['Enums']["item_condition"],"condition_notes": string | null,"created_at": string,"description": string | null,"fig_num": string | null,"has_box": boolean | null,"has_instructions": boolean | null,"id": number,"is_complete": boolean | null,"is_published": boolean,"item_type": Database["public"]['Enums']["item_type"],"minifigs_complete": boolean | null,"part_num": string | null,"price": number,"set_num": string | null,"stock": number,"updated_at": string
                  }
                  Insert: {
                    "color_id"?: number | null,"compare_at_price"?: number | null,"condition": Database["public"]['Enums']["item_condition"],"condition_notes"?: string | null,"created_at"?: string,"description"?: string | null,"fig_num"?: string | null,"has_box"?: boolean | null,"has_instructions"?: boolean | null,"id"?: never,"is_complete"?: boolean | null,"is_published"?: boolean,"item_type": Database["public"]['Enums']["item_type"],"minifigs_complete"?: boolean | null,"part_num"?: string | null,"price": number,"set_num"?: string | null,"stock"?: number,"updated_at"?: string
                  }
                  Update: {
                    "color_id"?: number | null,"compare_at_price"?: number | null,"condition"?: Database["public"]['Enums']["item_condition"],"condition_notes"?: string | null,"created_at"?: string,"description"?: string | null,"fig_num"?: string | null,"has_box"?: boolean | null,"has_instructions"?: boolean | null,"id"?: never,"is_complete"?: boolean | null,"is_published"?: boolean,"item_type"?: Database["public"]['Enums']["item_type"],"minifigs_complete"?: boolean | null,"part_num"?: string | null,"price"?: number,"set_num"?: string | null,"stock"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "listings_color_id_fkey"
      columns: ["color_id"]
isOneToOne: false
      referencedRelation: "colors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listings_fig_num_fkey"
      columns: ["fig_num"]
isOneToOne: false
      referencedRelation: "minifigs"
      referencedColumns: ["fig_num"]
    },{
      foreignKeyName: "listings_part_num_fkey"
      columns: ["part_num"]
isOneToOne: false
      referencedRelation: "parts"
      referencedColumns: ["part_num"]
    },{
      foreignKeyName: "listings_set_num_fkey"
      columns: ["set_num"]
isOneToOne: false
      referencedRelation: "sets"
      referencedColumns: ["set_num"]
    }
                  ]
                },"minifigs": {
                  Row: {
                    "fig_num": string,"img_url": string | null,"name": string,"num_parts": number
                  }
                  Insert: {
                    "fig_num": string,"img_url"?: string | null,"name": string,"num_parts"?: number
                  }
                  Update: {
                    "fig_num"?: string,"img_url"?: string | null,"name"?: string,"num_parts"?: number
                  }
                  Relationships: [
                    
                  ]
                },"order_items": {
                  Row: {
                    "condition": Database["public"]['Enums']["item_condition"],"id": number,"item_num": string,"listing_id": number,"name": string,"order_id": number,"quantity": number,"unit_price": number
                  }
                  Insert: {
                    "condition": Database["public"]['Enums']["item_condition"],"id"?: never,"item_num": string,"listing_id": number,"name": string,"order_id": number,"quantity": number,"unit_price": number
                  }
                  Update: {
                    "condition"?: Database["public"]['Enums']["item_condition"],"id"?: never,"item_num"?: string,"listing_id"?: number,"name"?: string,"order_id"?: number,"quantity"?: number,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "catalog_listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_status_history": {
                  Row: {
                    "changed_by": string | null,"created_at": string,"id": number,"note": string | null,"order_id": number,"status": Database["public"]['Enums']["order_status"]
                  }
                  Insert: {
                    "changed_by"?: string | null,"created_at"?: string,"id"?: never,"note"?: string | null,"order_id": number,"status": Database["public"]['Enums']["order_status"]
                  }
                  Update: {
                    "changed_by"?: string | null,"created_at"?: string,"id"?: never,"note"?: string | null,"order_id"?: number,"status"?: Database["public"]['Enums']["order_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_status_history_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "address": string | null,"city": string | null,"courier": Database["public"]['Enums']["courier"],"created_at": string,"customer_name": string,"delivery_type": Database["public"]['Enums']["delivery_type"],"email": string,"id": number,"note": string | null,"number": string,"office_code": string | null,"payment_method": Database["public"]['Enums']["payment_method"],"phone": string,"shipping_price": number,"status": Database["public"]['Enums']["order_status"],"subtotal": number,"total": number,"tracking_number": string | null,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "address"?: string | null,"city"?: string | null,"courier": Database["public"]['Enums']["courier"],"created_at"?: string,"customer_name": string,"delivery_type": Database["public"]['Enums']["delivery_type"],"email": string,"id"?: never,"note"?: string | null,"number"?: string,"office_code"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"],"phone": string,"shipping_price": number,"status"?: Database["public"]['Enums']["order_status"],"subtotal": number,"total": number,"tracking_number"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"city"?: string | null,"courier"?: Database["public"]['Enums']["courier"],"created_at"?: string,"customer_name"?: string,"delivery_type"?: Database["public"]['Enums']["delivery_type"],"email"?: string,"id"?: never,"note"?: string | null,"number"?: string,"office_code"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"],"phone"?: string,"shipping_price"?: number,"status"?: Database["public"]['Enums']["order_status"],"subtotal"?: number,"total"?: number,"tracking_number"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"part_categories": {
                  Row: {
                    "id": number,"name": string
                  }
                  Insert: {
                    "id": number,"name": string
                  }
                  Update: {
                    "id"?: number,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"part_colors": {
                  Row: {
                    "color_id": number,"img_url": string | null,"part_num": string
                  }
                  Insert: {
                    "color_id": number,"img_url"?: string | null,"part_num": string
                  }
                  Update: {
                    "color_id"?: number,"img_url"?: string | null,"part_num"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "part_colors_color_id_fkey"
      columns: ["color_id"]
isOneToOne: false
      referencedRelation: "colors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "part_colors_part_num_fkey"
      columns: ["part_num"]
isOneToOne: false
      referencedRelation: "parts"
      referencedColumns: ["part_num"]
    }
                  ]
                },"parts": {
                  Row: {
                    "img_url": string | null,"name": string,"part_cat_id": number | null,"part_num": string
                  }
                  Insert: {
                    "img_url"?: string | null,"name": string,"part_cat_id"?: number | null,"part_num": string
                  }
                  Update: {
                    "img_url"?: string | null,"name"?: string,"part_cat_id"?: number | null,"part_num"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "parts_part_cat_id_fkey"
      columns: ["part_cat_id"]
isOneToOne: false
      referencedRelation: "part_categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string | null,"id": string,"phone": string | null,"role": Database["public"]['Enums']["user_role"]
                  }
                  Insert: {
                    "created_at"?: string,"full_name"?: string | null,"id": string,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string | null,"id"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Relationships: [
                    
                  ]
                },"set_minifigs": {
                  Row: {
                    "fig_num": string,"quantity": number,"set_num": string
                  }
                  Insert: {
                    "fig_num": string,"quantity": number,"set_num": string
                  }
                  Update: {
                    "fig_num"?: string,"quantity"?: number,"set_num"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "set_minifigs_fig_num_fkey"
      columns: ["fig_num"]
isOneToOne: false
      referencedRelation: "minifigs"
      referencedColumns: ["fig_num"]
    },{
      foreignKeyName: "set_minifigs_set_num_fkey"
      columns: ["set_num"]
isOneToOne: false
      referencedRelation: "sets"
      referencedColumns: ["set_num"]
    }
                  ]
                },"sets": {
                  Row: {
                    "img_url": string | null,"name": string,"num_parts": number,"set_num": string,"theme_id": number,"year": number
                  }
                  Insert: {
                    "img_url"?: string | null,"name": string,"num_parts"?: number,"set_num": string,"theme_id": number,"year": number
                  }
                  Update: {
                    "img_url"?: string | null,"name"?: string,"num_parts"?: number,"set_num"?: string,"theme_id"?: number,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sets_theme_id_fkey"
      columns: ["theme_id"]
isOneToOne: false
      referencedRelation: "themes"
      referencedColumns: ["id"]
    }
                  ]
                },"shop_settings": {
                  Row: {
                    "free_shipping_threshold": number,"id": boolean,"shipping_price_address": number,"shipping_price_office": number
                  }
                  Insert: {
                    "free_shipping_threshold"?: number,"id"?: boolean,"shipping_price_address"?: number,"shipping_price_office"?: number
                  }
                  Update: {
                    "free_shipping_threshold"?: number,"id"?: boolean,"shipping_price_address"?: number,"shipping_price_office"?: number
                  }
                  Relationships: [
                    
                  ]
                },"themes": {
                  Row: {
                    "id": number,"name": string,"parent_id": number | null
                  }
                  Insert: {
                    "id": number,"name": string,"parent_id"?: number | null
                  }
                  Update: {
                    "id"?: number,"name"?: string,"parent_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "themes_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "themes"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "catalog_listings": {
                  Row: {
                    "catalog_img_url": string | null,"color_id": number | null,"color_name": string | null,"color_rgb": string | null,"compare_at_price": number | null,"condition": Database["public"]['Enums']["item_condition"] | null,"condition_notes": string | null,"cover_path": string | null,"created_at": string | null,"description": string | null,"has_box": boolean | null,"has_instructions": boolean | null,"id": number | null,"is_complete": boolean | null,"is_published": boolean | null,"item_num": string | null,"item_type": Database["public"]['Enums']["item_type"] | null,"minifigs_complete": boolean | null,"name": string | null,"num_parts": number | null,"part_cat_id": number | null,"part_category": string | null,"price": number | null,"stock": number | null,"theme_id": number | null,"theme_name": string | null,"year": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "listings_color_id_fkey"
      columns: ["color_id"]
isOneToOne: false
      referencedRelation: "colors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "parts_part_cat_id_fkey"
      columns: ["part_cat_id"]
isOneToOne: false
      referencedRelation: "part_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sets_theme_id_fkey"
      columns: ["theme_id"]
isOneToOne: false
      referencedRelation: "themes"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_email":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_owner_account":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"listed_part_filters":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": number,"kind": string,"listing_count": number,"name": string,"rgb": string
            }[]
                           },
"listed_root_themes":
{ Args: Record<PropertyKey, never>; Returns: {
              "listing_count": number,"name": string,"sample_img_url": string,"theme_id": number
            }[]
                           },
"place_order":
{ Args: { "p_address"?: string,"p_city"?: string,"p_courier": Database["public"]['Enums']["courier"],"p_customer_name": string,"p_delivery_type": Database["public"]['Enums']["delivery_type"],"p_email": string,"p_items": Json,"p_note"?: string,"p_office_code"?: string,"p_phone": string }; Returns: {
              "order_id": number,"order_number": string,"total": number
            }[]
                           },
"set_order_status":
{ Args: { "p_note"?: string,"p_order_id": number,"p_status": Database["public"]['Enums']["order_status"],"p_tracking_number"?: string }; Returns: undefined
                           }
          }
          Enums: {
            "courier": "econt"|"speedy","delivery_type": "office"|"address","item_condition": "new"|"used","item_type": "set"|"minifig"|"part","order_status": "new"|"confirmed"|"shipped"|"delivered"|"paid"|"cancelled"|"refused"|"returned","payment_method": "cod","user_role": "customer"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "courier": ["econt", "speedy"],"delivery_type": ["office", "address"],"item_condition": ["new", "used"],"item_type": ["set", "minifig", "part"],"order_status": ["new", "confirmed", "shipped", "delivered", "paid", "cancelled", "refused", "returned"],"payment_method": ["cod"],"user_role": ["customer", "admin"]
          }
        }
} as const
