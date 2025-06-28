export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_data: Json | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          currency: string | null
          customer_notes: string | null
          end_time: string
          external_event_id: string | null
          final_price: number | null
          id: string
          internal_notes: string | null
          quoted_price: number | null
          service_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          tenant_id: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          appointment_data?: Json | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          currency?: string | null
          customer_notes?: string | null
          end_time: string
          external_event_id?: string | null
          final_price?: number | null
          id?: string
          internal_notes?: string | null
          quoted_price?: number | null
          service_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          tenant_id?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          appointment_data?: Json | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          currency?: string | null
          customer_notes?: string | null
          end_time?: string
          external_event_id?: string | null
          final_price?: number | null
          id?: string
          internal_notes?: string | null
          quoted_price?: number | null
          service_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          tenant_id?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_templates: {
        Row: {
          created_at: string | null
          friday_slots: Json | null
          id: string
          is_default: boolean | null
          monday_slots: Json | null
          name: string
          saturday_slots: Json | null
          special_dates: Json | null
          sunday_slots: Json | null
          tenant_id: string | null
          thursday_slots: Json | null
          tuesday_slots: Json | null
          updated_at: string | null
          wednesday_slots: Json | null
        }
        Insert: {
          created_at?: string | null
          friday_slots?: Json | null
          id?: string
          is_default?: boolean | null
          monday_slots?: Json | null
          name: string
          saturday_slots?: Json | null
          special_dates?: Json | null
          sunday_slots?: Json | null
          tenant_id?: string | null
          thursday_slots?: Json | null
          tuesday_slots?: Json | null
          updated_at?: string | null
          wednesday_slots?: Json | null
        }
        Update: {
          created_at?: string | null
          friday_slots?: Json | null
          id?: string
          is_default?: boolean | null
          monday_slots?: Json | null
          name?: string
          saturday_slots?: Json | null
          special_dates?: Json | null
          sunday_slots?: Json | null
          tenant_id?: string | null
          thursday_slots?: Json | null
          tuesday_slots?: Json | null
          updated_at?: string | null
          wednesday_slots?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_history: {
        Row: {
          confidence_score: number | null
          content: string
          conversation_context: Json | null
          created_at: string | null
          id: string
          intent_detected: string | null
          is_from_user: boolean
          message_content: string | null
          message_id: string | null
          message_type: string
          phone_number: string | null
          raw_message: Json | null
          tenant_id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          confidence_score?: number | null
          content: string
          conversation_context?: Json | null
          created_at?: string | null
          id?: string
          intent_detected?: string | null
          is_from_user: boolean
          message_content?: string | null
          message_id?: string | null
          message_type: string
          phone_number?: string | null
          raw_message?: Json | null
          tenant_id: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          confidence_score?: number | null
          content?: string
          conversation_context?: Json | null
          created_at?: string | null
          id?: string
          intent_detected?: string | null
          is_from_user?: boolean
          message_content?: string | null
          message_id?: string | null
          message_type?: string
          phone_number?: string | null
          raw_message?: Json | null
          tenant_id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_states: {
        Row: {
          context: Json | null
          created_at: string | null
          current_step: string | null
          id: string
          last_message_at: string | null
          phone_number: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          current_step?: string | null
          id?: string
          last_message_at?: string | null
          phone_number: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          current_step?: string | null
          id?: string
          last_message_at?: string | null
          phone_number?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_states_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          name: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          advance_booking_days: number | null
          base_price: number | null
          category_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          display_order: number | null
          duration_max: number | null
          duration_min: number | null
          duration_minutes: number | null
          duration_type: Database["public"]["Enums"]["duration_type"]
          id: string
          is_active: boolean | null
          max_bookings_per_day: number | null
          name: string
          price_model: Database["public"]["Enums"]["price_model"]
          service_config: Json | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          advance_booking_days?: number | null
          base_price?: number | null
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          display_order?: number | null
          duration_max?: number | null
          duration_min?: number | null
          duration_minutes?: number | null
          duration_type?: Database["public"]["Enums"]["duration_type"]
          id?: string
          is_active?: boolean | null
          max_bookings_per_day?: number | null
          name: string
          price_model?: Database["public"]["Enums"]["price_model"]
          service_config?: Json | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          advance_booking_days?: number | null
          base_price?: number | null
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          display_order?: number | null
          duration_max?: number | null
          duration_min?: number | null
          duration_minutes?: number | null
          duration_type?: Database["public"]["Enums"]["duration_type"]
          id?: string
          is_active?: boolean | null
          max_bookings_per_day?: number | null
          name?: string
          price_model?: Database["public"]["Enums"]["price_model"]
          service_config?: Json | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          ai_settings: Json
          business_address: Json | null
          business_description: string | null
          business_name: string
          business_rules: Json
          created_at: string | null
          domain: Database["public"]["Enums"]["business_domain"]
          domain_config: Json
          email: string
          id: string
          name: string
          phone: string
          slug: string
          status: string | null
          subscription_plan: string | null
          updated_at: string | null
          whatsapp_phone: string | null
          whatsapp_settings: Json | null
        }
        Insert: {
          ai_settings?: Json
          business_address?: Json | null
          business_description?: string | null
          business_name: string
          business_rules?: Json
          created_at?: string | null
          domain: Database["public"]["Enums"]["business_domain"]
          domain_config?: Json
          email: string
          id?: string
          name: string
          phone: string
          slug: string
          status?: string | null
          subscription_plan?: string | null
          updated_at?: string | null
          whatsapp_phone?: string | null
          whatsapp_settings?: Json | null
        }
        Update: {
          ai_settings?: Json
          business_address?: Json | null
          business_description?: string | null
          business_name?: string
          business_rules?: Json
          created_at?: string | null
          domain?: Database["public"]["Enums"]["business_domain"]
          domain_config?: Json
          email?: string
          id?: string
          name?: string
          phone?: string
          slug?: string
          status?: string | null
          subscription_plan?: string | null
          updated_at?: string | null
          whatsapp_phone?: string | null
          whatsapp_settings?: Json | null
        }
        Relationships: []
      }
      user_tenants: {
        Row: {
          first_interaction: string | null
          last_interaction: string | null
          role: string | null
          tenant_id: string
          tenant_preferences: Json | null
          total_bookings: number | null
          user_id: string
        }
        Insert: {
          first_interaction?: string | null
          last_interaction?: string | null
          role?: string | null
          tenant_id: string
          tenant_preferences?: Json | null
          total_bookings?: number | null
          user_id: string
        }
        Update: {
          first_interaction?: string | null
          last_interaction?: string | null
          role?: string | null
          tenant_id?: string
          tenant_preferences?: Json | null
          total_bookings?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tenants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          phone: string
          preferences: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone: string
          preferences?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string
          preferences?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_media: {
        Row: {
          caption: string | null
          created_at: string | null
          file_size: number | null
          filename: string | null
          id: string
          local_path: string | null
          media_id: string
          media_type: string
          media_url: string | null
          message_id: string
          mime_type: string | null
          phone_number: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          local_path?: string | null
          media_id: string
          media_type: string
          media_url?: string | null
          message_id: string
          mime_type?: string | null
          phone_number: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          local_path?: string | null
          media_id?: string
          media_type?: string
          media_url?: string | null
          message_id?: string
          mime_type?: string | null
          phone_number?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_media_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          category: string | null
          components: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          language_code: string | null
          name: string
          status: string | null
          template_name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          components?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          language_code?: string | null
          name: string
          status?: string | null
          template_name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          components?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          language_code?: string | null
          name?: string
          status?: string | null
          template_name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      citext: {
        Args: { "": boolean } | { "": string } | { "": unknown }
        Returns: string
      }
      citext_hash: {
        Args: { "": string }
        Returns: number
      }
      citextin: {
        Args: { "": unknown }
        Returns: string
      }
      citextout: {
        Args: { "": string }
        Returns: unknown
      }
      citextrecv: {
        Args: { "": unknown }
        Returns: string
      }
      citextsend: {
        Args: { "": string }
        Returns: string
      }
    }
    Enums: {
      appointment_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
        | "rescheduled"
      business_domain:
        | "legal"
        | "healthcare"
        | "education"
        | "beauty"
        | "sports"
        | "consulting"
        | "other"
      duration_type: "fixed" | "variable" | "estimated" | "session"
      price_model: "fixed" | "hourly" | "package" | "dynamic" | "consultation"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
        "rescheduled",
      ],
      business_domain: [
        "legal",
        "healthcare",
        "education",
        "beauty",
        "sports",
        "consulting",
        "other",
      ],
      duration_type: ["fixed", "variable", "estimated", "session"],
      price_model: ["fixed", "hourly", "package", "dynamic", "consultation"],
    },
  },
} as const

// Convenience types
export type BusinessDomain = Database['public']['Enums']['business_domain']
export type AppointmentStatus = Database['public']['Enums']['appointment_status']
export type DurationType = Database['public']['Enums']['duration_type']
export type PriceModel = Database['public']['Enums']['price_model']

// Table row types
export type Tenant = Tables<'tenants'>
export type User = Tables<'users'>
export type Service = Tables<'services'>
export type Appointment = Tables<'appointments'>
export type ConversationHistory = Tables<'conversation_history'>
export type ConversationState = Tables<'conversation_states'>
export type WhatsAppMedia = Tables<'whatsapp_media'>
export type WhatsAppTemplate = Tables<'whatsapp_templates'>
