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
      buyer_supplier_connections: {
        Row: {
          buyer_id: string | null
          id: string
          notes: string | null
          requested_at: string | null
          responded_at: string | null
          status: string
          supplier_id: string | null
        }
        Insert: {
          buyer_id?: string | null
          id?: string
          notes?: string | null
          requested_at?: string | null
          responded_at?: string | null
          status?: string
          supplier_id?: string | null
        }
        Update: {
          buyer_id?: string | null
          id?: string
          notes?: string | null
          requested_at?: string | null
          responded_at?: string | null
          status?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_supplier_connections_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_supplier_connections_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      buyers: {
        Row: {
          address: string | null
          company_name: string
          contact_email: string
          created_at: string | null
          id: string
          industry: string | null
          phone: string | null
          profile_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          company_name: string
          contact_email: string
          created_at?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          contact_email?: string
          created_at?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requests: {
        Row: {
          buyer_id: string | null
          category: string
          created_at: string | null
          description: string | null
          document_type: string
          due_date: string | null
          id: string
          notes: string | null
          priority: Database["public"]["Enums"]["request_priority"] | null
          requester_id: string | null
          status: Database["public"]["Enums"]["request_status"] | null
          supplier_id: string | null
          template_sections: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          buyer_id?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          document_type: string
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["request_priority"] | null
          requester_id?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          supplier_id?: string | null
          template_sections?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          document_type?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["request_priority"] | null
          requester_id?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          supplier_id?: string | null
          template_sections?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      document_uploads: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          request_id: string | null
          reviewer_notes: string | null
          status: string | null
          updated_at: string | null
          uploader_id: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          request_id?: string | null
          reviewer_notes?: string | null
          status?: string | null
          updated_at?: string | null
          uploader_id?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          request_id?: string | null
          reviewer_notes?: string | null
          status?: string | null
          updated_at?: string | null
          uploader_id?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_uploads_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_uploads_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          reference_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          reference_id?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          roles: Database["public"]["Enums"]["user_role"][]
          updated_at: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id: string
          roles?: Database["public"]["Enums"]["user_role"][]
          updated_at?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          roles?: Database["public"]["Enums"]["user_role"][]
          updated_at?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          company_name: string
          contact_email: string
          created_at: string | null
          id: string
          industry: string | null
          phone: string | null
          profile_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          company_name: string
          contact_email: string
          created_at?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          contact_email?: string
          created_at?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_notification: {
        Args: {
          p_user_id: string
          p_title: string
          p_message: string
          p_type: string
          p_reference_id?: string
        }
        Returns: string
      }
    }
    Enums: {
      request_priority: "low" | "medium" | "high" | "urgent"
      request_status:
        | "pending"
        | "submitted"
        | "approved"
        | "rejected"
        | "expired"
      user_role: "buyer" | "supplier" | "admin"
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
      request_priority: ["low", "medium", "high", "urgent"],
      request_status: [
        "pending",
        "submitted",
        "approved",
        "rejected",
        "expired",
      ],
      user_role: ["buyer", "supplier", "admin"],
    },
  },
} as const
