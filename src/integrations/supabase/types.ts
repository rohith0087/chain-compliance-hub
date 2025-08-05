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
      approval_workflows: {
        Row: {
          branch_id: string | null
          company_id: string
          company_type: string
          created_at: string
          created_by: string
          description: string | null
          document_types: string[] | null
          id: string
          is_active: boolean | null
          updated_at: string
          workflow_name: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          company_type: string
          created_at?: string
          created_by: string
          description?: string | null
          document_types?: string[] | null
          id?: string
          is_active?: boolean | null
          updated_at?: string
          workflow_name: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          company_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          document_types?: string[] | null
          id?: string
          is_active?: boolean | null
          updated_at?: string
          workflow_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflows_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_compliance_metrics: {
        Row: {
          approved_documents: number | null
          avg_approval_time_hours: number | null
          branch_id: string
          compliance_score: number | null
          created_at: string
          expired_documents: number | null
          id: string
          metric_date: string
          overdue_count: number | null
          pending_documents: number | null
          rejected_documents: number | null
          total_documents: number | null
          updated_at: string
        }
        Insert: {
          approved_documents?: number | null
          avg_approval_time_hours?: number | null
          branch_id: string
          compliance_score?: number | null
          created_at?: string
          expired_documents?: number | null
          id?: string
          metric_date?: string
          overdue_count?: number | null
          pending_documents?: number | null
          rejected_documents?: number | null
          total_documents?: number | null
          updated_at?: string
        }
        Update: {
          approved_documents?: number | null
          avg_approval_time_hours?: number | null
          branch_id?: string
          compliance_score?: number | null
          created_at?: string
          expired_documents?: number | null
          id?: string
          metric_date?: string
          overdue_count?: number | null
          pending_documents?: number | null
          rejected_documents?: number | null
          total_documents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_compliance_metrics_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
        ]
      }
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
      delegation_permissions: {
        Row: {
          branch_id: string | null
          company_id: string
          company_type: string
          created_at: string
          delegate_id: string
          delegation_reason: string | null
          delegator_id: string
          expires_at: string
          id: string
          permission_type: Database["public"]["Enums"]["permission_type"]
          revoked_at: string | null
          revoked_by: string | null
          starts_at: string
          status: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          company_type: string
          created_at?: string
          delegate_id: string
          delegation_reason?: string | null
          delegator_id: string
          expires_at: string
          id?: string
          permission_type: Database["public"]["Enums"]["permission_type"]
          revoked_at?: string | null
          revoked_by?: string | null
          starts_at?: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          company_type?: string
          created_at?: string
          delegate_id?: string
          delegation_reason?: string | null
          delegator_id?: string
          expires_at?: string
          id?: string
          permission_type?: Database["public"]["Enums"]["permission_type"]
          revoked_at?: string | null
          revoked_by?: string | null
          starts_at?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegation_permissions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      document_approvals: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approver_id: string | null
          created_at: string
          current_step_id: string | null
          document_id: string
          escalated_at: string | null
          escalated_to: string | null
          id: string
          status: string
          updated_at: string
          workflow_id: string | null
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approver_id?: string | null
          created_at?: string
          current_step_id?: string | null
          document_id: string
          escalated_at?: string | null
          escalated_to?: string | null
          id?: string
          status?: string
          updated_at?: string
          workflow_id?: string | null
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approver_id?: string | null
          created_at?: string
          current_step_id?: string | null
          document_id?: string
          escalated_at?: string | null
          escalated_to?: string | null
          id?: string
          status?: string
          updated_at?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_approvals_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_approvals_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      document_libraries: {
        Row: {
          access_level: string | null
          branch_id: string | null
          company_id: string
          company_type: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_default: boolean | null
          library_name: string
          library_type: string
          updated_at: string
        }
        Insert: {
          access_level?: string | null
          branch_id?: string | null
          company_id: string
          company_type: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          library_name: string
          library_type?: string
          updated_at?: string
        }
        Update: {
          access_level?: string | null
          branch_id?: string | null
          company_id?: string
          company_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          library_name?: string
          library_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_libraries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requests: {
        Row: {
          branch_id: string | null
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
          branch_id?: string | null
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
          branch_id?: string | null
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
            foreignKeyName: "document_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
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
          branch_id: string | null
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
          branch_id?: string | null
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
          branch_id?: string | null
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
            foreignKeyName: "document_uploads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
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
      shared_documents: {
        Row: {
          created_at: string
          document_id: string
          document_type: string
          expires_at: string | null
          id: string
          notes: string | null
          permission_level: string
          shared_by: string
          shared_from_branch_id: string
          shared_to_branch_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_id: string
          document_type: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          permission_level?: string
          shared_by: string
          shared_from_branch_id: string
          shared_to_branch_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          document_type?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          permission_level?: string
          shared_by?: string
          shared_from_branch_id?: string
          shared_to_branch_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_documents_shared_from_branch_id_fkey"
            columns: ["shared_from_branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_documents_shared_to_branch_id_fkey"
            columns: ["shared_to_branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
        ]
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
      workflow_steps: {
        Row: {
          created_at: string
          escalation_role: string | null
          id: string
          is_parallel: boolean | null
          required_permissions: string[] | null
          required_role: string
          step_name: string
          step_order: number
          timeout_hours: number | null
          workflow_id: string
        }
        Insert: {
          created_at?: string
          escalation_role?: string | null
          id?: string
          is_parallel?: boolean | null
          required_permissions?: string[] | null
          required_role: string
          step_name: string
          step_order: number
          timeout_hours?: number | null
          workflow_id: string
        }
        Update: {
          created_at?: string
          escalation_role?: string | null
          id?: string
          is_parallel?: boolean | null
          required_permissions?: string[] | null
          required_role?: string
          step_name?: string
          step_order?: number
          timeout_hours?: number | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_company_users: {
        Args: {
          p_user_id: string
          p_company_id: string
          p_company_type: string
        }
        Returns: boolean
      }
      can_view_company_users: {
        Args: {
          p_user_id: string
          p_company_id: string
          p_company_type: string
        }
        Returns: boolean
      }
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
