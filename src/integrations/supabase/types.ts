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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      action_acknowledgements: {
        Row: {
          acknowledged_at: string
          action_ref_id: string
          action_type: string
          id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          action_ref_id: string
          action_type: string
          id?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          action_ref_id?: string
          action_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      app_committees: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_departments: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_organization: {
        Row: {
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_projects: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_time_entries: {
        Row: {
          created_at: string
          data: Json
          id: string
          user_id: string | null
          validated: boolean
        }
        Insert: {
          created_at?: string
          data?: Json
          id: string
          user_id?: string | null
          validated?: boolean
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          user_id?: string | null
          validated?: boolean
        }
        Relationships: []
      }
      backup_schedule: {
        Row: {
          cron_job_id: number | null
          day_of_week: number
          hour: number
          id: string
          last_backup_at: string | null
          updated_at: string
        }
        Insert: {
          cron_job_id?: number | null
          day_of_week?: number
          hour?: number
          id?: string
          last_backup_at?: string | null
          updated_at?: string
        }
        Update: {
          cron_job_id?: number | null
          day_of_week?: number
          hour?: number
          id?: string
          last_backup_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      badge_entries: {
        Row: {
          badge_date: string
          created_at: string
          id: string
          swipe_1: string | null
          swipe_2: string | null
          swipe_3: string | null
          swipe_4: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          badge_date?: string
          created_at?: string
          id?: string
          swipe_1?: string | null
          swipe_2?: string | null
          swipe_3?: string | null
          swipe_4?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          badge_date?: string
          created_at?: string
          id?: string
          swipe_1?: string | null
          swipe_2?: string | null
          swipe_3?: string | null
          swipe_4?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      campaign_animations: {
        Row: {
          button_label: string | null
          button_url: string | null
          created_at: string
          created_by: string
          custom_image_url: string | null
          date_end: string | null
          date_start: string | null
          description: string
          duration_seconds: number
          id: string
          is_active: boolean
          logo_url: string | null
          max_views: number | null
          priority: number
          recurrence: string | null
          title: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          button_label?: string | null
          button_url?: string | null
          created_at?: string
          created_by: string
          custom_image_url?: string | null
          date_end?: string | null
          date_start?: string | null
          description?: string
          duration_seconds?: number
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_views?: number | null
          priority?: number
          recurrence?: string | null
          title?: string
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          button_label?: string | null
          button_url?: string | null
          created_at?: string
          created_by?: string
          custom_image_url?: string | null
          date_end?: string | null
          date_start?: string | null
          description?: string
          duration_seconds?: number
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_views?: number | null
          priority?: number
          recurrence?: string | null
          title?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaign_views: {
        Row: {
          campaign_id: string
          id: string
          user_id: string
          view_count: number
          viewed_at: string
        }
        Insert: {
          campaign_id: string
          id?: string
          user_id: string
          view_count?: number
          viewed_at?: string
        }
        Update: {
          campaign_id?: string
          id?: string
          user_id?: string
          view_count?: number
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_views_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_animations"
            referencedColumns: ["id"]
          },
        ]
      }
      department_objective_kpis: {
        Row: {
          actual_value: number | null
          created_at: string
          id: string
          label: string
          objective_id: string
          target_value: number
          unit: string
        }
        Insert: {
          actual_value?: number | null
          created_at?: string
          id?: string
          label?: string
          objective_id: string
          target_value?: number
          unit?: string
        }
        Update: {
          actual_value?: number | null
          created_at?: string
          id?: string
          label?: string
          objective_id?: string
          target_value?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_objective_kpis_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "department_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_objective_kpis_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "department_objectives_public"
            referencedColumns: ["id"]
          },
        ]
      }
      department_objectives: {
        Row: {
          achievement_pct: number
          bonus: number | null
          category: string
          created_at: string
          created_by: string
          deadline: string | null
          department_id: string
          description: string
          final_achievement_pct: number | null
          final_comment: string | null
          final_reviewed_at: string | null
          id: string
          kpi_unit: string
          s1_achievement_pct: number | null
          s1_comment: string | null
          s1_reviewed_at: string | null
          status: Database["public"]["Enums"]["objective_status"]
          title: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          year: number
        }
        Insert: {
          achievement_pct?: number
          bonus?: number | null
          category?: string
          created_at?: string
          created_by: string
          deadline?: string | null
          department_id: string
          description?: string
          final_achievement_pct?: number | null
          final_comment?: string | null
          final_reviewed_at?: string | null
          id?: string
          kpi_unit?: string
          s1_achievement_pct?: number | null
          s1_comment?: string | null
          s1_reviewed_at?: string | null
          status?: Database["public"]["Enums"]["objective_status"]
          title?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          year?: number
        }
        Update: {
          achievement_pct?: number
          bonus?: number | null
          category?: string
          created_at?: string
          created_by?: string
          deadline?: string | null
          department_id?: string
          description?: string
          final_achievement_pct?: number | null
          final_comment?: string | null
          final_reviewed_at?: string | null
          id?: string
          kpi_unit?: string
          s1_achievement_pct?: number | null
          s1_comment?: string | null
          s1_reviewed_at?: string | null
          status?: Database["public"]["Enums"]["objective_status"]
          title?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          year?: number
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      modification_requests: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          explanation: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          project_id: string
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["modification_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          explanation?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["modification_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          explanation?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["modification_status"]
          user_id?: string
        }
        Relationships: []
      }
      objective_change_audit_log: {
        Row: {
          action: string
          actor_id: string
          actor_role: string
          change_request_id: string
          created_at: string
          details: Json
          id: string
          objective_id: string
          user_id: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_role: string
          change_request_id: string
          created_at?: string
          details?: Json
          id?: string
          objective_id: string
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_role?: string
          change_request_id?: string
          created_at?: string
          details?: Json
          id?: string
          objective_id?: string
          user_id?: string
        }
        Relationships: []
      }
      objective_change_requests: {
        Row: {
          created_at: string
          explanation: string
          field_name: string | null
          id: string
          manager_comment: string | null
          manager_reviewed_at: string | null
          manager_reviewed_by: string | null
          manager_status: string
          new_value: string | null
          objective_id: string
          old_value: string | null
          request_type: string
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          explanation?: string
          field_name?: string | null
          id?: string
          manager_comment?: string | null
          manager_reviewed_at?: string | null
          manager_reviewed_by?: string | null
          manager_status?: string
          new_value?: string | null
          objective_id: string
          old_value?: string | null
          request_type?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          explanation?: string
          field_name?: string | null
          id?: string
          manager_comment?: string | null
          manager_reviewed_at?: string | null
          manager_reviewed_by?: string | null
          manager_status?: string
          new_value?: string | null
          objective_id?: string
          old_value?: string | null
          request_type?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      objectives: {
        Row: {
          achievement_pct: number
          bonus: number | null
          category: string
          created_at: string
          created_by: string
          deadline: string | null
          description: string
          final_achievement_pct: number | null
          final_comment: string | null
          final_reviewed_at: string | null
          id: string
          kpi_actual: string | null
          kpi_target: string
          kpi_unit: string
          s1_achievement_pct: number | null
          s1_comment: string | null
          s1_reviewed_at: string | null
          status: Database["public"]["Enums"]["objective_status"]
          title: string
          updated_at: string
          user_id: string
          validated_at: string | null
          validated_by: string | null
          weight: number
          year: number
        }
        Insert: {
          achievement_pct?: number
          bonus?: number | null
          category?: string
          created_at?: string
          created_by: string
          deadline?: string | null
          description?: string
          final_achievement_pct?: number | null
          final_comment?: string | null
          final_reviewed_at?: string | null
          id?: string
          kpi_actual?: string | null
          kpi_target?: string
          kpi_unit?: string
          s1_achievement_pct?: number | null
          s1_comment?: string | null
          s1_reviewed_at?: string | null
          status?: Database["public"]["Enums"]["objective_status"]
          title?: string
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validated_by?: string | null
          weight?: number
          year?: number
        }
        Update: {
          achievement_pct?: number
          bonus?: number | null
          category?: string
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string
          final_achievement_pct?: number | null
          final_comment?: string | null
          final_reviewed_at?: string | null
          id?: string
          kpi_actual?: string | null
          kpi_target?: string
          kpi_unit?: string
          s1_achievement_pct?: number | null
          s1_comment?: string | null
          s1_reviewed_at?: string | null
          status?: Database["public"]["Enums"]["objective_status"]
          title?: string
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
          weight?: number
          year?: number
        }
        Relationships: []
      }
      operational_meetings: {
        Row: {
          animator_ids: string[]
          connection_link: string | null
          created_at: string
          created_by: string
          day_of_week: number
          id: string
          participant_ids: string[]
          time_end: string | null
          time_start: string | null
          title: string
          updated_at: string
        }
        Insert: {
          animator_ids?: string[]
          connection_link?: string | null
          created_at?: string
          created_by: string
          day_of_week: number
          id?: string
          participant_ids?: string[]
          time_end?: string | null
          time_start?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          animator_ids?: string[]
          connection_link?: string | null
          created_at?: string
          created_by?: string
          day_of_week?: number
          id?: string
          participant_ids?: string[]
          time_end?: string | null
          time_start?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      other_tasks: {
        Row: {
          category: string
          created_at: string
          custom_category: string | null
          description: string
          due_date: string | null
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          custom_category?: string | null
          description?: string
          due_date?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          custom_category?: string | null
          description?: string
          due_date?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          badge_number: string | null
          blocked_at: string | null
          blocked_reason: string | null
          category: string
          created_at: string
          department_id: string | null
          email: string
          full_name: string
          hierarchy_user_id: string | null
          id: string
          is_blocked: boolean
          is_manager: boolean
          manager_bonus_budget: number | null
          must_change_password: boolean
          poste: string | null
          salary: number | null
          service: string | null
          skip_personal_planning: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          badge_number?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          category?: string
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          hierarchy_user_id?: string | null
          id?: string
          is_blocked?: boolean
          is_manager?: boolean
          manager_bonus_budget?: number | null
          must_change_password?: boolean
          poste?: string | null
          salary?: number | null
          service?: string | null
          skip_personal_planning?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          badge_number?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          category?: string
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          hierarchy_user_id?: string | null
          id?: string
          is_blocked?: boolean
          is_manager?: boolean
          manager_bonus_budget?: number | null
          must_change_password?: boolean
          poste?: string | null
          salary?: number | null
          service?: string | null
          skip_personal_planning?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_expense_types: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          project_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          project_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: []
      }
      project_expenses: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string
          expense_date: string
          expense_type_id: string | null
          id: string
          project_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by: string
          description?: string
          expense_date?: string
          expense_type_id?: string | null
          id?: string
          project_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string
          expense_date?: string
          expense_type_id?: string | null
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_expenses_expense_type_id_fkey"
            columns: ["expense_type_id"]
            isOneToOne: false
            referencedRelation: "project_expense_types"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          content: string
          created_at: string
          department_id: string
          id: string
          period_end: string
          period_start: string
          report_type: Database["public"]["Enums"]["report_type"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          department_id: string
          id?: string
          period_end: string
          period_start: string
          report_type: Database["public"]["Enums"]["report_type"]
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          department_id?: string
          id?: string
          period_end?: string
          period_start?: string
          report_type?: Database["public"]["Enums"]["report_type"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_violations: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_action: string | null
          target_table: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string
          violation_type: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_action?: string | null
          target_table?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id: string
          violation_type: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_action?: string | null
          target_table?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
          violation_type?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      team_work_schedules: {
        Row: {
          created_at: string
          id: string
          manager_id: string
          notes: string | null
          team_name: string
          updated_at: string
          week_start: string
          work_days: number[]
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id: string
          notes?: string | null
          team_name?: string
          updated_at?: string
          week_start: string
          work_days?: number[]
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string
          notes?: string | null
          team_name?: string
          updated_at?: string
          week_start?: string
          work_days?: number[]
        }
        Relationships: []
      }
      time_entry_exemptions: {
        Row: {
          created_at: string
          granted_by: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by: string
          id?: string
          reason?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      user_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      user_create_permissions: {
        Row: {
          can_create_committees: boolean
          can_create_projects: boolean
          id: string
          user_id: string
        }
        Insert: {
          can_create_committees?: boolean
          can_create_projects?: boolean
          id?: string
          user_id: string
        }
        Update: {
          can_create_committees?: boolean
          can_create_projects?: boolean
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_module_permissions: {
        Row: {
          id: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Insert: {
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Update: {
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_planner_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json | null
          id: string
          user_id: string
          week_start: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id: string
          week_start: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      weekly_planner_status: {
        Row: {
          created_at: string
          id: string
          manager_comment: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
          validated_at: string | null
          validated_by: string | null
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_comment?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validated_by?: string | null
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_comment?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
          week_start?: string
        }
        Relationships: []
      }
      weekly_todos: {
        Row: {
          completed: boolean
          created_at: string
          day_of_week: number
          deliverable_linked_to_project: boolean
          deliverable_name: string | null
          deliverable_project_id: string | null
          has_deliverable: boolean
          id: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          day_of_week: number
          deliverable_linked_to_project?: boolean
          deliverable_name?: string | null
          deliverable_project_id?: string | null
          has_deliverable?: boolean
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          day_of_week?: number
          deliverable_linked_to_project?: boolean
          deliverable_name?: string | null
          deliverable_project_id?: string | null
          has_deliverable?: boolean
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      department_objectives_public: {
        Row: {
          achievement_pct: number | null
          bonus: number | null
          category: string | null
          created_at: string | null
          created_by: string | null
          deadline: string | null
          department_id: string | null
          description: string | null
          final_achievement_pct: number | null
          final_comment: string | null
          final_reviewed_at: string | null
          id: string | null
          kpi_unit: string | null
          s1_achievement_pct: number | null
          s1_comment: string | null
          s1_reviewed_at: string | null
          status: Database["public"]["Enums"]["objective_status"] | null
          title: string | null
          updated_at: string | null
          validated_at: string | null
          validated_by: string | null
          year: number | null
        }
        Insert: {
          achievement_pct?: number | null
          bonus?: never
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          department_id?: string | null
          description?: string | null
          final_achievement_pct?: number | null
          final_comment?: string | null
          final_reviewed_at?: string | null
          id?: string | null
          kpi_unit?: string | null
          s1_achievement_pct?: number | null
          s1_comment?: string | null
          s1_reviewed_at?: string | null
          status?: Database["public"]["Enums"]["objective_status"] | null
          title?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          year?: number | null
        }
        Update: {
          achievement_pct?: number | null
          bonus?: never
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          department_id?: string | null
          description?: string | null
          final_achievement_pct?: number | null
          final_comment?: string | null
          final_reviewed_at?: string | null
          id?: string | null
          kpi_unit?: string | null
          s1_achievement_pct?: number | null
          s1_comment?: string | null
          s1_reviewed_at?: string | null
          status?: Database["public"]["Enums"]["objective_status"] | null
          title?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          year?: number | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          badge_number: string | null
          category: string | null
          created_at: string | null
          department_id: string | null
          email: string | null
          full_name: string | null
          hierarchy_user_id: string | null
          id: string | null
          is_manager: boolean | null
          must_change_password: boolean | null
          poste: string | null
          service: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          badge_number?: string | null
          category?: string | null
          created_at?: string | null
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          hierarchy_user_id?: string | null
          id?: string | null
          is_manager?: boolean | null
          must_change_password?: boolean | null
          poste?: string | null
          service?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          badge_number?: string | null
          category?: string | null
          created_at?: string | null
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          hierarchy_user_id?: string | null
          id?: string | null
          is_manager?: boolean | null
          must_change_password?: boolean | null
          poste?: string | null
          service?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_user_modules: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_module"][]
      }
      has_module_access: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _user_id: string
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
      insert_objective_audit_log: {
        Args: {
          _action: string
          _actor_id: string
          _actor_role: string
          _change_request_id: string
          _details?: Json
          _objective_id: string
          _user_id: string
        }
        Returns: string
      }
      insert_user_audit_log: {
        Args: {
          _action: string
          _actor_id: string
          _details?: Json
          _target_user_id?: string
        }
        Returns: string
      }
      insert_weekly_planner_audit: {
        Args: {
          _action: string
          _actor_id: string
          _details?: Json
          _user_id: string
          _week_start: string
        }
        Returns: string
      }
      is_manager_of: {
        Args: { _subordinate_user_id: string }
        Returns: boolean
      }
      is_user_blocked: { Args: { _user_id: string }; Returns: boolean }
      log_security_violation: {
        Args: {
          _details?: Json
          _target_action?: string
          _target_table?: string
          _violation_type: string
        }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      unblock_user: { Args: { _user_id: string }; Returns: undefined }
      update_backup_cron: {
        Args: { _day_of_week: number; _hour: number }
        Returns: undefined
      }
    }
    Enums: {
      app_module:
        | "dashboard"
        | "orgchart"
        | "roadmap"
        | "gantt"
        | "comites"
        | "projects"
        | "search"
        | "timeentry"
        | "admin"
        | "etpadmin"
        | "reports"
        | "hrperformance"
        | "projectscomites"
        | "dept_objectives"
        | "project_costs"
        | "weekly_analysis"
        | "badgemanagement"
      app_role: "admin" | "collaborator" | "admin_rapproche"
      modification_status: "pending" | "approved" | "rejected"
      objective_status:
        | "draft"
        | "pending_validation"
        | "validated"
        | "s1_review"
        | "s2_evaluation"
        | "completed"
      report_type: "weekly" | "monthly" | "semiannual"
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
      app_module: [
        "dashboard",
        "orgchart",
        "roadmap",
        "gantt",
        "comites",
        "projects",
        "search",
        "timeentry",
        "admin",
        "etpadmin",
        "reports",
        "hrperformance",
        "projectscomites",
        "dept_objectives",
        "project_costs",
        "weekly_analysis",
        "badgemanagement",
      ],
      app_role: ["admin", "collaborator", "admin_rapproche"],
      modification_status: ["pending", "approved", "rejected"],
      objective_status: [
        "draft",
        "pending_validation",
        "validated",
        "s1_review",
        "s2_evaluation",
        "completed",
      ],
      report_type: ["weekly", "monthly", "semiannual"],
    },
  },
} as const
