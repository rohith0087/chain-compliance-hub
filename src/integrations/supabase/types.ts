export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      agent_activities: {
        Row: {
          action_type: string
          agent_type: string
          confidence_score: number | null
          created_at: string
          details: Json | null
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          intermediate_results: Json | null
          operation_duration_ms: number | null
          processing_steps: Json | null
          reasoning: string | null
          success: boolean | null
        }
        Insert: {
          action_type: string
          agent_type: string
          confidence_score?: number | null
          created_at?: string
          details?: Json | null
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          intermediate_results?: Json | null
          operation_duration_ms?: number | null
          processing_steps?: Json | null
          reasoning?: string | null
          success?: boolean | null
        }
        Update: {
          action_type?: string
          agent_type?: string
          confidence_score?: number | null
          created_at?: string
          details?: Json | null
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          intermediate_results?: Json | null
          operation_duration_ms?: number | null
          processing_steps?: Json | null
          reasoning?: string | null
          success?: boolean | null
        }
        Relationships: []
      }
      agent_configurations: {
        Row: {
          agent_type: string
          company_id: string
          company_type: string
          created_at: string
          created_by: string | null
          current_operation: string | null
          current_status: string | null
          enabled: boolean | null
          estimated_completion: string | null
          id: string
          last_active: string | null
          processing_details: Json | null
          settings: Json
          updated_at: string
        }
        Insert: {
          agent_type: string
          company_id: string
          company_type: string
          created_at?: string
          created_by?: string | null
          current_operation?: string | null
          current_status?: string | null
          enabled?: boolean | null
          estimated_completion?: string | null
          id?: string
          last_active?: string | null
          processing_details?: Json | null
          settings?: Json
          updated_at?: string
        }
        Update: {
          agent_type?: string
          company_id?: string
          company_type?: string
          created_at?: string
          created_by?: string | null
          current_operation?: string | null
          current_status?: string | null
          enabled?: boolean | null
          estimated_completion?: string | null
          id?: string
          last_active?: string | null
          processing_details?: Json | null
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      ai_generated_documents: {
        Row: {
          content: string
          created_at: string
          document_type: string
          id: string
          metadata: Json | null
          status: string
          supplier_id: string | null
          updated_at: string
          workflow_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          document_type: string
          id?: string
          metadata?: Json | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          workflow_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          document_type?: string
          id?: string
          metadata?: Json | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generated_documents_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_states"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_entries: {
        Row: {
          company_id: string
          company_type: string
          content: string
          created_at: string
          created_by: string | null
          embedding: string | null
          entry_type: string
          expires_at: string | null
          id: string
          industry_context: string | null
          metadata: Json | null
          relevance_tags: string[] | null
          source_reference: string | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          company_type: string
          content: string
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          entry_type: string
          expires_at?: string | null
          id?: string
          industry_context?: string | null
          metadata?: Json | null
          relevance_tags?: string[] | null
          source_reference?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          company_type?: string
          content?: string
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          entry_type?: string
          expires_at?: string | null
          id?: string
          industry_context?: string | null
          metadata?: Json | null
          relevance_tags?: string[] | null
          source_reference?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      branch_supplier_connections: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          branch_id: string
          buyer_id: string
          created_at: string
          id: string
          notes: string | null
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          branch_id: string
          buyer_id: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          branch_id?: string
          buyer_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_branch_supplier_connections_branch_id"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_branch_supplier_connections_buyer_id"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_branch_supplier_connections_supplier_id"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_document_uploads: {
        Row: {
          buyer_id: string
          completed_at: string | null
          connection_id: string | null
          created_at: string | null
          created_by: string
          error_details: Json | null
          failed_uploads: number
          id: string
          metadata: Json | null
          processed_files: number
          status: string
          successful_uploads: number
          supplier_id: string
          total_files: number
          updated_at: string | null
        }
        Insert: {
          buyer_id: string
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string | null
          created_by: string
          error_details?: Json | null
          failed_uploads?: number
          id?: string
          metadata?: Json | null
          processed_files?: number
          status?: string
          successful_uploads?: number
          supplier_id: string
          total_files?: number
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string | null
          created_by?: string
          error_details?: Json | null
          failed_uploads?: number
          id?: string
          metadata?: Json | null
          processed_files?: number
          status?: string
          successful_uploads?: number
          supplier_id?: string
          total_files?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_document_uploads_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "buyer_supplier_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_default_onboarding_settings: {
        Row: {
          allow_branch_selection: boolean
          auto_approve_standard_docs: boolean
          buyer_id: string
          created_at: string
          created_by: string
          default_welcome_message: string | null
          expires_days: number
          id: string
          require_all_documents: boolean
          require_branch_selection: boolean
          updated_at: string
        }
        Insert: {
          allow_branch_selection?: boolean
          auto_approve_standard_docs?: boolean
          buyer_id: string
          created_at?: string
          created_by: string
          default_welcome_message?: string | null
          expires_days?: number
          id?: string
          require_all_documents?: boolean
          require_branch_selection?: boolean
          updated_at?: string
        }
        Update: {
          allow_branch_selection?: boolean
          auto_approve_standard_docs?: boolean
          buyer_id?: string
          created_at?: string
          created_by?: string
          default_welcome_message?: string | null
          expires_days?: number
          id?: string
          require_all_documents?: boolean
          require_branch_selection?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_default_onboarding_settings_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: true
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_supplier_connections: {
        Row: {
          branch_id: string | null
          buyer_id: string | null
          id: string
          initiated_by: string | null
          notes: string | null
          onboarding_request_id: string | null
          requested_at: string | null
          responded_at: string | null
          status: string
          supplier_id: string | null
        }
        Insert: {
          branch_id?: string | null
          buyer_id?: string | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          onboarding_request_id?: string | null
          requested_at?: string | null
          responded_at?: string | null
          status?: string
          supplier_id?: string | null
        }
        Update: {
          branch_id?: string | null
          buyer_id?: string | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          onboarding_request_id?: string | null
          requested_at?: string | null
          responded_at?: string | null
          status?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_supplier_connections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_supplier_connections_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_supplier_connections_onboarding_request_id_fkey"
            columns: ["onboarding_request_id"]
            isOneToOne: false
            referencedRelation: "supplier_onboarding_requests"
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
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          company_id: string
          company_type: string
          context_tags: string[] | null
          created_at: string
          id: string
          session_title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          company_type: string
          context_tags?: string[] | null
          created_at?: string
          id?: string
          session_title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          company_type?: string
          context_tags?: string[] | null
          created_at?: string
          id?: string
          session_title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          invitation_token: string | null
          invited_by: string | null
          joined_at: string | null
          last_login_at: string | null
          password_reset_required: boolean | null
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
          invitation_token?: string | null
          invited_by?: string | null
          joined_at?: string | null
          last_login_at?: string | null
          password_reset_required?: boolean | null
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
          invitation_token?: string | null
          invited_by?: string | null
          joined_at?: string | null
          last_login_at?: string | null
          password_reset_required?: boolean | null
          profile_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      custom_document_templates: {
        Row: {
          buyer_id: string
          category: string
          created_at: string | null
          created_by: string
          description: string | null
          document_type: string
          expires_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          mime_type: string | null
          required_fields: Json | null
          template_name: string
          template_version: number | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          buyer_id: string
          category: string
          created_at?: string | null
          created_by: string
          description?: string | null
          document_type: string
          expires_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          required_fields?: Json | null
          template_name: string
          template_version?: number | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          buyer_id?: string
          category?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          document_type?: string
          expires_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          required_fields?: Json | null
          template_name?: string
          template_version?: number | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      default_document_requirements: {
        Row: {
          buyer_id: string
          created_at: string
          description: string | null
          display_order: number
          document_name: string
          document_type: string
          id: string
          is_required: boolean
          template_file_name: string | null
          template_file_path: string | null
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          document_name: string
          document_type: string
          id?: string
          is_required?: boolean
          template_file_name?: string | null
          template_file_path?: string | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          document_name?: string
          document_type?: string
          id?: string
          is_required?: boolean
          template_file_name?: string | null
          template_file_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "default_document_requirements_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      default_form_fields: {
        Row: {
          buyer_id: string
          created_at: string
          field_category: string | null
          field_description: string | null
          field_label: string
          field_options: Json | null
          field_order: number
          field_type: string
          id: string
          is_required: boolean
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          field_category?: string | null
          field_description?: string | null
          field_label: string
          field_options?: Json | null
          field_order?: number
          field_type: string
          id?: string
          is_required?: boolean
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          field_category?: string | null
          field_description?: string | null
          field_label?: string
          field_options?: Json | null
          field_order?: number
          field_type?: string
          id?: string
          is_required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "default_form_fields_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
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
      document_activity_logs: {
        Row: {
          action_type: string
          created_at: string
          document_upload_id: string
          id: string
          metadata: Json | null
          notes: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          document_upload_id: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          document_upload_id?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_activity_logs_document_upload_id_fkey"
            columns: ["document_upload_id"]
            isOneToOne: false
            referencedRelation: "document_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      document_processing_logs: {
        Row: {
          created_at: string
          document_id: string
          error_message: string | null
          id: string
          metadata: Json | null
          processing_step: string
          processing_time_ms: number | null
          status: string
        }
        Insert: {
          created_at?: string
          document_id: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          processing_step: string
          processing_time_ms?: number | null
          status: string
        }
        Update: {
          created_at?: string
          document_id?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          processing_step?: string
          processing_time_ms?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_processing_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "supplier_document_library"
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
          custom_template_id: string | null
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
          template_type: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          buyer_id?: string | null
          category: string
          created_at?: string | null
          custom_template_id?: string | null
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
          template_type?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          buyer_id?: string | null
          category?: string
          created_at?: string | null
          custom_template_id?: string | null
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
          template_type?: string | null
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
            foreignKeyName: "document_requests_custom_template_id_fkey"
            columns: ["custom_template_id"]
            isOneToOne: false
            referencedRelation: "custom_document_templates"
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
      document_shared_links: {
        Row: {
          access_token: string
          created_at: string
          created_by: string
          document_upload_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_accessed_at: string | null
          permission_level: string
          view_count: number
        }
        Insert: {
          access_token?: string
          created_at?: string
          created_by: string
          document_upload_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          permission_level?: string
          view_count?: number
        }
        Update: {
          access_token?: string
          created_at?: string
          created_by?: string
          document_upload_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          permission_level?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_shared_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_shared_links_document_upload_id_fkey"
            columns: ["document_upload_id"]
            isOneToOne: false
            referencedRelation: "document_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      document_uploads: {
        Row: {
          branch_id: string | null
          buyer_notes: string | null
          created_at: string | null
          expiration_date: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          original_uploader_type: string | null
          pre_populated_at: string | null
          request_id: string | null
          reviewer_notes: string | null
          status: string | null
          updated_at: string | null
          uploaded_by_buyer: boolean | null
          uploader_id: string | null
          version: number | null
        }
        Insert: {
          branch_id?: string | null
          buyer_notes?: string | null
          created_at?: string | null
          expiration_date?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          original_uploader_type?: string | null
          pre_populated_at?: string | null
          request_id?: string | null
          reviewer_notes?: string | null
          status?: string | null
          updated_at?: string | null
          uploaded_by_buyer?: boolean | null
          uploader_id?: string | null
          version?: number | null
        }
        Update: {
          branch_id?: string | null
          buyer_notes?: string | null
          created_at?: string | null
          expiration_date?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          original_uploader_type?: string | null
          pre_populated_at?: string | null
          request_id?: string | null
          reviewer_notes?: string | null
          status?: string | null
          updated_at?: string | null
          uploaded_by_buyer?: boolean | null
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
      document_validation_criteria: {
        Row: {
          auto_approve_threshold: number | null
          buyer_id: string
          created_at: string
          created_by: string | null
          criteria: Json
          document_type: string
          id: string
          required_fields: Json | null
          updated_at: string
          validation_rules: Json | null
        }
        Insert: {
          auto_approve_threshold?: number | null
          buyer_id: string
          created_at?: string
          created_by?: string | null
          criteria: Json
          document_type: string
          id?: string
          required_fields?: Json | null
          updated_at?: string
          validation_rules?: Json | null
        }
        Update: {
          auto_approve_threshold?: number | null
          buyer_id?: string
          created_at?: string
          created_by?: string | null
          criteria?: Json
          document_type?: string
          id?: string
          required_fields?: Json | null
          updated_at?: string
          validation_rules?: Json | null
        }
        Relationships: []
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
      onboarding_branch_selections: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          onboarding_request_id: string
          selected_by: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          onboarding_request_id: string
          selected_by: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          onboarding_request_id?: string
          selected_by?: string
        }
        Relationships: []
      }
      onboarding_document_requirements: {
        Row: {
          created_at: string
          description: string | null
          document_name: string
          document_type: string
          id: string
          is_required: boolean
          onboarding_request_id: string
          template_file_name: string | null
          template_file_path: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_name: string
          document_type: string
          id?: string
          is_required?: boolean
          onboarding_request_id: string
          template_file_name?: string | null
          template_file_path?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          document_name?: string
          document_type?: string
          id?: string
          is_required?: boolean
          onboarding_request_id?: string
          template_file_name?: string | null
          template_file_path?: string | null
        }
        Relationships: []
      }
      onboarding_document_submissions: {
        Row: {
          created_at: string
          document_name: string
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          is_document_available: boolean
          mime_type: string | null
          onboarding_request_id: string
          requirement_id: string | null
          submitted_by: string
          unavailability_reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_name: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_document_available?: boolean
          mime_type?: string | null
          onboarding_request_id: string
          requirement_id?: string | null
          submitted_by: string
          unavailability_reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_name?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_document_available?: boolean
          mime_type?: string | null
          onboarding_request_id?: string
          requirement_id?: string | null
          submitted_by?: string
          unavailability_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_form_fields: {
        Row: {
          created_at: string
          field_description: string | null
          field_label: string
          field_options: Json | null
          field_order: number
          field_type: string
          id: string
          is_required: boolean
          onboarding_request_id: string
        }
        Insert: {
          created_at?: string
          field_description?: string | null
          field_label: string
          field_options?: Json | null
          field_order?: number
          field_type: string
          id?: string
          is_required?: boolean
          onboarding_request_id: string
        }
        Update: {
          created_at?: string
          field_description?: string | null
          field_label?: string
          field_options?: Json | null
          field_order?: number
          field_type?: string
          id?: string
          is_required?: boolean
          onboarding_request_id?: string
        }
        Relationships: []
      }
      onboarding_form_responses: {
        Row: {
          created_at: string
          field_id: string
          id: string
          onboarding_request_id: string
          response_value: string | null
          submitted_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          onboarding_request_id: string
          response_value?: string | null
          submitted_by: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          onboarding_request_id?: string
          response_value?: string | null
          submitted_by?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_admin_audit_logs: {
        Row: {
          action_type: string
          admin_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      platform_admin_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invitation_token: string
          invited_by: string | null
          is_used: boolean | null
          metadata: Json | null
          platform_roles: Database["public"]["Enums"]["platform_role"][]
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invitation_token: string
          invited_by?: string | null
          is_used?: boolean | null
          metadata?: Json | null
          platform_roles?: Database["public"]["Enums"]["platform_role"][]
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invitation_token?: string
          invited_by?: string | null
          is_used?: boolean | null
          metadata?: Json | null
          platform_roles?: Database["public"]["Enums"]["platform_role"][]
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_administrators: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          created_by: string | null
          email: string
          full_name: string
          id: string
          ip_whitelist: string[] | null
          is_active: boolean | null
          last_login_at: string | null
          locked_until: string | null
          login_attempts: number | null
          metadata: Json | null
          must_change_password: boolean | null
          platform_roles: Database["public"]["Enums"]["platform_role"][]
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          created_by?: string | null
          email: string
          full_name: string
          id?: string
          ip_whitelist?: string[] | null
          is_active?: boolean | null
          last_login_at?: string | null
          locked_until?: string | null
          login_attempts?: number | null
          metadata?: Json | null
          must_change_password?: boolean | null
          platform_roles?: Database["public"]["Enums"]["platform_role"][]
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          ip_whitelist?: string[] | null
          is_active?: boolean | null
          last_login_at?: string | null
          locked_until?: string | null
          login_attempts?: number | null
          metadata?: Json | null
          must_change_password?: boolean | null
          platform_roles?: Database["public"]["Enums"]["platform_role"][]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_administrators_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "platform_administrators"
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
      supplier_document_library: {
        Row: {
          ai_suggested_description: string | null
          ai_suggested_tags: string[] | null
          category: string | null
          content_extracted: string | null
          content_summary: string | null
          created_at: string
          description: string | null
          document_name: string
          document_type: string
          expiration_date: string | null
          extraction_status: string
          file_path: string
          file_size: number | null
          id: string
          is_current_version: boolean
          mime_type: string | null
          original_document_id: string | null
          supplier_id: string
          tags: string[] | null
          updated_at: string
          uploaded_by: string
          version: number
        }
        Insert: {
          ai_suggested_description?: string | null
          ai_suggested_tags?: string[] | null
          category?: string | null
          content_extracted?: string | null
          content_summary?: string | null
          created_at?: string
          description?: string | null
          document_name: string
          document_type: string
          expiration_date?: string | null
          extraction_status?: string
          file_path: string
          file_size?: number | null
          id?: string
          is_current_version?: boolean
          mime_type?: string | null
          original_document_id?: string | null
          supplier_id: string
          tags?: string[] | null
          updated_at?: string
          uploaded_by: string
          version?: number
        }
        Update: {
          ai_suggested_description?: string | null
          ai_suggested_tags?: string[] | null
          category?: string | null
          content_extracted?: string | null
          content_summary?: string | null
          created_at?: string
          description?: string | null
          document_name?: string
          document_type?: string
          expiration_date?: string | null
          extraction_status?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_current_version?: boolean
          mime_type?: string | null
          original_document_id?: string | null
          supplier_id?: string
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_document_library_original_document_id_fkey"
            columns: ["original_document_id"]
            isOneToOne: false
            referencedRelation: "supplier_document_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_document_library_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_onboarding_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          buyer_id: string
          can_choose_branches: boolean
          completed_at: string | null
          created_at: string
          created_by: string
          custom_message: string | null
          expires_at: string | null
          id: string
          invitation_token: string
          status: string
          supplier_company_name: string | null
          supplier_email: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          buyer_id: string
          can_choose_branches?: boolean
          completed_at?: string | null
          created_at?: string
          created_by: string
          custom_message?: string | null
          expires_at?: string | null
          id?: string
          invitation_token?: string
          status?: string
          supplier_company_name?: string | null
          supplier_email: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          buyer_id?: string
          can_choose_branches?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string
          custom_message?: string | null
          expires_at?: string | null
          id?: string
          invitation_token?: string
          status?: string
          supplier_company_name?: string | null
          supplier_email?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      supplier_response_metrics: {
        Row: {
          buyer_id: string
          created_at: string
          document_type: string
          id: string
          request_date: string
          response_date: string | null
          response_time_hours: number | null
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          document_type: string
          id?: string
          request_date: string
          response_date?: string | null
          response_time_hours?: number | null
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          document_type?: string
          id?: string
          request_date?: string
          response_date?: string | null
          response_time_hours?: number | null
          status?: string
          supplier_id?: string
          updated_at?: string
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
      system_metrics: {
        Row: {
          id: string
          metadata: Json | null
          metric_name: string
          metric_value: number
          recorded_at: string | null
        }
        Insert: {
          id?: string
          metadata?: Json | null
          metric_name: string
          metric_value: number
          recorded_at?: string | null
        }
        Update: {
          id?: string
          metadata?: Json | null
          metric_name?: string
          metric_value?: number
          recorded_at?: string | null
        }
        Relationships: []
      }
      template_submissions: {
        Row: {
          created_at: string | null
          form_data: Json | null
          id: string
          request_id: string
          reviewed_at: string | null
          reviewer_notes: string | null
          status: string | null
          submission_file_name: string | null
          submission_file_path: string | null
          submission_file_size: number | null
          submission_mime_type: string | null
          submission_type: string | null
          submitted_at: string | null
          supplier_id: string
          template_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          form_data?: Json | null
          id?: string
          request_id: string
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: string | null
          submission_file_name?: string | null
          submission_file_path?: string | null
          submission_file_size?: number | null
          submission_mime_type?: string | null
          submission_type?: string | null
          submitted_at?: string | null
          supplier_id: string
          template_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          form_data?: Json | null
          id?: string
          request_id?: string
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: string | null
          submission_file_name?: string | null
          submission_file_path?: string | null
          submission_file_size?: number | null
          submission_mime_type?: string | null
          submission_type?: string | null
          submitted_at?: string | null
          supplier_id?: string
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_submissions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "custom_document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      temporary_branch_selections: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          onboarding_request_id: string
          selected_by: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          onboarding_request_id: string
          selected_by: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          onboarding_request_id?: string
          selected_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "temporary_branch_selections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_branch_selections_onboarding_request_id_fkey"
            columns: ["onboarding_request_id"]
            isOneToOne: false
            referencedRelation: "supplier_onboarding_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_logs: {
        Row: {
          activity_details: Json | null
          activity_type: string
          created_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          activity_details?: Json | null
          activity_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          activity_details?: Json | null
          activity_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_invitations: {
        Row: {
          branch_id: string | null
          company_id: string
          company_type: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          temp_password: string
          token: string
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          company_type: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          role: string
          temp_password: string
          token: string
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          company_type?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          temp_password?: string
          token?: string
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      workflow_execution_logs: {
        Row: {
          ai_response: Json | null
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          status: string
          step_id: string
          step_type: string
          workflow_id: string
        }
        Insert: {
          ai_response?: Json | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          status: string
          step_id: string
          step_type: string
          workflow_id: string
        }
        Update: {
          ai_response?: Json | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          status?: string
          step_id?: string
          step_type?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_execution_logs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_states"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_states: {
        Row: {
          ai_responses: Json
          context: Json
          created_at: string
          current_step: string
          id: string
          status: string
          template_id: string
          updated_at: string
        }
        Insert: {
          ai_responses?: Json
          context?: Json
          created_at?: string
          current_step: string
          id?: string
          status?: string
          template_id: string
          updated_at?: string
        }
        Update: {
          ai_responses?: Json
          context?: Json
          created_at?: string
          current_step?: string
          id?: string
          status?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_states_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
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
      workflow_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          steps: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          steps: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          steps?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_bootstrap_admin: {
        Args: { p_full_name: string }
        Returns: Json
      }
      accept_platform_admin_invitation: {
        Args: { p_full_name: string; p_token: string }
        Returns: Json
      }
      approve_document_request: {
        Args: { p_notes?: string; p_request_id: string }
        Returns: Json
      }
      assign_supplier_to_branch: {
        Args: { p_branch_id: string; p_notes?: string; p_supplier_id: string }
        Returns: Json
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      can_manage_company_users: {
        Args: {
          p_company_id: string
          p_company_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      can_view_company_users: {
        Args: {
          p_company_id: string
          p_company_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      cleanup_expired_knowledge_entries: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      create_bootstrap_super_admin: {
        Args: {
          p_email: string
          p_full_name?: string
          p_temp_password?: string
        }
        Returns: Json
      }
      create_notification: {
        Args: {
          p_message: string
          p_reference_id?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      create_platform_admin_invitation: {
        Args: {
          p_email: string
          p_invited_by?: string
          p_roles?: Database["public"]["Enums"]["platform_role"][]
        }
        Returns: Json
      }
      create_supplier_to_buyer_connection: {
        Args: {
          p_buyer_id_number: string
          p_notes?: string
          p_supplier_profile_id: string
        }
        Returns: Json
      }
      finalize_onboarding_approval: {
        Args: { p_notes?: string; p_onboarding_request_id: string }
        Returns: Json
      }
      get_admin_user_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          company_name: string
          email: string
          full_name: string
          id: string
          last_activity_date: string
          registration_date: string
          roles: Database["public"]["Enums"]["user_role"][]
          total_activities: number
          total_chat_messages: number
          total_chat_sessions: number
          total_document_requests: number
          total_document_uploads: number
        }[]
      }
      get_all_users_detailed: {
        Args: Record<PropertyKey, never>
        Returns: {
          chat_sessions_count: number
          company_name: string
          created_at: string
          document_count: number
          email: string
          full_name: string
          id: string
          is_buyer: boolean
          is_supplier: boolean
          last_sign_in_at: string
          roles: Database["public"]["Enums"]["user_role"][]
        }[]
      }
      get_all_users_detailed_platform: {
        Args: Record<PropertyKey, never>
        Returns: {
          company_name: string
          email: string
          full_name: string
          id: string
          last_activity_date: string
          registration_date: string
          roles: Database["public"]["Enums"]["user_role"][]
          total_activities: number
          total_chat_messages: number
          total_chat_sessions: number
          total_document_requests: number
          total_document_uploads: number
          user_type: string
        }[]
      }
      get_branch_suppliers: {
        Args: { p_branch_id: string }
        Returns: {
          address: string
          assigned_at: string
          company_name: string
          connection_status: string
          contact_email: string
          industry: string
          notes: string
          phone: string
          supplier_id: string
        }[]
      }
      get_companies_for_knowledge_refresh: {
        Args: Record<PropertyKey, never>
        Returns: {
          company_id: string
          company_name: string
          company_type: string
          document_count: number
        }[]
      }
      get_platform_admin_invitations: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by_name: string
          is_used: boolean
          platform_roles: Database["public"]["Enums"]["platform_role"][]
        }[]
      }
      get_platform_admin_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_connections: number
          total_buyers: number
          total_chat_sessions: number
          total_documents: number
          total_suppliers: number
          total_users: number
        }[]
      }
      get_platform_admin_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          buyer_company: string
          company_name: string
          created_at: string
          email: string
          email_confirmed_at: string
          full_name: string
          id: string
          is_buyer: boolean
          is_supplier: boolean
          last_sign_in_at: string
          phone: string
          roles: Database["public"]["Enums"]["user_role"][]
          supplier_company: string
        }[]
      }
      get_super_admin_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_connections: number
          pending_requests: number
          recent_signups: number
          total_buyers: number
          total_chat_sessions: number
          total_documents: number
          total_suppliers: number
          total_users: number
        }[]
      }
      grant_pg_net_access: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      handle_unified_connection_approval: {
        Args: { p_action: string; p_connection_id: string; p_notes?: string }
        Returns: Json
      }
      has_platform_role: {
        Args: {
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Returns: boolean
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      is_platform_admin: {
        Args: { user_id?: string }
        Returns: boolean
      }
      is_super_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      log_document_activity: {
        Args: {
          p_action_type: string
          p_document_upload_id: string
          p_metadata?: Json
          p_notes?: string
          p_user_id: string
        }
        Returns: string
      }
      platform_admin_reset_password: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      platform_admin_update_user_role: {
        Args: {
          new_roles: Database["public"]["Enums"]["user_role"][]
          user_id_param: string
        }
        Returns: boolean
      }
      reject_document_request: {
        Args: { p_reason: string; p_request_id: string }
        Returns: Json
      }
      revoke_platform_admin_invitation: {
        Args: { p_invitation_id: string }
        Returns: Json
      }
      search_knowledge_entries: {
        Args: {
          company_id_param: string
          company_type_param: string
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          content: string
          entry_type: string
          id: string
          metadata: Json
          similarity: number
          source_reference: string
          title: string
        }[]
      }
      search_relevant_documents: {
        Args: {
          match_limit?: number
          query_text: string
          user_company_id: string
          user_company_type: string
        }
        Returns: {
          document_type: string
          expiration_date: string
          file_path: string
          id: string
          metadata: Json
          relevance_score: number
          status: string
          supplier_name: string
          title: string
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      super_admin_reset_password: {
        Args: { new_password: string; target_user_id: string }
        Returns: boolean
      }
      supplier_can_view_buyer: {
        Args: { buyer_id: string }
        Returns: boolean
      }
      user_has_branch_access: {
        Args: { p_branch_id: string; p_user_id: string }
        Returns: boolean
      }
      user_has_company_access: {
        Args: {
          p_company_id: string
          p_company_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      user_has_permission: {
        Args: {
          p_company_id: string
          p_company_type: string
          p_permission: Database["public"]["Enums"]["permission_type"]
          p_user_id: string
        }
        Returns: boolean
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
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
      platform_role: "super_admin" | "platform_admin" | "support_admin"
      request_priority: "low" | "medium" | "high" | "urgent"
      request_status:
        | "pending"
        | "submitted"
        | "approved"
        | "rejected"
        | "expired"
        | "completed"
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
        | "super_admin"
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
      platform_role: ["super_admin", "platform_admin", "support_admin"],
      request_priority: ["low", "medium", "high", "urgent"],
      request_status: [
        "pending",
        "submitted",
        "approved",
        "rejected",
        "expired",
        "completed",
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
        "super_admin",
      ],
    },
  },
} as const
