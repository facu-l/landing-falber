
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "customers": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string,"id": string,"updated_at": string,"whatsapp": string
                  }
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name": string,"id"?: string,"updated_at"?: string,"whatsapp": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"updated_at"?: string,"whatsapp"?: string
                  }
                  Relationships: [
                    
                  ]
                },"order_items": {
                  Row: {
                    "id": string,"line_total": number | null,"order_id": string,"product_name": string,"quantity": number,"unit_price": number,"variant_id": string,"variant_label": string
                  }
                  Insert: {
                    "id"?: string,"line_total"?: never,"order_id": string,"product_name": string,"quantity": number,"unit_price": number,"variant_id": string,"variant_label": string
                  }
                  Update: {
                    "id"?: string,"line_total"?: never,"order_id"?: string,"product_name"?: string,"quantity"?: number,"unit_price"?: number,"variant_id"?: string,"variant_label"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "created_at": string,"customer_email": string | null,"customer_id": string,"customer_name": string,"delivery_address": string | null,"delivery_city": string | null,"delivery_method": Database["public"]['Enums']["delivery_method"],"delivery_postal_code": string | null,"delivery_reference": string | null,"id": string,"order_note": string | null,"order_number": string,"payment_method": Database["public"]['Enums']["payment_method"],"request_id": string,"shipping_cost": number | null,"status": Database["public"]['Enums']["order_status"],"subtotal": number,"total": number | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"customer_email"?: string | null,"customer_id": string,"customer_name": string,"delivery_address"?: string | null,"delivery_city"?: string | null,"delivery_method": Database["public"]['Enums']["delivery_method"],"delivery_postal_code"?: string | null,"delivery_reference"?: string | null,"id"?: string,"order_note"?: string | null,"order_number"?: string,"payment_method": Database["public"]['Enums']["payment_method"],"request_id": string,"shipping_cost"?: number | null,"status"?: Database["public"]['Enums']["order_status"],"subtotal": number,"total"?: never,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"customer_email"?: string | null,"customer_id"?: string,"customer_name"?: string,"delivery_address"?: string | null,"delivery_city"?: string | null,"delivery_method"?: Database["public"]['Enums']["delivery_method"],"delivery_postal_code"?: string | null,"delivery_reference"?: string | null,"id"?: string,"order_note"?: string | null,"order_number"?: string,"payment_method"?: Database["public"]['Enums']["payment_method"],"request_id"?: string,"shipping_cost"?: number | null,"status"?: Database["public"]['Enums']["order_status"],"subtotal"?: number,"total"?: never,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"perfume_requests": {
                  Row: {
                    "brand": string | null,"created_at": string,"customer_id": string,"customer_name": string,"id": string,"note": string | null,"perfume_name": string,"presentation": string | null,"status": Database["public"]['Enums']["request_status"],"updated_at": string,"variant_id": string | null
                  }
                  Insert: {
                    "brand"?: string | null,"created_at"?: string,"customer_id": string,"customer_name": string,"id"?: string,"note"?: string | null,"perfume_name": string,"presentation"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"updated_at"?: string,"variant_id"?: string | null
                  }
                  Update: {
                    "brand"?: string | null,"created_at"?: string,"customer_id"?: string,"customer_name"?: string,"id"?: string,"note"?: string | null,"perfume_name"?: string,"presentation"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"updated_at"?: string,"variant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "perfume_requests_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "perfume_requests_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"product_variants": {
                  Row: {
                    "created_at": string,"id": string,"is_available": boolean,"label": string | null,"price": number,"product_id": string,"size_ml": number,"stock": number,"updated_at": string,"variant_type": Database["public"]['Enums']["variant_type"]
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_available"?: boolean,"label"?: never,"price": number,"product_id": string,"size_ml": number,"stock"?: number,"updated_at"?: string,"variant_type": Database["public"]['Enums']["variant_type"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_available"?: boolean,"label"?: never,"price"?: number,"product_id"?: string,"size_ml"?: number,"stock"?: number,"updated_at"?: string,"variant_type"?: Database["public"]['Enums']["variant_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_variants_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "brand": string,"created_at": string,"description": string | null,"gender": Database["public"]['Enums']["product_gender"] | null,"id": string,"image_path": string | null,"is_featured": boolean,"name": string,"slug": string,"status": Database["public"]['Enums']["product_status"],"updated_at": string
                  }
                  Insert: {
                    "brand": string,"created_at"?: string,"description"?: string | null,"gender"?: Database["public"]['Enums']["product_gender"] | null,"id"?: string,"image_path"?: string | null,"is_featured"?: boolean,"name": string,"slug": string,"status"?: Database["public"]['Enums']["product_status"],"updated_at"?: string
                  }
                  Update: {
                    "brand"?: string,"created_at"?: string,"description"?: string | null,"gender"?: Database["public"]['Enums']["product_gender"] | null,"id"?: string,"image_path"?: string | null,"is_featured"?: boolean,"name"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["product_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"role": Database["public"]['Enums']["admin_role"]
                  }
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string,"role"?: Database["public"]['Enums']["admin_role"]
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"role"?: Database["public"]['Enums']["admin_role"]
                  }
                  Relationships: [
                    
                  ]
                },"rate_limit_events": {
                  Row: {
                    "action": string,"client_key": string,"created_at": string,"id": number
                  }
                  Insert: {
                    "action": string,"client_key": string,"created_at"?: string,"id"?: never
                  }
                  Update: {
                    "action"?: string,"client_key"?: string,"created_at"?: string,"id"?: never
                  }
                  Relationships: [
                    
                  ]
                },"stock_movements": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"movement_type": Database["public"]['Enums']["stock_movement_type"],"note": string | null,"quantity": number,"reference_id": string | null,"variant_id": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"movement_type": Database["public"]['Enums']["stock_movement_type"],"note"?: string | null,"quantity": number,"reference_id"?: string | null,"variant_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"movement_type"?: Database["public"]['Enums']["stock_movement_type"],"note"?: string | null,"quantity"?: number,"reference_id"?: string | null,"variant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_reference_id_fkey"
      columns: ["reference_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "perfume_requests_ranking": {
                  Row: {
                    "brand": string | null,"last_requested_at": string | null,"pending_requests": number | null,"perfume_key": string | null,"perfume_name": string | null,"total_requests": number | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "cancel_stale_orders":
{ Args: { "p_older_than"?: string }; Returns: number
                           },
"create_order":
{ Args: { "p_client_key": string,"p_delivery_address": string,"p_delivery_city": string,"p_delivery_method": string,"p_delivery_postal_code": string,"p_delivery_reference": string,"p_email": string,"p_full_name": string,"p_items": Json,"p_order_note": string,"p_payment_method": string,"p_request_id": string,"p_whatsapp": string }; Returns: Json
                           },
"create_perfume_request":
{ Args: { "p_brand": string,"p_client_key": string,"p_full_name": string,"p_note": string,"p_perfume_name": string,"p_presentation": string,"p_variant_id"?: string,"p_whatsapp": string }; Returns: string
                           },
"enforce_rate_limit":
{ Args: { "p_action": string,"p_client_key": string,"p_max": number,"p_window": string }; Returns: undefined
                           },
"get_order_summary":
{ Args: { "p_order_id": string }; Returns: Json
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_valid_order_transition":
{ Args: { "p_delivery": Database["public"]['Enums']["delivery_method"],"p_from": Database["public"]['Enums']["order_status"],"p_payment": Database["public"]['Enums']["payment_method"],"p_to": Database["public"]['Enums']["order_status"] }; Returns: boolean
                           },
"next_order_number":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"purge_rate_limit_events":
{ Args: Record<PropertyKey, never>; Returns: number
                           }
          }
          Enums: {
            "admin_role": "admin","delivery_method": "pickup"|"delivery","order_status": "pending"|"confirmed"|"paid"|"preparing"|"ready_for_pickup"|"shipped"|"completed"|"cancelled","payment_method": "transfer"|"cash","product_gender": "male"|"female"|"unisex","product_status": "active"|"inactive","request_status": "pending"|"contacted"|"quoted"|"sourcing"|"completed"|"cancelled","stock_movement_type": "initial_stock"|"restock"|"sale"|"order_cancelled"|"adjustment"|"damaged","variant_type": "decant"|"full_bottle"
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
            "admin_role": ["admin"],"delivery_method": ["pickup", "delivery"],"order_status": ["pending", "confirmed", "paid", "preparing", "ready_for_pickup", "shipped", "completed", "cancelled"],"payment_method": ["transfer", "cash"],"product_gender": ["male", "female", "unisex"],"product_status": ["active", "inactive"],"request_status": ["pending", "contacted", "quoted", "sourcing", "completed", "cancelled"],"stock_movement_type": ["initial_stock", "restock", "sale", "order_cancelled", "adjustment", "damaged"],"variant_type": ["decant", "full_bottle"]
          }
        }
} as const
