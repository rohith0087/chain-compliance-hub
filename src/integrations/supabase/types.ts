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
      assessments: {
        Row: {
          created_at: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      audit_engagement_summaries: {
        Row: {
          auditor_user_id: string | null
          buyer_id: string
          client_id: string
          created_at: string
          engagement_id: string | null
          id: string
          plan_md: string | null
          report_generated_at: string | null
          report_url: string | null
          risk_matrix: Json | null
          updated_at: string
        }
        Insert: {
          auditor_user_id?: string | null
          buyer_id: string
          client_id: string
          created_at?: string
          engagement_id?: string | null
          id?: string
          plan_md?: string | null
          report_generated_at?: string | null
          report_url?: string | null
          risk_matrix?: Json | null
          updated_at?: string
        }
        Update: {
          auditor_user_id?: string | null
          buyer_id?: string
          client_id?: string
          created_at?: string
          engagement_id?: string | null
          id?: string
          plan_md?: string | null
          report_generated_at?: string | null
          report_url?: string | null
          risk_matrix?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_engagement_summaries_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_findings: {
        Row: {
          buyer_id: string
          clause_reference: string | null
          created_at: string
          created_by: string | null
          description: string | null
          engagement_id: string | null
          evidence_doc_ids: string[] | null
          finding_date: string
          framework: string | null
          id: string
          recommendation: string | null
          severity: string
          status: string
          supplier_id: string
          title: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          clause_reference?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          engagement_id?: string | null
          evidence_doc_ids?: string[] | null
          finding_date?: string
          framework?: string | null
          id?: string
          recommendation?: string | null
          severity?: string
          status?: string
          supplier_id: string
          title: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          clause_reference?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          engagement_id?: string | null
          evidence_doc_ids?: string[] | null
          finding_date?: string
          framework?: string | null
          id?: string
          recommendation?: string | null
          severity?: string
          status?: string
          supplier_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_findings_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_email: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_email: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_email?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
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
      buyer_notification_settings: {
        Row: {
          buyer_id: string
          created_at: string
          enabled: boolean
          expires_soon_email: boolean
          expires_soon_in_app: boolean
          expiring_soon_days: number
          id: string
          max_notifications_per_document: number
          new_request_email_enabled: boolean
          new_request_in_app_enabled: boolean
          overdue_email: boolean
          overdue_in_app: boolean
          overdue_threshold_days: number
          updated_at: string
          urgent_days: number
          urgent_email: boolean
          urgent_in_app: boolean
        }
        Insert: {
          buyer_id: string
          created_at?: string
          enabled?: boolean
          expires_soon_email?: boolean
          expires_soon_in_app?: boolean
          expiring_soon_days?: number
          id?: string
          max_notifications_per_document?: number
          new_request_email_enabled?: boolean
          new_request_in_app_enabled?: boolean
          overdue_email?: boolean
          overdue_in_app?: boolean
          overdue_threshold_days?: number
          updated_at?: string
          urgent_days?: number
          urgent_email?: boolean
          urgent_in_app?: boolean
        }
        Update: {
          buyer_id?: string
          created_at?: string
          enabled?: boolean
          expires_soon_email?: boolean
          expires_soon_in_app?: boolean
          expiring_soon_days?: number
          id?: string
          max_notifications_per_document?: number
          new_request_email_enabled?: boolean
          new_request_in_app_enabled?: boolean
          overdue_email?: boolean
          overdue_in_app?: boolean
          overdue_threshold_days?: number
          updated_at?: string
          urgent_days?: number
          urgent_email?: boolean
          urgent_in_app?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "buyer_notification_settings_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: true
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_sample_templates: {
        Row: {
          buyer_id: string
          created_at: string | null
          display_name: string | null
          document_type: string
          id: string
          notes: string | null
          sample_file_name: string
          sample_file_path: string
          sample_file_size: number | null
          sample_mime_type: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          buyer_id: string
          created_at?: string | null
          display_name?: string | null
          document_type: string
          id?: string
          notes?: string | null
          sample_file_name: string
          sample_file_path: string
          sample_file_size?: number | null
          sample_mime_type?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          buyer_id?: string
          created_at?: string | null
          display_name?: string | null
          document_type?: string
          id?: string
          notes?: string | null
          sample_file_name?: string
          sample_file_path?: string
          sample_file_size?: number | null
          sample_mime_type?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_sample_templates_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
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
          address_line1: string | null
          address_line2: string | null
          buyer_id_number: string | null
          city: string | null
          company_logo_url: string | null
          company_name: string
          contact_email: string
          country: string | null
          created_at: string | null
          id: string
          industry: string | null
          phone: string | null
          postal_code: string | null
          profile_id: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          buyer_id_number?: string | null
          city?: string | null
          company_logo_url?: string | null
          company_name: string
          contact_email: string
          country?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_id?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          buyer_id_number?: string | null
          city?: string | null
          company_logo_url?: string | null
          company_name?: string
          contact_email?: string
          country?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_id?: string | null
          state?: string | null
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
          state: Json | null
          summary: string | null
          summary_updated_at: string | null
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
          state?: Json | null
          summary?: string | null
          summary_updated_at?: string | null
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
          state?: Json | null
          summary?: string | null
          summary_updated_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coa_analyte_results: {
        Row: {
          analyte_code: string
          analyte_name: string
          basis: string | null
          censored_threshold: number | null
          censored_type: string | null
          confidence: string
          conversion_notes: string | null
          created_at: string
          flag_reason: string | null
          id: string
          is_censored: boolean
          normalized_method: string | null
          normalized_unit: string
          numeric_value: number | null
          raw_method: string | null
          raw_unit: string
          raw_value: string
          spec_max: number | null
          spec_min: number | null
          status: string
          submission_id: string
        }
        Insert: {
          analyte_code: string
          analyte_name: string
          basis?: string | null
          censored_threshold?: number | null
          censored_type?: string | null
          confidence?: string
          conversion_notes?: string | null
          created_at?: string
          flag_reason?: string | null
          id?: string
          is_censored?: boolean
          normalized_method?: string | null
          normalized_unit: string
          numeric_value?: number | null
          raw_method?: string | null
          raw_unit: string
          raw_value: string
          spec_max?: number | null
          spec_min?: number | null
          status?: string
          submission_id: string
        }
        Update: {
          analyte_code?: string
          analyte_name?: string
          basis?: string | null
          censored_threshold?: number | null
          censored_type?: string | null
          confidence?: string
          conversion_notes?: string | null
          created_at?: string
          flag_reason?: string | null
          id?: string
          is_censored?: boolean
          normalized_method?: string | null
          normalized_unit?: string
          numeric_value?: number | null
          raw_method?: string | null
          raw_unit?: string
          raw_value?: string
          spec_max?: number | null
          spec_min?: number | null
          status?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coa_analyte_results_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "coa_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      coa_method_equivalencies: {
        Row: {
          analyte_code: string
          authority: string | null
          buyer_id: string
          created_at: string
          id: string
          is_active: boolean
          method_a: string
          method_b: string
          notes: string | null
          rule_name: string
        }
        Insert: {
          analyte_code: string
          authority?: string | null
          buyer_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          method_a: string
          method_b: string
          notes?: string | null
          rule_name: string
        }
        Update: {
          analyte_code?: string
          authority?: string | null
          buyer_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          method_a?: string
          method_b?: string
          notes?: string | null
          rule_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "coa_method_equivalencies_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      coa_policy_settings: {
        Row: {
          auto_flag_unknown_analytes: boolean
          buyer_id: string
          censored_equivalent_is_match: boolean
          created_at: string
          flag_non_convertible_units: boolean
          id: string
          require_basis_conversion: boolean
          updated_at: string
          within_spec_is_match: boolean
        }
        Insert: {
          auto_flag_unknown_analytes?: boolean
          buyer_id: string
          censored_equivalent_is_match?: boolean
          created_at?: string
          flag_non_convertible_units?: boolean
          id?: string
          require_basis_conversion?: boolean
          updated_at?: string
          within_spec_is_match?: boolean
        }
        Update: {
          auto_flag_unknown_analytes?: boolean
          buyer_id?: string
          censored_equivalent_is_match?: boolean
          created_at?: string
          flag_non_convertible_units?: boolean
          id?: string
          require_basis_conversion?: boolean
          updated_at?: string
          within_spec_is_match?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "coa_policy_settings_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: true
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      coa_schedules: {
        Row: {
          auto_remind: boolean
          buyer_id: string
          created_at: string
          custom_interval_days: number | null
          frequency: string
          grace_period_days: number
          id: string
          last_submitted_date: string | null
          next_due_date: string
          notes: string | null
          product_name: string | null
          reminder_days_before: number[] | null
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          auto_remind?: boolean
          buyer_id: string
          created_at?: string
          custom_interval_days?: number | null
          frequency?: string
          grace_period_days?: number
          id?: string
          last_submitted_date?: string | null
          next_due_date: string
          notes?: string | null
          product_name?: string | null
          reminder_days_before?: number[] | null
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          auto_remind?: boolean
          buyer_id?: string
          created_at?: string
          custom_interval_days?: number | null
          frequency?: string
          grace_period_days?: number
          id?: string
          last_submitted_date?: string | null
          next_due_date?: string
          notes?: string | null
          product_name?: string | null
          reminder_days_before?: number[] | null
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coa_schedules_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coa_schedules_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      coa_specifications: {
        Row: {
          acceptable_methods: string[] | null
          action_on_exceed: string
          analyte_code: string
          analyte_name: string
          basis: string | null
          buyer_id: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          method: string | null
          spec_max: number | null
          spec_min: number | null
          supplier_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          acceptable_methods?: string[] | null
          action_on_exceed?: string
          analyte_code: string
          analyte_name: string
          basis?: string | null
          buyer_id: string
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          method?: string | null
          spec_max?: number | null
          spec_min?: number | null
          supplier_id?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          acceptable_methods?: string[] | null
          action_on_exceed?: string
          analyte_code?: string
          analyte_name?: string
          basis?: string | null
          buyer_id?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          method?: string | null
          spec_max?: number | null
          spec_min?: number | null
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coa_specifications_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coa_specifications_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      coa_submissions: {
        Row: {
          analysis_status: string
          buyer_id: string
          comparison_results: Json | null
          created_at: string
          document_upload_id: string | null
          flags_count: number
          id: string
          lot_number: string | null
          normalized_data: Json | null
          overall_score: number | null
          pass_fail: string | null
          product_name: string | null
          raw_extracted_data: Json | null
          schedule_id: string | null
          submission_date: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          analysis_status?: string
          buyer_id: string
          comparison_results?: Json | null
          created_at?: string
          document_upload_id?: string | null
          flags_count?: number
          id?: string
          lot_number?: string | null
          normalized_data?: Json | null
          overall_score?: number | null
          pass_fail?: string | null
          product_name?: string | null
          raw_extracted_data?: Json | null
          schedule_id?: string | null
          submission_date?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          analysis_status?: string
          buyer_id?: string
          comparison_results?: Json | null
          created_at?: string
          document_upload_id?: string | null
          flags_count?: number
          id?: string
          lot_number?: string | null
          normalized_data?: Json | null
          overall_score?: number | null
          pass_fail?: string | null
          product_name?: string | null
          raw_extracted_data?: Json | null
          schedule_id?: string | null
          submission_date?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coa_submissions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coa_submissions_document_upload_id_fkey"
            columns: ["document_upload_id"]
            isOneToOne: false
            referencedRelation: "document_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coa_submissions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "coa_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coa_submissions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_audit_logs: {
        Row: {
          action_type: string
          attachment_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          message_id: string | null
          metadata: Json | null
          thread_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          attachment_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          message_id?: string | null
          metadata?: Json | null
          thread_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          attachment_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          message_id?: string | null
          metadata?: Json | null
          thread_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_audit_logs_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "message_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_audit_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_audit_logs_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "communication_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          document_tags: Json | null
          edited_at: string | null
          id: string
          is_edited: boolean
          is_system_message: boolean
          mentions: Json | null
          sender_company_id: string
          sender_id: string
          sender_type: Database["public"]["Enums"]["participant_type"]
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          document_tags?: Json | null
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          is_system_message?: boolean
          mentions?: Json | null
          sender_company_id: string
          sender_id: string
          sender_type: Database["public"]["Enums"]["participant_type"]
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          document_tags?: Json | null
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          is_system_message?: boolean
          mentions?: Json | null
          sender_company_id?: string
          sender_id?: string
          sender_type?: Database["public"]["Enums"]["participant_type"]
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "communication_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_threads: {
        Row: {
          buyer_branch_id: string | null
          buyer_id: string
          created_at: string
          created_by: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          status: Database["public"]["Enums"]["thread_status"]
          supplier_branch_id: string | null
          supplier_id: string
          thread_context: Database["public"]["Enums"]["thread_context_type"]
          thread_title: string | null
          updated_at: string
        }
        Insert: {
          buyer_branch_id?: string | null
          buyer_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          status?: Database["public"]["Enums"]["thread_status"]
          supplier_branch_id?: string | null
          supplier_id: string
          thread_context?: Database["public"]["Enums"]["thread_context_type"]
          thread_title?: string | null
          updated_at?: string
        }
        Update: {
          buyer_branch_id?: string | null
          buyer_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          status?: Database["public"]["Enums"]["thread_status"]
          supplier_branch_id?: string | null
          supplier_id?: string
          thread_context?: Database["public"]["Enums"]["thread_context_type"]
          thread_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_threads_buyer_branch_id_fkey"
            columns: ["buyer_branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_threads_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_threads_supplier_branch_id_fkey"
            columns: ["supplier_branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_threads_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
      company_requirement_configurations: {
        Row: {
          buyer_id: string
          configuration: Json
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          requirement_id: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          configuration?: Json
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          requirement_id: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          configuration?: Json
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          requirement_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_requirement_configurations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_requirement_configurations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_requirement_configurations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_requirement_configurations_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
        ]
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
          document_request_id: string | null
          document_upload_id: string | null
          id: string
          metadata: Json | null
          notes: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          document_request_id?: string | null
          document_upload_id?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          document_request_id?: string | null
          document_upload_id?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_activity_logs_document_request_id_fkey"
            columns: ["document_request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
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
      document_expiry_notifications: {
        Row: {
          buyer_id: string
          channel: string
          days_until_expiry: number | null
          document_name: string | null
          document_upload_id: string
          expiration_date: string | null
          id: string
          notification_tier: string
          sent_at: string
          supplier_id: string | null
        }
        Insert: {
          buyer_id: string
          channel: string
          days_until_expiry?: number | null
          document_name?: string | null
          document_upload_id: string
          expiration_date?: string | null
          id?: string
          notification_tier: string
          sent_at?: string
          supplier_id?: string | null
        }
        Update: {
          buyer_id?: string
          channel?: string
          days_until_expiry?: number | null
          document_name?: string | null
          document_upload_id?: string
          expiration_date?: string | null
          id?: string
          notification_tier?: string
          sent_at?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_expiry_notifications_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_expiry_notifications_document_upload_id_fkey"
            columns: ["document_upload_id"]
            isOneToOne: false
            referencedRelation: "document_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_expiry_notifications_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
          sample_file_name: string | null
          sample_file_path: string | null
          sample_file_size: number | null
          sample_mime_type: string | null
          sample_uploaded_at: string | null
          sample_uploaded_by: string | null
          status: Database["public"]["Enums"]["request_status"] | null
          supplier_branch_id: string | null
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
          sample_file_name?: string | null
          sample_file_path?: string | null
          sample_file_size?: number | null
          sample_mime_type?: string | null
          sample_uploaded_at?: string | null
          sample_uploaded_by?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          supplier_branch_id?: string | null
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
          sample_file_name?: string | null
          sample_file_path?: string | null
          sample_file_size?: number | null
          sample_mime_type?: string | null
          sample_uploaded_at?: string | null
          sample_uploaded_by?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          supplier_branch_id?: string | null
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
            foreignKeyName: "document_requests_sample_uploaded_by_fkey"
            columns: ["sample_uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_sample_uploaded_by_fkey"
            columns: ["sample_uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_supplier_branch_id_fkey"
            columns: ["supplier_branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
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
          last_used_at: string | null
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
          last_used_at?: string | null
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
          last_used_at?: string | null
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
          content_extracted_at: string | null
          content_extraction_status: string | null
          content_summary: string | null
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
          content_extracted_at?: string | null
          content_extraction_status?: string | null
          content_summary?: string | null
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
          content_extracted_at?: string | null
          content_extraction_status?: string | null
          content_summary?: string | null
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
      email_audit_logs: {
        Row: {
          action_type: string | null
          body_preview: string | null
          buyer_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          recipient_email: string
          recipient_name: string | null
          resend_id: string | null
          sender_email: string | null
          sender_id: string | null
          sender_name: string | null
          status: string | null
          subject: string
          supplier_id: string | null
        }
        Insert: {
          action_type?: string | null
          body_preview?: string | null
          buyer_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email: string
          recipient_name?: string | null
          resend_id?: string | null
          sender_email?: string | null
          sender_id?: string | null
          sender_name?: string | null
          status?: string | null
          subject: string
          supplier_id?: string | null
        }
        Update: {
          action_type?: string | null
          body_preview?: string | null
          buyer_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string
          recipient_name?: string | null
          resend_id?: string | null
          sender_email?: string | null
          sender_id?: string | null
          sender_name?: string | null
          status?: string | null
          subject?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_audit_logs_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_audit_logs_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_audit_logs_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_audit_logs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_drafts: {
        Row: {
          body: string
          created_at: string
          expires_at: string
          id: string
          sender_company: string | null
          sender_context: string | null
          sender_name: string | null
          sent_at: string | null
          status: string
          subject: string
          to_email: string
          to_name: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          expires_at?: string
          id?: string
          sender_company?: string | null
          sender_context?: string | null
          sender_name?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
          to_name?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          expires_at?: string
          id?: string
          sender_company?: string | null
          sender_context?: string | null
          sender_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
          to_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      entity_relationships: {
        Row: {
          assessment_id: string | null
          confidence: number | null
          created_at: string | null
          details: Json | null
          id: string
          relationship_type: string
          source_entity: string
          source_url: string | null
          target_entity: string
        }
        Insert: {
          assessment_id?: string | null
          confidence?: number | null
          created_at?: string | null
          details?: Json | null
          id?: string
          relationship_type: string
          source_entity: string
          source_url?: string | null
          target_entity: string
        }
        Update: {
          assessment_id?: string | null
          confidence?: number | null
          created_at?: string | null
          details?: Json | null
          id?: string
          relationship_type?: string
          source_entity?: string
          source_url?: string | null
          target_entity?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_relationships_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_claim_corrections: {
        Row: {
          claim_id: string
          corrected_by: string
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          reason: string | null
        }
        Insert: {
          claim_id: string
          corrected_by: string
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Update: {
          claim_id?: string
          corrected_by?: string
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_claim_corrections_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "evidence_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_claim_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_claim_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_claims: {
        Row: {
          buyer_id: string
          certificate_number: string | null
          confidence: number | null
          covered_facilities: Json
          covered_products: Json
          created_at: string
          document_upload_id: string
          expiry_date: string | null
          extraction_job_id: string | null
          extraction_model_version: string
          id: string
          is_duplicate_of: string | null
          issue_date: string | null
          issuer: string | null
          rejected_reason: string | null
          source_page: number | null
          source_text: string | null
          standards: string[]
          status: string
          supplier_id: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          buyer_id: string
          certificate_number?: string | null
          confidence?: number | null
          covered_facilities?: Json
          covered_products?: Json
          created_at?: string
          document_upload_id: string
          expiry_date?: string | null
          extraction_job_id?: string | null
          extraction_model_version: string
          id?: string
          is_duplicate_of?: string | null
          issue_date?: string | null
          issuer?: string | null
          rejected_reason?: string | null
          source_page?: number | null
          source_text?: string | null
          standards?: string[]
          status?: string
          supplier_id: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          buyer_id?: string
          certificate_number?: string | null
          confidence?: number | null
          covered_facilities?: Json
          covered_products?: Json
          created_at?: string
          document_upload_id?: string
          expiry_date?: string | null
          extraction_job_id?: string | null
          extraction_model_version?: string
          id?: string
          is_duplicate_of?: string | null
          issue_date?: string | null
          issuer?: string | null
          rejected_reason?: string | null
          source_page?: number | null
          source_text?: string | null
          standards?: string[]
          status?: string
          supplier_id?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_claims_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_claims_document_upload_id_fkey"
            columns: ["document_upload_id"]
            isOneToOne: false
            referencedRelation: "document_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_claims_extraction_job_id_fkey"
            columns: ["extraction_job_id"]
            isOneToOne: false
            referencedRelation: "evidence_extraction_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_claims_is_duplicate_of_fkey"
            columns: ["is_duplicate_of"]
            isOneToOne: false
            referencedRelation: "evidence_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_claims_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_claims_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_claims_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_conflicts: {
        Row: {
          claim_id: string
          conflict_type: string
          conflicting_claim_id: string
          created_at: string
          id: string
          resolution_notes: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          claim_id: string
          conflict_type: string
          conflicting_claim_id: string
          created_at?: string
          id?: string
          resolution_notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          claim_id?: string
          conflict_type?: string
          conflicting_claim_id?: string
          created_at?: string
          id?: string
          resolution_notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_conflicts_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "evidence_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_conflicts_conflicting_claim_id_fkey"
            columns: ["conflicting_claim_id"]
            isOneToOne: false
            referencedRelation: "evidence_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_conflicts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_conflicts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_extraction_jobs: {
        Row: {
          attempts: number
          buyer_id: string
          completed_at: string | null
          created_at: string
          document_upload_id: string
          extraction_model_version: string
          id: string
          idempotency_key: string
          last_error: string | null
          max_attempts: number
          scheduled_at: string
          started_at: string | null
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          buyer_id: string
          completed_at?: string | null
          created_at?: string
          document_upload_id: string
          extraction_model_version: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          max_attempts?: number
          scheduled_at?: string
          started_at?: string | null
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          buyer_id?: string
          completed_at?: string | null
          created_at?: string
          document_upload_id?: string
          extraction_model_version?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          max_attempts?: number
          scheduled_at?: string
          started_at?: string | null
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_extraction_jobs_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_extraction_jobs_document_upload_id_fkey"
            columns: ["document_upload_id"]
            isOneToOne: false
            referencedRelation: "document_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_extraction_jobs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          default_enabled: boolean
          description: string
          key: string
          lifecycle: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_enabled?: boolean
          description: string
          key: string
          lifecycle?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_enabled?: boolean
          description?: string
          key?: string
          lifecycle?: string
          updated_at?: string
        }
        Relationships: []
      }
      impersonation_logs: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          impersonated_company_id: string
          impersonated_company_type: string
          impersonated_user_id: string | null
          ip_address: string | null
          metadata: Json | null
          started_at: string
          super_admin_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          impersonated_company_id: string
          impersonated_company_type: string
          impersonated_user_id?: string | null
          ip_address?: string | null
          metadata?: Json | null
          started_at?: string
          super_admin_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          impersonated_company_id?: string
          impersonated_company_type?: string
          impersonated_user_id?: string | null
          ip_address?: string | null
          metadata?: Json | null
          started_at?: string
          super_admin_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_logs_impersonated_user_id_fkey"
            columns: ["impersonated_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_logs_impersonated_user_id_fkey"
            columns: ["impersonated_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
        ]
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
      legacy_requirement_mappings: {
        Row: {
          buyer_id: string
          created_at: string
          evidence_definition: Json
          id: string
          requirement_key: string
          source_id: string
          source_type: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          evidence_definition?: Json
          id?: string
          requirement_key: string
          source_id: string
          source_type: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          evidence_definition?: Json
          id?: string
          requirement_key?: string
          source_id?: string
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_requirement_mappings_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string
          download_count: number
          file_name: string
          file_path: string
          file_size: number
          id: string
          message_id: string
          mime_type: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          download_count?: number
          file_name: string
          file_path: string
          file_size: number
          id?: string
          message_id: string
          mime_type: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          download_count?: number
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          message_id?: string
          mime_type?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_read_receipts: {
        Row: {
          id: string
          message_id: string
          profile_id: string
          read_at: string
        }
        Insert: {
          id?: string
          message_id: string
          profile_id: string
          read_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          profile_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_read_receipts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_read_receipts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
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
          display_order: number | null
          document_name: string
          document_type: string
          id: string
          is_required: boolean
          onboarding_request_id: string
          template_file_name: string | null
          template_file_path: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          document_name: string
          document_type: string
          id?: string
          is_required?: boolean
          onboarding_request_id: string
          template_file_name?: string | null
          template_file_path?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          document_name?: string
          document_type?: string
          id?: string
          is_required?: boolean
          onboarding_request_id?: string
          template_file_name?: string | null
          template_file_path?: string | null
          updated_at?: string | null
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
          previous_submission_id: string | null
          rejection_reason: string | null
          requirement_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          submitted_by: string
          unavailability_reason: string | null
          updated_at: string
          version: number | null
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
          previous_submission_id?: string | null
          rejection_reason?: string | null
          requirement_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_by: string
          unavailability_reason?: string | null
          updated_at?: string
          version?: number | null
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
          previous_submission_id?: string | null
          rejection_reason?: string | null
          requirement_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_by?: string
          unavailability_reason?: string | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_document_submissions_previous_submission_id_fkey"
            columns: ["previous_submission_id"]
            isOneToOne: false
            referencedRelation: "onboarding_document_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_document_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_document_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_form_fields: {
        Row: {
          created_at: string
          field_category: string | null
          field_description: string | null
          field_label: string
          field_options: Json | null
          field_order: number
          field_type: string
          id: string
          is_required: boolean
          onboarding_request_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          field_category?: string | null
          field_description?: string | null
          field_label: string
          field_options?: Json | null
          field_order?: number
          field_type: string
          id?: string
          is_required?: boolean
          onboarding_request_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          field_category?: string | null
          field_description?: string | null
          field_label?: string
          field_options?: Json | null
          field_order?: number
          field_type?: string
          id?: string
          is_required?: boolean
          onboarding_request_id?: string
          updated_at?: string | null
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
      organization_feature_flags: {
        Row: {
          configured_at: string
          configured_by: string | null
          enabled: boolean
          expires_at: string | null
          feature_key: string
          metadata: Json
          organization_id: string
          organization_type: string
        }
        Insert: {
          configured_at?: string
          configured_by?: string | null
          enabled: boolean
          expires_at?: string | null
          feature_key: string
          metadata?: Json
          organization_id: string
          organization_type: string
        }
        Update: {
          configured_at?: string
          configured_by?: string | null
          enabled?: boolean
          expires_at?: string | null
          feature_key?: string
          metadata?: Json
          organization_id?: string
          organization_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_feature_flags_configured_by_fkey"
            columns: ["configured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_feature_flags_configured_by_fkey"
            columns: ["configured_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_feature_flags_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["key"]
          },
        ]
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
          avatar_url: string | null
          company_name: string | null
          created_at: string | null
          email: string
          first_login_at: string | null
          full_name: string
          id: string
          mfa_enabled: boolean | null
          mfa_grace_period_expires_at: string | null
          roles: Database["public"]["Enums"]["user_role"][]
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string | null
          email: string
          first_login_at?: string | null
          full_name: string
          id: string
          mfa_enabled?: boolean | null
          mfa_grace_period_expires_at?: string | null
          roles?: Database["public"]["Enums"]["user_role"][]
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string
          first_login_at?: string | null
          full_name?: string
          id?: string
          mfa_enabled?: boolean | null
          mfa_grace_period_expires_at?: string | null
          roles?: Database["public"]["Enums"]["user_role"][]
          updated_at?: string | null
        }
        Relationships: []
      }
      requirement_evaluation_results: {
        Row: {
          citation: string | null
          created_at: string
          effective_from: string | null
          effective_to: string | null
          evaluation_id: string
          explanation: string
          framework_code: string
          framework_version: string
          id: string
          legacy_mapping_id: string | null
          matched_facts: Json
          missing_inputs: Json
          outcome: string
          required_evidence: Json
          requirement_key: string
          requirement_version_id: string | null
          source_url: string | null
          title: string
        }
        Insert: {
          citation?: string | null
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          evaluation_id: string
          explanation: string
          framework_code: string
          framework_version: string
          id?: string
          legacy_mapping_id?: string | null
          matched_facts?: Json
          missing_inputs?: Json
          outcome: string
          required_evidence?: Json
          requirement_key: string
          requirement_version_id?: string | null
          source_url?: string | null
          title: string
        }
        Update: {
          citation?: string | null
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          evaluation_id?: string
          explanation?: string
          framework_code?: string
          framework_version?: string
          id?: string
          legacy_mapping_id?: string | null
          matched_facts?: Json
          missing_inputs?: Json
          outcome?: string
          required_evidence?: Json
          requirement_key?: string
          requirement_version_id?: string | null
          source_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_evaluation_results_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "requirement_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_evaluation_results_legacy_mapping_id_fkey"
            columns: ["legacy_mapping_id"]
            isOneToOne: false
            referencedRelation: "legacy_requirement_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_evaluation_results_requirement_version_id_fkey"
            columns: ["requirement_version_id"]
            isOneToOne: false
            referencedRelation: "requirement_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_evaluations: {
        Row: {
          actor_id: string
          buyer_id: string
          correlation_id: string
          created_at: string
          effective_at: string
          evaluator_version: string
          id: string
          idempotency_key: string
          input_snapshot: Json
          request_hash: string
          subject_id: string
          subject_type: string
        }
        Insert: {
          actor_id: string
          buyer_id: string
          correlation_id: string
          created_at?: string
          effective_at: string
          evaluator_version: string
          id?: string
          idempotency_key: string
          input_snapshot: Json
          request_hash: string
          subject_id: string
          subject_type: string
        }
        Update: {
          actor_id?: string
          buyer_id?: string
          correlation_id?: string
          created_at?: string
          effective_at?: string
          evaluator_version?: string
          id?: string
          idempotency_key?: string
          input_snapshot?: Json
          request_hash?: string
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_evaluations_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_evaluations_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_evaluations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_framework_versions: {
        Row: {
          content_hash: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          framework_id: string
          id: string
          published_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_urls: Json
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          framework_id: string
          id?: string
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_urls?: Json
          status?: string
          updated_at?: string
          version: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          framework_id?: string
          id?: string
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_urls?: Json
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_framework_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_framework_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_framework_versions_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "requirement_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_framework_versions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_framework_versions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_frameworks: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          framework_type: string
          id: string
          name: string
          owner_buyer_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          framework_type: string
          id?: string
          name: string
          owner_buyer_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          framework_type?: string
          id?: string
          name?: string
          owner_buyer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_frameworks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_frameworks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_frameworks_owner_buyer_id_fkey"
            columns: ["owner_buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_jurisdictions: {
        Row: {
          code: string
          country_code: string
          created_at: string
          id: string
          name: string
          subdivision_code: string | null
        }
        Insert: {
          code: string
          country_code: string
          created_at?: string
          id?: string
          name: string
          subdivision_code?: string | null
        }
        Update: {
          code?: string
          country_code?: string
          created_at?: string
          id?: string
          name?: string
          subdivision_code?: string | null
        }
        Relationships: []
      }
      requirement_versions: {
        Row: {
          applicability_rule: Json
          citation: string | null
          created_at: string
          description: string
          effective_from: string
          effective_to: string | null
          explanation_template: string
          framework_version_id: string
          id: string
          jurisdiction_id: string | null
          required_evidence: Json
          requirement_id: string
          source_url: string | null
          title: string
        }
        Insert: {
          applicability_rule: Json
          citation?: string | null
          created_at?: string
          description: string
          effective_from: string
          effective_to?: string | null
          explanation_template: string
          framework_version_id: string
          id?: string
          jurisdiction_id?: string | null
          required_evidence?: Json
          requirement_id: string
          source_url?: string | null
          title: string
        }
        Update: {
          applicability_rule?: Json
          citation?: string | null
          created_at?: string
          description?: string
          effective_from?: string
          effective_to?: string | null
          explanation_template?: string
          framework_version_id?: string
          id?: string
          jurisdiction_id?: string | null
          required_evidence?: Json
          requirement_id?: string
          source_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_versions_framework_version_id_fkey"
            columns: ["framework_version_id"]
            isOneToOne: false
            referencedRelation: "requirement_framework_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_versions_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "requirement_jurisdictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_versions_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      requirements: {
        Row: {
          created_at: string
          framework_id: string
          id: string
          stable_key: string
          subject_types: string[]
        }
        Insert: {
          created_at?: string
          framework_id: string
          id?: string
          stable_key: string
          subject_types: string[]
        }
        Update: {
          created_at?: string
          framework_id?: string
          id?: string
          stable_key?: string
          subject_types?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "requirements_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "requirement_frameworks"
            referencedColumns: ["id"]
          },
        ]
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
      supplier_notification_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          new_request_email_enabled: boolean
          new_request_in_app_enabled: boolean
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          new_request_email_enabled?: boolean
          new_request_in_app_enabled?: boolean
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          new_request_email_enabled?: boolean
          new_request_in_app_enabled?: boolean
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_notification_settings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: true
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
          address_line1: string | null
          address_line2: string | null
          auto_approve_connections: boolean | null
          city: string | null
          company_logo_url: string | null
          company_name: string
          contact_email: string
          country: string | null
          created_at: string | null
          description: string | null
          id: string
          industry: string | null
          phone: string | null
          postal_code: string | null
          profile_id: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          auto_approve_connections?: boolean | null
          city?: string | null
          company_logo_url?: string | null
          company_name: string
          contact_email: string
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_id?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          auto_approve_connections?: boolean | null
          city?: string | null
          company_logo_url?: string | null
          company_name?: string
          contact_email?: string
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_id?: string | null
          state?: string | null
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
      support_tickets: {
        Row: {
          assigned_to: string | null
          company_id: string | null
          company_name: string | null
          created_at: string | null
          description: string
          has_unread_response: boolean | null
          id: string
          ip_address: string | null
          metadata: Json | null
          page_route: string | null
          page_url: string | null
          priority: string
          resolution_notes: string | null
          resolved_at: string | null
          source: string
          status: string
          subject: string
          updated_at: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
          user_type: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string | null
          description: string
          has_unread_response?: boolean | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          page_route?: string | null
          page_url?: string | null
          priority?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          source: string
          status?: string
          subject: string
          updated_at?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_type?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string | null
          description?: string
          has_unread_response?: boolean | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          page_route?: string | null
          page_url?: string | null
          priority?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          subject?: string
          updated_at?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
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
      thread_participants: {
        Row: {
          branch_id: string | null
          company_id: string
          id: string
          is_active: boolean
          joined_at: string
          last_read_at: string | null
          left_at: string | null
          notifications_enabled: boolean
          participant_type: Database["public"]["Enums"]["participant_type"]
          profile_id: string
          thread_id: string
          unread_count: number
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          id?: string
          is_active?: boolean
          joined_at?: string
          last_read_at?: string | null
          left_at?: string | null
          notifications_enabled?: boolean
          participant_type: Database["public"]["Enums"]["participant_type"]
          profile_id: string
          thread_id: string
          unread_count?: number
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          last_read_at?: string | null
          left_at?: string | null
          notifications_enabled?: boolean
          participant_type?: Database["public"]["Enums"]["participant_type"]
          profile_id?: string
          thread_id?: string
          unread_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "thread_participants_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "communication_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_responses: {
        Row: {
          attachments: Json | null
          author_id: string | null
          author_name: string | null
          author_type: string
          content: string
          created_at: string | null
          id: string
          is_internal: boolean | null
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          author_id?: string | null
          author_name?: string | null
          author_type: string
          content: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          author_id?: string | null
          author_name?: string | null
          author_type?: string
          content?: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_responses_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
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
      approve_connection_with_onboarding: {
        Args: {
          p_connection_id: string
          p_notes?: string
          p_onboarding_type: string
        }
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
      claim_evidence_extraction_jobs_v1: {
        Args: { p_batch_size: number }
        Returns: {
          attempts: number
          buyer_id: string
          completed_at: string | null
          created_at: string
          document_upload_id: string
          extraction_model_version: string
          id: string
          idempotency_key: string
          last_error: string | null
          max_attempts: number
          scheduled_at: string
          started_at: string | null
          status: string
          supplier_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "evidence_extraction_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_expired_knowledge_entries: { Args: never; Returns: number }
      create_notification_v1: {
        Args: {
          p_message: string
          p_reference_id?: string
          p_target_user_id: string
          p_title: string
          p_type: string
        }
        Returns: string
      }
      verify_evidence_claim_v1: {
        Args: { p_claim_id: string }
        Returns: undefined
      }
      reject_evidence_claim_v1: {
        Args: { p_claim_id: string; p_reason: string }
        Returns: undefined
      }
      correct_evidence_claim_v1: {
        Args: {
          p_claim_id: string
          p_field_name: string
          p_new_value: string
          p_reason: string
        }
        Returns: undefined
      }
      resolve_evidence_conflict_v1: {
        Args: { p_conflict_id: string; p_resolution_notes: string }
        Returns: undefined
      }
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
      correct_evidence_claim_v1: {
        Args: {
          p_claim_id: string
          p_field_name: string
          p_new_value: string
          p_reason: string
        }
        Returns: undefined
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
      create_notification_v1: {
        Args: {
          p_message: string
          p_reference_id?: string
          p_target_user_id: string
          p_title: string
          p_type: string
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
      get_connected_supplier_ids_for_buyer: { Args: never; Returns: string[] }
      get_latest_expiring_documents: {
        Args: never
        Returns: {
          created_at: string
          document_name: string
          document_requests: Json
          expiration_date: string
          file_name: string
          id: string
          request_id: string
        }[]
      }
      get_onboarding_supplier_ids_for_buyer: { Args: never; Returns: string[] }
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
          buyer_id: string
          company_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_buyer: boolean
          is_supplier: boolean
          last_sign_in_at: string
          roles: string[]
          stripe_customer_id: string
          stripe_subscription_id: string
          subscription_end_date: string
          subscription_plan_type: string
          subscription_status: string
          supplier_id: string
          total_consumed_credits: number
          total_purchased_credits: number
        }[]
      }
      get_super_admin_stats: { Args: never; Returns: Json }
      get_user_buyer_ids: { Args: never; Returns: string[] }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: {
          expires_at: string
          granted_at: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_user_roles_array: { Args: { _user_id: string }; Returns: string[] }
      get_user_supplier_id: { Args: never; Returns: string }
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
      has_company_role: {
        Args: {
          _company_id: string
          _company_type: string
          _required_role: Database["public"]["Enums"]["user_role"]
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
      publish_requirement_framework_version_v1: {
        Args: { p_actor_id: string; p_framework_version_id: string }
        Returns: undefined
      }
      record_evidence_claim_v1: {
        Args: { p_claim: Json; p_job_id: string }
        Returns: string
      }
      record_requirement_evaluation_v1: {
        Args: { p_evaluation: Json; p_results: Json }
        Returns: string
      }
      reject_document_request: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: Json
      }
      reject_evidence_claim_v1: {
        Args: { p_claim_id: string; p_reason: string }
        Returns: undefined
      }
      remove_company_user: {
        Args: { p_company_user_id: string; p_force_delete?: boolean }
        Returns: Json
      }
      resolve_evidence_conflict_v1: {
        Args: { p_conflict_id: string; p_resolution_notes: string }
        Returns: undefined
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
      search_suppliers_for_discovery: {
        Args: {
          p_industry_filter?: string
          p_limit?: number
          p_search_query?: string
        }
        Returns: {
          company_logo_url: string
          company_name: string
          id: string
          industry: string
        }[]
      }
      send_supplier_connection_request: {
        Args: {
          p_buyer_id: string
          p_created_by: string
          p_supplier_id: string
        }
        Returns: Json
      }
      super_admin_reset_password: {
        Args: { new_password: string; target_user_id: string }
        Returns: boolean
      }
      supplier_can_view_buyer: { Args: { buyer_id: string }; Returns: boolean }
      user_can_act_for_buyer: { Args: { _buyer_id: string }; Returns: boolean }
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
      verify_evidence_claim_v1: {
        Args: { p_claim_id: string }
        Returns: undefined
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
      participant_type: "buyer" | "supplier"
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
        | "withdrawn"
      subscription_plan_type:
        | "buyer_basic"
        | "buyer_professional"
        | "buyer_enterprise"
        | "supplier_starter"
        | "supplier_professional"
        | "supplier_enterprise"
      thread_context_type: "general" | "compliance" | "onboarding" | "renewals"
      thread_status: "active" | "archived"
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
      participant_type: ["buyer", "supplier"],
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
        "withdrawn",
      ],
      subscription_plan_type: [
        "buyer_basic",
        "buyer_professional",
        "buyer_enterprise",
        "supplier_starter",
        "supplier_professional",
        "supplier_enterprise",
      ],
      thread_context_type: ["general", "compliance", "onboarding", "renewals"],
      thread_status: ["active", "archived"],
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
