export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      buyer_supplier_connections: {
        Row: {
          buyer_id: string | null
          id: string
          initiated_by: string | null
          notes: string | null
          requested_at: string | null
          responded_at: string | null
          status: string
          supplier_id: string | null
        }
        Insert: {
          buyer_id?: string | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          requested_at?: string | null
          responded_at?: string | null
          status?: string
          supplier_id?: string | null
        }
        Update: {
          buyer_id?: string | null
          id?: string
          initiated_by?: string | null
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
          buyer_id_number: string | null
          company_logo_url: string | null
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
          buyer_id_number?: string | null
          company_logo_url?: string | null
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
          buyer_id_number?: string | null
          company_logo_url?: string | null
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
      company_branches: {
        Row: {
          address: string | null
          branch_name: string
          company_id: string
          company_type: string
          created_at: string
          email: string | null
          id: string
          location: string | null
          manager_id: string | null
          phone: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          branch_name: string
          company_id: string
          company_type: string
          created_at?: string
          email?: string | null
          id?: string
          location?: string | null
          manager_id?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          branch_name?: string
          company_id?: string
          company_type?: string
          created_at?: string
          email?: string | null
          id?: string
          location?: string | null
          manager_id?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_users: {
        Row: {
          branch_id: string | null
          company_id: string
          company_type: string
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string | null
          profile_id: string
          role: Database["public"]["Enums"]["user_role"]
          status: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          company_type: string
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          profile_id: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          company_type?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          profile_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          updated_at?: string
        }
        Relationships: []
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
          expiration_date: string | null
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
          expiration_date?: string | null
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
          expiration_date?: string | null
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
          auto_approve_connections: boolean | null
          company_logo_url: string | null
          company_name: string
          contact_email: string
          created_at: string | null
          description: string | null
          id: string
          industry: string | null
          phone: string | null
          profile_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          auto_approve_connections?: boolean | null
          company_logo_url?: string | null
          company_name: string
          contact_email: string
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          auto_approve_connections?: boolean | null
          company_logo_url?: string | null
          company_name?: string
          contact_email?: string
          created_at?: string | null
          description?: string | null
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
      user_permissions: {
        Row: {
          branch_id: string | null
          company_id: string
          company_type: string
          created_at: string
          expires_at: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          permission_type: Database["public"]["Enums"]["permission_type"]
          resource_access: string | null
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          company_type: string
          created_at?: string
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          permission_type: Database["public"]["Enums"]["permission_type"]
          resource_access?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          company_type?: string
          created_at?: string
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          permission_type?: Database["public"]["Enums"]["permission_type"]
          resource_access?: string | null
          user_id?: string
        }
        Relationships: []
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
      create_supplier_to_buyer_connection: {
        Args: {
          p_buyer_id_number: string
          p_supplier_profile_id: string
          p_notes?: string
        }
        Returns: Json
      }
      supplier_can_view_buyer: {
        Args: { buyer_id: string }
        Returns: boolean
      }
      user_has_branch_access: {
        Args: { p_user_id: string; p_branch_id: string }
        Returns: boolean
      }
      user_has_company_access: {
        Args: {
          p_user_id: string
          p_company_id: string
          p_company_type: string
        }
        Returns: boolean
      }
      user_has_permission: {
        Args: {
          p_user_id: string
          p_company_id: string
          p_company_type: string
          p_permission: Database["public"]["Enums"]["permission_type"]
        }
        Returns: boolean
      }
    }
    Enums: {
      permission_type:
        | "read"
        | "write"
        | "approve"
        | "delete"
        | "invite_users"
        | "manage_branches"
        | "export_data"
      request_priority: "low" | "medium" | "high" | "urgent"
      request_status:
        | "pending"
        | "submitted"
        | "approved"
        | "rejected"
        | "expired"
      user_role:
        | "buyer"
        | "supplier"
        | "admin"
        | "company_admin"
        | "branch_manager"
        | "document_manager"
        | "viewer"
        | "approver"
        | "auditor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      permission_type: [
        "read",
        "write",
        "approve",
        "delete",
        "invite_users",
        "manage_branches",
        "export_data",
      ],
      request_priority: ["low", "medium", "high", "urgent"],
      request_status: [
        "pending",
        "submitted",
        "approved",
        "rejected",
        "expired",
      ],
      user_role: [
        "buyer",
        "supplier",
        "admin",
        "company_admin",
        "branch_manager",
        "document_manager",
        "viewer",
        "approver",
        "auditor",
      ],
    },
  },
} as const
