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
      buyer_document_library: {
        Row: {
          access_level: string | null
          ai_suggested_description: string | null
          ai_suggested_tags: string[] | null
          branch_id: string | null
          buyer_id: string
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
          tags: string[] | null
          updated_at: string
          uploaded_by: string
          version: number
        }
        Insert: {
          access_level?: string | null
          ai_suggested_description?: string | null
          ai_suggested_tags?: string[] | null
          branch_id?: string | null
          buyer_id: string
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
          tags?: string[] | null
          updated_at?: string
          uploaded_by: string
          version?: number
        }
        Update: {
          access_level?: string | null
          ai_suggested_description?: string | null
          ai_suggested_tags?: string[] | null
          branch_id?: string | null
          buyer_id?: string
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
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "buyer_document_library_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_document_library_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_document_library_original_document_id_fkey"
            columns: ["original_document_id"]
            isOneToOne: false
            referencedRelation: "buyer_document_library"
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
          {
            foreignKeyName: "buyers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
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
          last_activity_at: string | null
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
          last_activity_at?: string | null
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
          last_activity_at?: string | null
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
        Relationships: [
          {
            foreignKeyName: "company_users_invitation_token_fkey"
            columns: ["invitation_token"]
            isOneToOne: false
            referencedRelation: "user_invitations"
            referencedColumns: ["token"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          created_at: string | null
          credits_amount: number
          description: string
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          stripe_payment_intent_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          credits_amount: number
          description: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          stripe_payment_intent_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          credits_amount?: number
          description?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          stripe_payment_intent_id?: string | null
          transaction_type?: string
          user_id?: string
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
          {
            foreignKeyName: "document_activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
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
      document_assignments: {
        Row: {
          assigned_by: string
          assigned_to: string
          assignment_type: string
          completed_at: string | null
          created_at: string | null
          document_upload_id: string
          due_date: string | null
          id: string
          notes: string | null
          priority: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          assignment_type: string
          completed_at?: string | null
          created_at?: string | null
          document_upload_id: string
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          assignment_type?: string
          completed_at?: string | null
          created_at?: string | null
          document_upload_id?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_assignments_document_upload_id_fkey"
            columns: ["document_upload_id"]
            isOneToOne: false
            referencedRelation: "document_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assigned_by"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assigned_by"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assigned_to"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assigned_to"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
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
          target_contact_roles:
            | Database["public"]["Enums"]["contact_role"][]
            | null
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
          target_contact_roles?:
            | Database["public"]["Enums"]["contact_role"][]
            | null
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
          target_contact_roles?:
            | Database["public"]["Enums"]["contact_role"][]
            | null
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
            foreignKeyName: "document_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
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
      document_sets: {
        Row: {
          buyer_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          document_ids: Json
          id: string
          is_default: boolean | null
          set_name: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          buyer_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          document_ids?: Json
          id?: string
          is_default?: boolean | null
          set_name: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          buyer_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          document_ids?: Json
          id?: string
          is_default?: boolean | null
          set_name?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_sets_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
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
            foreignKeyName: "document_shared_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
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
          document_name: string | null
          expiration_date: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          linked_facility_ids: string[] | null
          linked_item_ids: string[] | null
          metadata: Json | null
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
          document_name?: string | null
          expiration_date?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          linked_facility_ids?: string[] | null
          linked_item_ids?: string[] | null
          metadata?: Json | null
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
          document_name?: string | null
          expiration_date?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          linked_facility_ids?: string[] | null
          linked_item_ids?: string[] | null
          metadata?: Json | null
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
          {
            foreignKeyName: "document_uploads_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
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
      item_facility_mappings: {
        Row: {
          certifications: Json | null
          created_at: string | null
          facility_id: string
          id: string
          is_primary_producer: boolean | null
          item_id: string
          lead_time_days: number | null
          notes: string | null
          production_capacity: number | null
          updated_at: string | null
        }
        Insert: {
          certifications?: Json | null
          created_at?: string | null
          facility_id: string
          id?: string
          is_primary_producer?: boolean | null
          item_id: string
          lead_time_days?: number | null
          notes?: string | null
          production_capacity?: number | null
          updated_at?: string | null
        }
        Update: {
          certifications?: Json | null
          created_at?: string | null
          facility_id?: string
          id?: string
          is_primary_producer?: boolean | null
          item_id?: string
          lead_time_days?: number | null
          notes?: string | null
          production_capacity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_facility_mappings_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_facility_mappings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "supplier_items"
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
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
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
          ip_address: unknown
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
          ip_address?: unknown
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
          ip_address?: unknown
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
      subscription_plan_configs: {
        Row: {
          created_at: string | null
          features: Json
          id: string
          is_active: boolean | null
          max_reports_per_month: number | null
          monthly_credits: number
          monthly_price_cents: number
          plan_name: string
          plan_type: Database["public"]["Enums"]["subscription_plan_type"]
          stripe_price_id: string
          stripe_product_id: string
          target_audience: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          features?: Json
          id?: string
          is_active?: boolean | null
          max_reports_per_month?: number | null
          monthly_credits?: number
          monthly_price_cents: number
          plan_name: string
          plan_type: Database["public"]["Enums"]["subscription_plan_type"]
          stripe_price_id: string
          stripe_product_id: string
          target_audience: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          features?: Json
          id?: string
          is_active?: boolean | null
          max_reports_per_month?: number | null
          monthly_credits?: number
          monthly_price_cents?: number
          plan_name?: string
          plan_type?: Database["public"]["Enums"]["subscription_plan_type"]
          stripe_price_id?: string
          stripe_product_id?: string
          target_audience?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          monthly_credits: number
          plan_type: Database["public"]["Enums"]["subscription_plan_type"]
          price_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          monthly_credits?: number
          plan_type: Database["public"]["Enums"]["subscription_plan_type"]
          price_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          monthly_credits?: number
          plan_type?: Database["public"]["Enums"]["subscription_plan_type"]
          price_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      supplier_contacts: {
        Row: {
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          id: string
          is_primary: boolean | null
          metadata: Json | null
          roles: Database["public"]["Enums"]["contact_role"][]
          status: string | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          metadata?: Json | null
          roles?: Database["public"]["Enums"]["contact_role"][]
          status?: string | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          metadata?: Json | null
          roles?: Database["public"]["Enums"]["contact_role"][]
          status?: string | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
      supplier_items: {
        Row: {
          branch_id: string | null
          created_at: string
          description: string | null
          facility_ids: string[] | null
          id: string
          is_active: boolean | null
          item_category: string
          item_name: string
          metadata: Json | null
          primary_facility_id: string | null
          production_details: Json | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          facility_ids?: string[] | null
          id?: string
          is_active?: boolean | null
          item_category: string
          item_name: string
          metadata?: Json | null
          primary_facility_id?: string | null
          production_details?: Json | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          facility_ids?: string[] | null
          id?: string
          is_active?: boolean | null
          item_category?: string
          item_name?: string
          metadata?: Json | null
          primary_facility_id?: string | null
          production_details?: Json | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_items_primary_facility_id_fkey"
            columns: ["primary_facility_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_items_supplier_id_fkey"
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
          last_sent_at: string | null
          rejection_reason: string | null
          resent_count: number | null
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
          last_sent_at?: string | null
          rejection_reason?: string | null
          resent_count?: number | null
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
          last_sent_at?: string | null
          rejection_reason?: string | null
          resent_count?: number | null
          status?: string
          supplier_company_name?: string | null
          supplier_email?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      supplier_performance_metrics: {
        Row: {
          approved_requests: number | null
          auto_calculated_risk: string | null
          buyer_id: string
          calculated_at: string | null
          compliance_score: number
          created_at: string | null
          document_quality_score: number | null
          expired_documents: number | null
          id: string
          manual_risk_override: string | null
          metric_period_end: string
          metric_period_start: string
          on_time_submission_rate: number | null
          overdue_requests: number | null
          pending_requests: number | null
          previous_compliance_score: number | null
          rejected_requests: number | null
          response_time_avg: number | null
          risk_factors: Json | null
          risk_level: string
          risk_override_at: string | null
          risk_override_by: string | null
          risk_override_reason: string | null
          risk_score: number
          supplier_id: string
          total_requests: number | null
          trend_direction: string | null
          updated_at: string | null
        }
        Insert: {
          approved_requests?: number | null
          auto_calculated_risk?: string | null
          buyer_id: string
          calculated_at?: string | null
          compliance_score: number
          created_at?: string | null
          document_quality_score?: number | null
          expired_documents?: number | null
          id?: string
          manual_risk_override?: string | null
          metric_period_end: string
          metric_period_start: string
          on_time_submission_rate?: number | null
          overdue_requests?: number | null
          pending_requests?: number | null
          previous_compliance_score?: number | null
          rejected_requests?: number | null
          response_time_avg?: number | null
          risk_factors?: Json | null
          risk_level: string
          risk_override_at?: string | null
          risk_override_by?: string | null
          risk_override_reason?: string | null
          risk_score: number
          supplier_id: string
          total_requests?: number | null
          trend_direction?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_requests?: number | null
          auto_calculated_risk?: string | null
          buyer_id?: string
          calculated_at?: string | null
          compliance_score?: number
          created_at?: string | null
          document_quality_score?: number | null
          expired_documents?: number | null
          id?: string
          manual_risk_override?: string | null
          metric_period_end?: string
          metric_period_start?: string
          on_time_submission_rate?: number | null
          overdue_requests?: number | null
          pending_requests?: number | null
          previous_compliance_score?: number | null
          rejected_requests?: number | null
          response_time_avg?: number | null
          risk_factors?: Json | null
          risk_level?: string
          risk_override_at?: string | null
          risk_override_by?: string | null
          risk_override_reason?: string | null
          risk_score?: number
          supplier_id?: string
          total_requests?: number | null
          trend_direction?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_performance_metrics_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_performance_metrics_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "suppliers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
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
      user_credits: {
        Row: {
          available_credits: number
          created_at: string | null
          id: string
          last_reset_date: string | null
          total_consumed_credits: number
          total_purchased_credits: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          available_credits?: number
          created_at?: string | null
          id?: string
          last_reset_date?: string | null
          total_consumed_credits?: number
          total_purchased_credits?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          available_credits?: number
          created_at?: string | null
          id?: string
          last_reset_date?: string | null
          total_consumed_credits?: number
          total_purchased_credits?: number
          updated_at?: string | null
          user_id?: string
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
          invited_by: string | null
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
          invited_by?: string | null
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
          invited_by?: string | null
          role?: string
          temp_password?: string
          token?: string
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
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
      user_roles: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
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
      profiles_with_roles: {
        Row: {
          company_name: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          roles: Database["public"]["Enums"]["user_role"][] | null
          roles_from_table: string[] | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_bootstrap_admin: { Args: { p_full_name: string }; Returns: Json }
      accept_platform_admin_invitation: {
        Args: { p_full_name: string; p_token: string }
        Returns: Json
      }
      add_credits: {
        Args: {
          p_credits_amount: number
          p_description: string
          p_reference_id?: string
          p_reference_type?: string
          p_stripe_payment_intent_id?: string
          p_transaction_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      approve_document_request: {
        Args: { p_notes?: string; p_request_id: string }
        Returns: Json
      }
      assign_supplier_to_branch: {
        Args: { p_branch_id: string; p_notes?: string; p_supplier_id: string }
        Returns: Json
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
      cleanup_expired_knowledge_entries: { Args: never; Returns: number }
      consume_credits: {
        Args: {
          p_credits_amount: number
          p_description: string
          p_reference_id?: string
          p_reference_type?: string
          p_user_id: string
        }
        Returns: boolean
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
      delete_branch_with_validation: {
        Args: { p_branch_id: string }
        Returns: Json
      }
      exec_readonly: { Args: { p: Json }; Returns: Json }
      finalize_onboarding_approval: {
        Args: { p_notes?: string; p_onboarding_request_id: string }
        Returns: Json
      }
      get_admin_user_stats: {
        Args: never
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
        Args: never
        Returns: {
          company_name: string
          created_at: string
          credits_balance: number
          email: string
          full_name: string
          id: string
          last_sign_in_at: string
          roles: string[]
          subscription_status: string
          subscription_tier: string
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
        Args: never
        Returns: {
          company_id: string
          company_name: string
          company_type: string
          document_count: number
        }[]
      }
      get_platform_admin_invitations: {
        Args: never
        Returns: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          inviter_name: string
          is_used: boolean
          platform_roles: Database["public"]["Enums"]["platform_role"][]
        }[]
      }
      get_platform_admin_stats: {
        Args: never
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
        Args: never
        Returns: {
          available_credits: number
          company_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_buyer: boolean
          is_supplier: boolean
          last_sign_in_at: string
          roles: Database["public"]["Enums"]["user_role"][]
          stripe_customer_id: string
          stripe_subscription_id: string
          subscription_end_date: string
          subscription_plan_type: string
          subscription_status: string
          total_consumed_credits: number
          total_purchased_credits: number
        }[]
      }
      get_super_admin_stats: { Args: never; Returns: Json }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: {
          expires_at: string
          granted_at: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_user_roles_array: { Args: { _user_id: string }; Returns: string[] }
      grant_pg_net_access: { Args: never; Returns: undefined }
      grant_role: {
        Args: {
          _expires_at?: string
          _metadata?: Json
          _role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: string
      }
      handle_unified_connection_approval: {
        Args: { p_action: string; p_connection_id: string; p_notes?: string }
        Returns: Json
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_platform_role: {
        Args: {
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_platform_admin: { Args: { user_id?: string }; Returns: boolean }
      is_super_admin: { Args: { user_id: string }; Returns: boolean }
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
        Args: { user_id: string }
        Returns: Json
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
      remove_company_user: {
        Args: { p_company_user_id: string; p_force_delete?: boolean }
        Returns: Json
      }
      revoke_platform_admin_invitation: {
        Args: { p_invitation_id: string }
        Returns: Json
      }
      revoke_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: boolean
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
      super_admin_reset_password: {
        Args: { new_password: string; target_user_id: string }
        Returns: boolean
      }
      supplier_can_view_buyer: { Args: { buyer_id: string }; Returns: boolean }
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
    }
    Enums: {
      app_role:
        | "buyer"
        | "supplier"
        | "admin"
        | "super_admin"
        | "platform_admin"
        | "company_admin"
        | "branch_manager"
        | "document_manager"
        | "approver"
        | "viewer"
      contact_role: "recall" | "sales" | "quality" | "compliance" | "general"
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
      subscription_plan_type:
        | "buyer_basic"
        | "buyer_professional"
        | "buyer_enterprise"
        | "supplier_starter"
        | "supplier_professional"
        | "supplier_enterprise"
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
      app_role: [
        "buyer",
        "supplier",
        "admin",
        "super_admin",
        "platform_admin",
        "company_admin",
        "branch_manager",
        "document_manager",
        "approver",
        "viewer",
      ],
      contact_role: ["recall", "sales", "quality", "compliance", "general"],
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
      subscription_plan_type: [
        "buyer_basic",
        "buyer_professional",
        "buyer_enterprise",
        "supplier_starter",
        "supplier_professional",
        "supplier_enterprise",
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
