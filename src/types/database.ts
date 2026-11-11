/** Generated from the migrated, isolated PostgreSQL schema by npm run db:types.
 * Do not edit by hand. Types describe structure; RLS and grants enforce authorization.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: number;
          actor_user_id: string | null;
          actor_role: string | null;
          action: string;
          resource_type: string | null;
          resource_id: string | null;
          outcome: string;
          request_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: never;
          actor_user_id?: string | null;
          actor_role?: string | null;
          action: string;
          resource_type?: string | null;
          resource_id?: string | null;
          outcome?: string;
          request_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: never;
          actor_user_id?: string | null;
          actor_role?: string | null;
          action?: string;
          resource_type?: string | null;
          resource_id?: string | null;
          outcome?: string;
          request_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      document_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          is_active: boolean;
          is_system: boolean;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          is_active?: boolean;
          is_system?: boolean;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          is_active?: boolean;
          is_system?: boolean;
          display_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      document_submissions: {
        Row: {
          id: string;
          document_id: string;
          version_no: number;
          status: Database["public"]["Enums"]["submission_status"];
          submitted_by: string;
          title: string;
          category_id: string;
          custom_document_type: string | null;
          document_date: string | null;
          issuing_institution: string | null;
          description: string | null;
          original_filename: string;
          mime_type: string;
          file_size_bytes: number;
          sha256: string;
          storage_bucket: string;
          storage_path: string;
          policy_version: string;
          consented_at: string;
          submitted_at: string;
          created_at: string;
          submitter_display_name: string | null;
        };
        Insert: {
          id?: string;
          document_id: string;
          version_no: number;
          status?: Database["public"]["Enums"]["submission_status"];
          submitted_by: string;
          title: string;
          category_id: string;
          custom_document_type?: string | null;
          document_date?: string | null;
          issuing_institution?: string | null;
          description?: string | null;
          original_filename: string;
          mime_type: string;
          file_size_bytes: number;
          sha256: string;
          storage_bucket?: string;
          storage_path: string;
          policy_version: string;
          consented_at: string;
          submitted_at?: string;
          created_at?: string;
          submitter_display_name?: string | null;
        };
        Update: {
          id?: string;
          document_id?: string;
          version_no?: number;
          status?: Database["public"]["Enums"]["submission_status"];
          submitted_by?: string;
          title?: string;
          category_id?: string;
          custom_document_type?: string | null;
          document_date?: string | null;
          issuing_institution?: string | null;
          description?: string | null;
          original_filename?: string;
          mime_type?: string;
          file_size_bytes?: number;
          sha256?: string;
          storage_bucket?: string;
          storage_path?: string;
          policy_version?: string;
          consented_at?: string;
          submitted_at?: string;
          created_at?: string;
          submitter_display_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "document_submissions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "document_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_submissions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submissions_document_owner_fk";
            columns: ["document_id", "submitted_by"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          owner_id: string;
          current_version_no: number;
          current_status: Database["public"]["Enums"]["document_status"];
          created_at: string;
          updated_at: string;
          registered_at: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          revocation_reason: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          current_version_no?: number;
          current_status?: Database["public"]["Enums"]["document_status"];
          created_at?: string;
          updated_at?: string;
          registered_at?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          revocation_reason?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          current_version_no?: number;
          current_status?: Database["public"]["Enums"]["document_status"];
          created_at?: string;
          updated_at?: string;
          registered_at?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          revocation_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "documents_current_submission_fk";
            columns: ["id", "current_version_no"];
            isOneToOne: false;
            referencedRelation: "document_submissions";
            referencedColumns: ["document_id", "version_no"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string;
          target_path: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          body: string;
          target_path?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          body?: string;
          target_path?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          avatar_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      review_decisions: {
        Row: {
          submission_id: string;
          reviewer_id: string;
          decision: Database["public"]["Enums"]["review_decision_type"];
          checklist: Json;
          decision_note: string | null;
          created_at: string;
        };
        Insert: {
          submission_id: string;
          reviewer_id: string;
          decision: Database["public"]["Enums"]["review_decision_type"];
          checklist: Json;
          decision_note?: string | null;
          created_at?: string;
        };
        Update: {
          submission_id?: string;
          reviewer_id?: string;
          decision?: Database["public"]["Enums"]["review_decision_type"];
          checklist?: Json;
          decision_note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_decisions_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: true;
            referencedRelation: "document_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      signing_artifacts: {
        Row: {
          receipt_id: string;
          state: string;
          storage_path: string | null;
          file_size_bytes: number | null;
          artifact_sha256: string | null;
          page_count: number | null;
          failure_code: string | null;
          ready_at: string | null;
          updated_at: string;
        };
        Insert: {
          receipt_id: string;
          state?: string;
          storage_path?: string | null;
          file_size_bytes?: number | null;
          artifact_sha256?: string | null;
          page_count?: number | null;
          failure_code?: string | null;
          ready_at?: string | null;
          updated_at?: string;
        };
        Update: {
          receipt_id?: string;
          state?: string;
          storage_path?: string | null;
          file_size_bytes?: number | null;
          artifact_sha256?: string | null;
          page_count?: number | null;
          failure_code?: string | null;
          ready_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "signing_artifacts_receipt_id_fkey";
            columns: ["receipt_id"];
            isOneToOne: true;
            referencedRelation: "signing_receipts";
            referencedColumns: ["id"];
          },
        ];
      };
      signing_decisions: {
        Row: {
          id: string;
          request_id: string;
          source_version_id: string;
          actor_id: string;
          action: string;
          reason: string | null;
          policy_version: string;
          consent: boolean;
          authentication_method: string;
          decided_at: string;
        };
        Insert: {
          id: string;
          request_id: string;
          source_version_id: string;
          actor_id: string;
          action: string;
          reason?: string | null;
          policy_version: string;
          consent: boolean;
          authentication_method?: string;
          decided_at: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          source_version_id?: string;
          actor_id?: string;
          action?: string;
          reason?: string | null;
          policy_version?: string;
          consent?: boolean;
          authentication_method?: string;
          decided_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "signing_decisions_request_id_source_version_id_actor_id_fkey";
            columns: ["request_id", "source_version_id", "actor_id"];
            isOneToOne: false;
            referencedRelation: "signing_requests";
            referencedColumns: ["id", "source_version_id", "recipient_id"];
          },
        ];
      };
      signing_document_versions: {
        Row: {
          id: string;
          document_id: string;
          owner_id: string;
          version_no: number;
          title: string;
          category_id: string;
          custom_document_type: string | null;
          document_date: string | null;
          issuing_institution: string | null;
          description: string | null;
          original_filename: string;
          file_size_bytes: number;
          source_sha256: string;
          storage_path: string;
          upload_policy_version: string;
          consented_at: string;
          created_at: string;
        };
        Insert: {
          id: string;
          document_id: string;
          owner_id: string;
          version_no: number;
          title: string;
          category_id: string;
          custom_document_type?: string | null;
          document_date?: string | null;
          issuing_institution?: string | null;
          description?: string | null;
          original_filename: string;
          file_size_bytes: number;
          source_sha256: string;
          storage_path: string;
          upload_policy_version: string;
          consented_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          owner_id?: string;
          version_no?: number;
          title?: string;
          category_id?: string;
          custom_document_type?: string | null;
          document_date?: string | null;
          issuing_institution?: string | null;
          description?: string | null;
          original_filename?: string;
          file_size_bytes?: number;
          source_sha256?: string;
          storage_path?: string;
          upload_policy_version?: string;
          consented_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "signing_document_versions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "document_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signing_document_versions_document_id_owner_id_fkey";
            columns: ["document_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "signing_documents";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      signing_documents: {
        Row: { id: string; owner_id: string; created_at: string };
        Insert: { id: string; owner_id: string; created_at?: string };
        Update: { id?: string; owner_id?: string; created_at?: string };
        Relationships: [];
      };
      signing_receipt_layouts: {
        Row: {
          receipt_id: string;
          layout_version: string;
          placement_plan: Json;
          plan_sha256: string;
        };
        Insert: {
          receipt_id: string;
          layout_version?: string;
          placement_plan: Json;
          plan_sha256: string;
        };
        Update: {
          receipt_id?: string;
          layout_version?: string;
          placement_plan?: Json;
          plan_sha256?: string;
        };
        Relationships: [
          {
            foreignKeyName: "signing_receipt_layouts_receipt_id_layout_version_fkey";
            columns: ["receipt_id", "layout_version"];
            isOneToOne: false;
            referencedRelation: "signing_receipts";
            referencedColumns: ["id", "layout_version"];
          },
        ];
      };
      signing_receipts: {
        Row: {
          id: string;
          decision_id: string;
          request_id: string;
          source_version_id: string;
          owner_id: string;
          recipient_id: string;
          decision_action: string;
          signer_name: string;
          signer_code: string;
          owner_name: string;
          document_title: string;
          source_sha256: string;
          policy_version: string;
          layout_version: string;
          decided_at: string;
        };
        Insert: {
          id: string;
          decision_id: string;
          request_id: string;
          source_version_id: string;
          owner_id: string;
          recipient_id: string;
          decision_action?: string;
          signer_name: string;
          signer_code: string;
          owner_name: string;
          document_title: string;
          source_sha256: string;
          policy_version: string;
          layout_version?: string;
          decided_at: string;
        };
        Update: {
          id?: string;
          decision_id?: string;
          request_id?: string;
          source_version_id?: string;
          owner_id?: string;
          recipient_id?: string;
          decision_action?: string;
          signer_name?: string;
          signer_code?: string;
          owner_name?: string;
          document_title?: string;
          source_sha256?: string;
          policy_version?: string;
          layout_version?: string;
          decided_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "signing_receipts_decision_id_request_id_source_version_id__fkey";
            columns: [
              "decision_id",
              "request_id",
              "source_version_id",
              "recipient_id",
              "decision_action",
            ];
            isOneToOne: false;
            referencedRelation: "signing_decisions";
            referencedColumns: [
              "id",
              "request_id",
              "source_version_id",
              "actor_id",
              "action",
            ];
          },
          {
            foreignKeyName: "signing_receipts_request_id_source_version_id_owner_id_rec_fkey";
            columns: [
              "request_id",
              "source_version_id",
              "owner_id",
              "recipient_id",
            ];
            isOneToOne: false;
            referencedRelation: "signing_requests";
            referencedColumns: [
              "id",
              "source_version_id",
              "owner_id",
              "recipient_id",
            ];
          },
        ];
      };
      signing_requests: {
        Row: {
          id: string;
          document_id: string;
          source_version_id: string;
          owner_id: string;
          recipient_id: string;
          owner_display_name: string;
          recipient_display_name: string;
          status: string;
          sent_at: string;
          expires_at: string;
          cancelled_at: string | null;
          sharing_policy_version: string;
          sharing_consented_at: string;
        };
        Insert: {
          id: string;
          document_id: string;
          source_version_id: string;
          owner_id: string;
          recipient_id: string;
          owner_display_name: string;
          recipient_display_name: string;
          status: string;
          sent_at: string;
          expires_at: string;
          cancelled_at?: string | null;
          sharing_policy_version: string;
          sharing_consented_at: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          source_version_id?: string;
          owner_id?: string;
          recipient_id?: string;
          owner_display_name?: string;
          recipient_display_name?: string;
          status?: string;
          sent_at?: string;
          expires_at?: string;
          cancelled_at?: string | null;
          sharing_policy_version?: string;
          sharing_consented_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "signing_requests_source_version_id_document_id_owner_id_fkey";
            columns: ["source_version_id", "document_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "signing_document_versions";
            referencedColumns: ["id", "document_id", "owner_id"];
          },
        ];
      };
      signing_user_identifiers: {
        Row: { user_id: string; code: string; created_at: string };
        Insert: { user_id: string; code: string; created_at?: string };
        Update: { user_id?: string; code?: string; created_at?: string };
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          granted_by: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          granted_by?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          granted_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      verification_credentials: {
        Row: {
          id: string;
          document_id: string;
          code_digest: string;
          key_version: number;
          issued_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          code_digest: string;
          key_version?: number;
          issued_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          code_digest?: string;
          key_version?: number;
          issued_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "verification_credentials_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: true;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      verification_events: {
        Row: {
          id: string;
          user_id: string;
          method: Database["public"]["Enums"]["verification_method"];
          result: Database["public"]["Enums"]["verification_result"];
          matched_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          method: Database["public"]["Enums"]["verification_method"];
          result: Database["public"]["Enums"]["verification_result"];
          matched_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          method?: Database["public"]["Enums"]["verification_method"];
          result?: Database["public"]["Enums"]["verification_result"];
          matched_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      workspace_documents: {
        Row: {
          id: string | null;
          owner_id: string | null;
          current_version_no: number | null;
          current_status: Database["public"]["Enums"]["document_status"] | null;
          created_at: string | null;
          updated_at: string | null;
          registered_at: string | null;
          revoked_at: string | null;
          revocation_reason: string | null;
          submission_id: string | null;
          title: string | null;
          category_id: string | null;
          submitted_at: string | null;
          category_name: string | null;
          category_slug: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      apply_review_decision: {
        Args: {
          p_reviewer_id: string | null;
          p_submission_id: string | null;
          p_decision:
            Database["public"]["Enums"]["review_decision_type"] | null;
          p_checklist: Json | null;
          p_note: string | null;
          p_credential_id?: string | null;
          p_code_digest?: string | null;
          p_key_version?: number | null;
        };
        Returns: Json;
      };
      approve_signing_request_with_placement: {
        Args: {
          p_actor_id: string | null;
          p_request_id: string | null;
          p_decision_id: string | null;
          p_source_version_id: string | null;
          p_source_sha256: string | null;
          p_policy_version: string | null;
          p_consent: boolean | null;
          p_confirmed: boolean | null;
          p_confirmation_digest: string | null;
          p_placement_plan: Json | null;
        };
        Returns: Json;
      };
      cancel_signing_request: {
        Args: { p_actor_id: string | null; p_request_id: string | null };
        Returns: Json;
      };
      claim_signing_render: {
        Args: { p_actor_id: string | null; p_receipt_id: string | null };
        Returns: Json;
      };
      complete_signing_render: {
        Args: {
          p_actor_id: string | null;
          p_receipt_id: string | null;
          p_claim_token: string | null;
          p_storage_path: string | null;
          p_file_size_bytes: number | null;
          p_artifact_sha256: string | null;
          p_page_count: number | null;
        };
        Returns: boolean;
      };
      consume_auth_rate_limit: {
        Args: { p_action: string | null; p_key_digest: string | null };
        Returns: boolean;
      };
      consume_auth_recovery_grant: {
        Args: {
          p_token_digest: string | null;
          p_user_id: string | null;
          p_session_id: string | null;
        };
        Returns: boolean;
      };
      consume_document_upload_limit: {
        Args: { p_key_digest: string | null; p_global_digest: string | null };
        Returns: boolean;
      };
      consume_signing_operation_limit: {
        Args: {
          p_action: string | null;
          p_key_digest: string | null;
          p_global_digest: string | null;
        };
        Returns: boolean;
      };
      consume_signing_r3_limit: {
        Args: {
          p_action: string | null;
          p_key_digest: string | null;
          p_global_digest: string | null;
        };
        Returns: boolean;
      };
      create_document_resubmission: {
        Args: {
          p_owner_id: string | null;
          p_document_id: string | null;
          p_submission_id: string | null;
          p_title: string | null;
          p_category_id: string | null;
          p_custom_document_type: string | null;
          p_document_date: string | null;
          p_issuing_institution: string | null;
          p_description: string | null;
          p_original_filename: string | null;
          p_file_size_bytes: number | null;
          p_sha256: string | null;
          p_storage_path: string | null;
          p_policy_version: string | null;
          p_consent: boolean | null;
        };
        Returns: Json;
      };
      create_document_submission: {
        Args: {
          p_owner_id: string | null;
          p_document_id: string | null;
          p_submission_id: string | null;
          p_title: string | null;
          p_category_id: string | null;
          p_custom_document_type: string | null;
          p_document_date: string | null;
          p_issuing_institution: string | null;
          p_description: string | null;
          p_original_filename: string | null;
          p_file_size_bytes: number | null;
          p_sha256: string | null;
          p_storage_path: string | null;
          p_policy_version: string | null;
          p_consent: boolean | null;
        };
        Returns: Json;
      };
      create_signing_draft: {
        Args: {
          p_actor_id: string | null;
          p_document_id: string | null;
          p_version_id: string | null;
          p_title: string | null;
          p_category_id: string | null;
          p_custom_document_type: string | null;
          p_document_date: string | null;
          p_issuing_institution: string | null;
          p_description: string | null;
          p_original_filename: string | null;
          p_file_size_bytes: number | null;
          p_source_sha256: string | null;
          p_storage_path: string | null;
          p_upload_policy_version: string | null;
          p_upload_consent: boolean | null;
        };
        Returns: Json;
      };
      decide_signing_request: {
        Args: {
          p_actor_id: string | null;
          p_request_id: string | null;
          p_decision_id: string | null;
          p_source_version_id: string | null;
          p_source_sha256: string | null;
          p_action: string | null;
          p_reason: string | null;
          p_policy_version: string | null;
          p_consent: boolean | null;
          p_confirmed: boolean | null;
          p_confirmation_digest: string | null;
        };
        Returns: Json;
      };
      fail_signing_render: {
        Args: {
          p_actor_id: string | null;
          p_receipt_id: string | null;
          p_claim_token: string | null;
          p_failure_code: string | null;
        };
        Returns: boolean;
      };
      get_operations_snapshot: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_own_workspace_counts: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      is_auth_recovery_grant_valid: {
        Args: {
          p_token_digest: string | null;
          p_user_id: string | null;
          p_session_id: string | null;
        };
        Returns: boolean;
      };
      issue_auth_recovery_grant: {
        Args: {
          p_token_digest: string | null;
          p_user_id: string | null;
          p_session_id: string | null;
        };
        Returns: undefined;
      };
      lookup_signing_recipient: {
        Args: { p_actor_id: string | null; p_code: string | null };
        Returns: Json;
      };
      send_signing_request: {
        Args: {
          p_actor_id: string | null;
          p_request_id: string | null;
          p_source_version_id: string | null;
          p_recipient_code: string | null;
          p_recipient_id: string | null;
          p_sharing_policy_version: string | null;
          p_sharing_consent: boolean | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      app_role: "user" | "reviewer" | "platform_admin";
      document_status:
        | "pending_review"
        | "revision_requested"
        | "rejected"
        | "approved"
        | "revoked";
      review_decision_type: "approved" | "revision_requested" | "rejected";
      submission_status:
        "pending_review" | "revision_requested" | "rejected" | "approved";
      verification_method: "qr" | "code" | "hash";
      verification_result:
        | "single_match"
        | "multiple_matches"
        | "no_match"
        | "revoked_match"
        | "invalid_file"
        | "error";
    };
    CompositeTypes: Record<string, never>;
  };
};
export type AppRole = Database["public"]["Enums"]["app_role"];
export type DocumentStatus = Database["public"]["Enums"]["document_status"];
