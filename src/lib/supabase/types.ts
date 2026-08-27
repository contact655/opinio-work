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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      ow_activities: {
        Row: {
          actor_user_id: string | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          target_id: string | null
          target_type: string | null
          type: string
        }
        Insert: {
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          target_id?: string | null
          target_type?: string | null
          type: string
        }
        Update: {
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          target_id?: string | null
          target_type?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_activities_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_agent_agencies: {
        Row: {
          agency_name: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          memo: string | null
          updated_at: string
        }
        Insert: {
          agency_name: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          memo?: string | null
          updated_at?: string
        }
        Update: {
          agency_name?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          memo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_agent_agencies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_agent_agencies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_agent_agencies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_agent_contacts: {
        Row: {
          agency_id: string
          created_at: string
          email: string
          id: string
          is_primary: boolean
          name: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          email: string
          id?: string
          is_primary?: boolean
          name: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          email?: string
          id?: string
          is_primary?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_agent_contacts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "ow_agent_agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_agent_jobs: {
        Row: {
          agency_id: string
          created_at: string
          job_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          job_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_agent_jobs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "ow_agent_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_agent_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_agent_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_applications: {
        Row: {
          applied_at: string | null
          candidate_id: string | null
          first_round_at: string | null
          id: string
          job_id: string | null
          message: string | null
          offer_at: string | null
          rejected_at: string | null
          replied_at: string | null
          second_round_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          applied_at?: string | null
          candidate_id?: string | null
          first_round_at?: string | null
          id?: string
          job_id?: string | null
          message?: string | null
          offer_at?: string | null
          rejected_at?: string | null
          replied_at?: string | null
          second_round_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          applied_at?: string | null
          candidate_id?: string | null
          first_round_at?: string | null
          id?: string
          job_id?: string | null
          message?: string | null
          offer_at?: string | null
          rejected_at?: string | null
          replied_at?: string | null
          second_round_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_articles: {
        Row: {
          body_blocks: Json | null
          chapters: Json | null
          company_gradient_text: string | null
          company_id: string | null
          company_initial_text: string | null
          company_name_text: string | null
          company_slug: string | null
          created_at: string | null
          editor_note: string | null
          editor_outro: string | null
          eyecatch_gradient: string | null
          id: string
          is_published: boolean | null
          published_at: string | null
          qa_blocks: Json | null
          quote: string | null
          read_min: number | null
          related_article_slugs: string[] | null
          related_job_ids: string[] | null
          slug: string
          subject_freeze: Json | null
          subjects_freeze: Json | null
          subtitle: string | null
          themes_blocks: Json | null
          title: string
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          body_blocks?: Json | null
          chapters?: Json | null
          company_gradient_text?: string | null
          company_id?: string | null
          company_initial_text?: string | null
          company_name_text?: string | null
          company_slug?: string | null
          created_at?: string | null
          editor_note?: string | null
          editor_outro?: string | null
          eyecatch_gradient?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          qa_blocks?: Json | null
          quote?: string | null
          read_min?: number | null
          related_article_slugs?: string[] | null
          related_job_ids?: string[] | null
          slug: string
          subject_freeze?: Json | null
          subjects_freeze?: Json | null
          subtitle?: string | null
          themes_blocks?: Json | null
          title: string
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          body_blocks?: Json | null
          chapters?: Json | null
          company_gradient_text?: string | null
          company_id?: string | null
          company_initial_text?: string | null
          company_name_text?: string | null
          company_slug?: string | null
          created_at?: string | null
          editor_note?: string | null
          editor_outro?: string | null
          eyecatch_gradient?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          qa_blocks?: Json | null
          quote?: string | null
          read_min?: number | null
          related_article_slugs?: string[] | null
          related_job_ids?: string[] | null
          slug?: string
          subject_freeze?: Json | null
          subjects_freeze?: Json | null
          subtitle?: string | null
          themes_blocks?: Json | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_articles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_articles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_articles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_articles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_bookmarks: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_business_domains: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      ow_career_agent_leads: {
        Row: {
          admin_note: string | null
          assigned_to: string | null
          created_at: string
          current_job: string
          email: string
          id: string
          message: string | null
          name: string
          status: string
          timeline: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          assigned_to?: string | null
          created_at?: string
          current_job: string
          email: string
          id?: string
          message?: string | null
          name: string
          status?: string
          timeline: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          assigned_to?: string | null
          created_at?: string
          current_job?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          status?: string
          timeline?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_career_agent_leads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_career_profiles: {
        Row: {
          birth_year: number | null
          created_at: string
          gender: string | null
          headline: string | null
          id: string
          is_published: boolean
          updated_at: string
          user_id: string
          years_of_experience: number | null
        }
        Insert: {
          birth_year?: number | null
          created_at?: string
          gender?: string | null
          headline?: string | null
          id?: string
          is_published?: boolean
          updated_at?: string
          user_id: string
          years_of_experience?: number | null
        }
        Update: {
          birth_year?: number | null
          created_at?: string
          gender?: string | null
          headline?: string | null
          id?: string
          is_published?: boolean
          updated_at?: string
          user_id?: string
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_career_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_casual_meetings: {
        Row: {
          assignee_user_id: string | null
          company_id: string
          company_internal_memo: string | null
          company_read_at: string | null
          completed_at: string | null
          contact_email: string
          conversation_id: string | null
          created_at: string
          id: string
          intent: string | null
          interest_reason: string | null
          job_id: string | null
          preferred_format: string | null
          questions: string | null
          requested_user_id: string | null
          share_profile: boolean
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignee_user_id?: string | null
          company_id: string
          company_internal_memo?: string | null
          company_read_at?: string | null
          completed_at?: string | null
          contact_email: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          interest_reason?: string | null
          job_id?: string | null
          preferred_format?: string | null
          questions?: string | null
          requested_user_id?: string | null
          share_profile?: boolean
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignee_user_id?: string | null
          company_id?: string
          company_internal_memo?: string | null
          company_read_at?: string | null
          completed_at?: string | null
          contact_email?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          interest_reason?: string | null
          job_id?: string | null
          preferred_format?: string | null
          questions?: string | null
          requested_user_id?: string | null
          share_profile?: boolean
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_casual_meetings_assignee_user_id_fkey"
            columns: ["assignee_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_casual_meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_casual_meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_casual_meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_casual_meetings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ow_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_casual_meetings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_casual_meetings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_casual_meetings_requested_user_id_fkey"
            columns: ["requested_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_casual_meetings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_companies: {
        Row: {
          about_markdown: string | null
          accepting_casual_meetings: boolean
          annual_hire_count: string | null
          annual_holiday_days: number | null
          arr_scale: string | null
          autonomy_level: string | null
          availability_days: string[] | null
          availability_notes: string | null
          availability_times: string[] | null
          avg_age: number | null
          avg_overtime: number | null
          avg_overtime_hours: string | null
          avg_salary: string | null
          avg_selection_weeks: number | null
          avg_tenure: string | null
          avg_tenure_years: string | null
          benefits: string[] | null
          biz_model_deal_size: string | null
          biz_model_new_pct: number | null
          biz_model_note: string | null
          biz_model_types: string[] | null
          bonus_times: number | null
          branch_locations: string[] | null
          brand_color: string | null
          brand_name: string | null
          business_model: string | null
          business_stage: string | null
          canonical_company_id: string | null
          capital_notes: string | null
          capital_type: string | null
          careers_url: string | null
          casual_interview_url: string | null
          ceo_name: string | null
          childcare_leave_rate: string | null
          company_features: Json | null
          contracted_at: string | null
          core_time: string | null
          cover_color: string | null
          created_at: string | null
          culture_description: string | null
          culture_keywords: string[] | null
          current_member_count: number
          customer_cases: Json | null
          description: string | null
          draft_data: Json | null
          employee_count: string | null
          engagement_status: Database["public"]["Enums"]["engagement_status_enum"]
          engineer_ratio: string | null
          english_frequency: string | null
          established_at: string | null
          evaluation_cycle: string | null
          evaluation_system: string | null
          female_manager_ratio: number | null
          female_ratio: string | null
          fit_negatives: Json | null
          fit_positives: Json | null
          flex_time: boolean | null
          founded_at: string | null
          founded_year: number | null
          funding_stage: string | null
          funding_total: string | null
          gender_ratio: string | null
          global_employee_count: string | null
          has_book_allowance: boolean | null
          has_health_support: boolean | null
          has_housing_allowance: boolean | null
          has_incentive: boolean | null
          has_internal_transfer: boolean | null
          has_learning_support: boolean | null
          has_meal_allowance: boolean | null
          has_stock_option: boolean | null
          headcount_3y_ago: number | null
          header_image_url: string | null
          headquarters_address: string | null
          id: string
          incentive_detail: string | null
          industry: string | null
          industry_id: string | null
          is_approved: boolean
          is_foreign: boolean
          is_published: boolean
          is_test: boolean
          jobs_public: boolean
          linkedin_url: string | null
          listed_exchange: string | null
          listing_status: Database["public"]["Enums"]["listing_status_enum"]
          location: string | null
          logo_gradient: string | null
          logo_letter: string | null
          logo_url: string | null
          main_customers: string[] | null
          main_products: string[] | null
          management_style: string | null
          market_customer_size: string[] | null
          market_deal_days: number | null
          market_decision_maker: string | null
          market_industry_focus: string[] | null
          market_note: string | null
          maternity_leave_female: number | null
          maternity_leave_male: number | null
          mid_career_ratio: number | null
          mission: string | null
          name: string
          name_en: string | null
          nearest_station: string | null
          normalized_name: string | null
          notification_emails: string[] | null
          numbers_updated_at: string | null
          obog_count: number
          office_count: string | null
          office_days_per_week: string | null
          official_language: string | null
          one_on_one_freq: string | null
          opinio_comment: string | null
          org_teams: Json | null
          paid_leave_rate: number | null
          parent_company_country: string | null
          parent_company_name: string | null
          phase: string | null
          prev_career_note: string | null
          published_at: string | null
          reality_disclosure: Json | null
          recruiter_avatar_url: string | null
          recruiter_message: string | null
          recruiter_name: string | null
          recruiter_role: string | null
          remote_rate: number | null
          remote_work_status: string | null
          saas_category_id: string | null
          salary_raise_frequency: string | null
          salary_review_times: number | null
          search_aliases: string | null
          selection_count: number | null
          selection_flow: string[] | null
          show_fit_negatives: boolean
          side_job_ok: boolean | null
          slug: string | null
          sort_order: number | null
          source: string | null
          status: string | null
          tagline: string | null
          top_down_ratio: number | null
          turnover_rate: string | null
          updated_at: string | null
          url: string | null
          user_id: string | null
          verified_at: string | null
          why_join: string | null
          work_time_system: string | null
          workstyle_description: string | null
          x_url: string | null
        }
        Insert: {
          about_markdown?: string | null
          accepting_casual_meetings?: boolean
          annual_hire_count?: string | null
          annual_holiday_days?: number | null
          arr_scale?: string | null
          autonomy_level?: string | null
          availability_days?: string[] | null
          availability_notes?: string | null
          availability_times?: string[] | null
          avg_age?: number | null
          avg_overtime?: number | null
          avg_overtime_hours?: string | null
          avg_salary?: string | null
          avg_selection_weeks?: number | null
          avg_tenure?: string | null
          avg_tenure_years?: string | null
          benefits?: string[] | null
          biz_model_deal_size?: string | null
          biz_model_new_pct?: number | null
          biz_model_note?: string | null
          biz_model_types?: string[] | null
          bonus_times?: number | null
          branch_locations?: string[] | null
          brand_color?: string | null
          brand_name?: string | null
          business_model?: string | null
          business_stage?: string | null
          canonical_company_id?: string | null
          capital_notes?: string | null
          capital_type?: string | null
          careers_url?: string | null
          casual_interview_url?: string | null
          ceo_name?: string | null
          childcare_leave_rate?: string | null
          company_features?: Json | null
          contracted_at?: string | null
          core_time?: string | null
          cover_color?: string | null
          created_at?: string | null
          culture_description?: string | null
          culture_keywords?: string[] | null
          current_member_count?: number
          customer_cases?: Json | null
          description?: string | null
          draft_data?: Json | null
          employee_count?: string | null
          engagement_status?: Database["public"]["Enums"]["engagement_status_enum"]
          engineer_ratio?: string | null
          english_frequency?: string | null
          established_at?: string | null
          evaluation_cycle?: string | null
          evaluation_system?: string | null
          female_manager_ratio?: number | null
          female_ratio?: string | null
          fit_negatives?: Json | null
          fit_positives?: Json | null
          flex_time?: boolean | null
          founded_at?: string | null
          founded_year?: number | null
          funding_stage?: string | null
          funding_total?: string | null
          gender_ratio?: string | null
          global_employee_count?: string | null
          has_book_allowance?: boolean | null
          has_health_support?: boolean | null
          has_housing_allowance?: boolean | null
          has_incentive?: boolean | null
          has_internal_transfer?: boolean | null
          has_learning_support?: boolean | null
          has_meal_allowance?: boolean | null
          has_stock_option?: boolean | null
          headcount_3y_ago?: number | null
          header_image_url?: string | null
          headquarters_address?: string | null
          id?: string
          incentive_detail?: string | null
          industry?: string | null
          industry_id?: string | null
          is_approved?: boolean
          is_foreign?: boolean
          is_published?: boolean
          is_test?: boolean
          jobs_public?: boolean
          linkedin_url?: string | null
          listed_exchange?: string | null
          listing_status?: Database["public"]["Enums"]["listing_status_enum"]
          location?: string | null
          logo_gradient?: string | null
          logo_letter?: string | null
          logo_url?: string | null
          main_customers?: string[] | null
          main_products?: string[] | null
          management_style?: string | null
          market_customer_size?: string[] | null
          market_deal_days?: number | null
          market_decision_maker?: string | null
          market_industry_focus?: string[] | null
          market_note?: string | null
          maternity_leave_female?: number | null
          maternity_leave_male?: number | null
          mid_career_ratio?: number | null
          mission?: string | null
          name: string
          name_en?: string | null
          nearest_station?: string | null
          normalized_name?: string | null
          notification_emails?: string[] | null
          numbers_updated_at?: string | null
          obog_count?: number
          office_count?: string | null
          office_days_per_week?: string | null
          official_language?: string | null
          one_on_one_freq?: string | null
          opinio_comment?: string | null
          org_teams?: Json | null
          paid_leave_rate?: number | null
          parent_company_country?: string | null
          parent_company_name?: string | null
          phase?: string | null
          prev_career_note?: string | null
          published_at?: string | null
          reality_disclosure?: Json | null
          recruiter_avatar_url?: string | null
          recruiter_message?: string | null
          recruiter_name?: string | null
          recruiter_role?: string | null
          remote_rate?: number | null
          remote_work_status?: string | null
          saas_category_id?: string | null
          salary_raise_frequency?: string | null
          salary_review_times?: number | null
          search_aliases?: string | null
          selection_count?: number | null
          selection_flow?: string[] | null
          show_fit_negatives?: boolean
          side_job_ok?: boolean | null
          slug?: string | null
          sort_order?: number | null
          source?: string | null
          status?: string | null
          tagline?: string | null
          top_down_ratio?: number | null
          turnover_rate?: string | null
          updated_at?: string | null
          url?: string | null
          user_id?: string | null
          verified_at?: string | null
          why_join?: string | null
          work_time_system?: string | null
          workstyle_description?: string | null
          x_url?: string | null
        }
        Update: {
          about_markdown?: string | null
          accepting_casual_meetings?: boolean
          annual_hire_count?: string | null
          annual_holiday_days?: number | null
          arr_scale?: string | null
          autonomy_level?: string | null
          availability_days?: string[] | null
          availability_notes?: string | null
          availability_times?: string[] | null
          avg_age?: number | null
          avg_overtime?: number | null
          avg_overtime_hours?: string | null
          avg_salary?: string | null
          avg_selection_weeks?: number | null
          avg_tenure?: string | null
          avg_tenure_years?: string | null
          benefits?: string[] | null
          biz_model_deal_size?: string | null
          biz_model_new_pct?: number | null
          biz_model_note?: string | null
          biz_model_types?: string[] | null
          bonus_times?: number | null
          branch_locations?: string[] | null
          brand_color?: string | null
          brand_name?: string | null
          business_model?: string | null
          business_stage?: string | null
          canonical_company_id?: string | null
          capital_notes?: string | null
          capital_type?: string | null
          careers_url?: string | null
          casual_interview_url?: string | null
          ceo_name?: string | null
          childcare_leave_rate?: string | null
          company_features?: Json | null
          contracted_at?: string | null
          core_time?: string | null
          cover_color?: string | null
          created_at?: string | null
          culture_description?: string | null
          culture_keywords?: string[] | null
          current_member_count?: number
          customer_cases?: Json | null
          description?: string | null
          draft_data?: Json | null
          employee_count?: string | null
          engagement_status?: Database["public"]["Enums"]["engagement_status_enum"]
          engineer_ratio?: string | null
          english_frequency?: string | null
          established_at?: string | null
          evaluation_cycle?: string | null
          evaluation_system?: string | null
          female_manager_ratio?: number | null
          female_ratio?: string | null
          fit_negatives?: Json | null
          fit_positives?: Json | null
          flex_time?: boolean | null
          founded_at?: string | null
          founded_year?: number | null
          funding_stage?: string | null
          funding_total?: string | null
          gender_ratio?: string | null
          global_employee_count?: string | null
          has_book_allowance?: boolean | null
          has_health_support?: boolean | null
          has_housing_allowance?: boolean | null
          has_incentive?: boolean | null
          has_internal_transfer?: boolean | null
          has_learning_support?: boolean | null
          has_meal_allowance?: boolean | null
          has_stock_option?: boolean | null
          headcount_3y_ago?: number | null
          header_image_url?: string | null
          headquarters_address?: string | null
          id?: string
          incentive_detail?: string | null
          industry?: string | null
          industry_id?: string | null
          is_approved?: boolean
          is_foreign?: boolean
          is_published?: boolean
          is_test?: boolean
          jobs_public?: boolean
          linkedin_url?: string | null
          listed_exchange?: string | null
          listing_status?: Database["public"]["Enums"]["listing_status_enum"]
          location?: string | null
          logo_gradient?: string | null
          logo_letter?: string | null
          logo_url?: string | null
          main_customers?: string[] | null
          main_products?: string[] | null
          management_style?: string | null
          market_customer_size?: string[] | null
          market_deal_days?: number | null
          market_decision_maker?: string | null
          market_industry_focus?: string[] | null
          market_note?: string | null
          maternity_leave_female?: number | null
          maternity_leave_male?: number | null
          mid_career_ratio?: number | null
          mission?: string | null
          name?: string
          name_en?: string | null
          nearest_station?: string | null
          normalized_name?: string | null
          notification_emails?: string[] | null
          numbers_updated_at?: string | null
          obog_count?: number
          office_count?: string | null
          office_days_per_week?: string | null
          official_language?: string | null
          one_on_one_freq?: string | null
          opinio_comment?: string | null
          org_teams?: Json | null
          paid_leave_rate?: number | null
          parent_company_country?: string | null
          parent_company_name?: string | null
          phase?: string | null
          prev_career_note?: string | null
          published_at?: string | null
          reality_disclosure?: Json | null
          recruiter_avatar_url?: string | null
          recruiter_message?: string | null
          recruiter_name?: string | null
          recruiter_role?: string | null
          remote_rate?: number | null
          remote_work_status?: string | null
          saas_category_id?: string | null
          salary_raise_frequency?: string | null
          salary_review_times?: number | null
          search_aliases?: string | null
          selection_count?: number | null
          selection_flow?: string[] | null
          show_fit_negatives?: boolean
          side_job_ok?: boolean | null
          slug?: string | null
          sort_order?: number | null
          source?: string | null
          status?: string | null
          tagline?: string | null
          top_down_ratio?: number | null
          turnover_rate?: string | null
          updated_at?: string | null
          url?: string | null
          user_id?: string | null
          verified_at?: string | null
          why_join?: string | null
          work_time_system?: string | null
          workstyle_description?: string | null
          x_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_companies_canonical_fkey"
            columns: ["canonical_company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_companies_canonical_fkey"
            columns: ["canonical_company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_companies_canonical_fkey"
            columns: ["canonical_company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_companies_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "ow_industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_companies_saas_category_id_fkey"
            columns: ["saas_category_id"]
            isOneToOne: false
            referencedRelation: "ow_saas_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_admins: {
        Row: {
          accepted_at: string | null
          agreed_at: string | null
          agreed_fee_15pct: boolean | null
          agreed_terms_business: boolean | null
          agreed_terms_version: string | null
          company_id: string
          created_at: string
          created_via: string | null
          department: string | null
          id: string
          invitation_token: string | null
          invited_at: string | null
          invited_by_user_id: string | null
          invited_email: string | null
          is_active: boolean
          is_ambassador: boolean
          is_default: boolean
          joined_at: string | null
          permission: string
          role_title: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          agreed_at?: string | null
          agreed_fee_15pct?: boolean | null
          agreed_terms_business?: boolean | null
          agreed_terms_version?: string | null
          company_id: string
          created_at?: string
          created_via?: string | null
          department?: string | null
          id?: string
          invitation_token?: string | null
          invited_at?: string | null
          invited_by_user_id?: string | null
          invited_email?: string | null
          is_active?: boolean
          is_ambassador?: boolean
          is_default?: boolean
          joined_at?: string | null
          permission?: string
          role_title?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          agreed_at?: string | null
          agreed_fee_15pct?: boolean | null
          agreed_terms_business?: boolean | null
          agreed_terms_version?: string | null
          company_id?: string
          created_at?: string
          created_via?: string | null
          department?: string | null
          id?: string
          invitation_token?: string | null
          invited_at?: string | null
          invited_by_user_id?: string | null
          invited_email?: string | null
          is_active?: boolean
          is_ambassador?: boolean
          is_default?: boolean
          joined_at?: string | null
          permission?: string
          role_title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_admins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_admins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_admins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_admins_invited_by_user_id_fkey"
            columns: ["invited_by_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_business_domains: {
        Row: {
          company_id: string
          created_at: string
          display_order: number
          domain_id: string
          is_primary: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          display_order?: number
          domain_id: string
          is_primary?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          display_order?: number
          domain_id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_business_domains_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_business_domains_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_business_domains_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_business_domains_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "ow_business_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_culture_tags: {
        Row: {
          company_id: string | null
          id: string
          tag_category: string | null
          tag_value: string | null
        }
        Insert: {
          company_id?: string | null
          id?: string
          tag_category?: string | null
          tag_value?: string | null
        }
        Update: {
          company_id?: string | null
          id?: string
          tag_category?: string | null
          tag_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_culture_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_culture_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_culture_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_departments: {
        Row: {
          company_id: string
          created_at: string | null
          deleted_at: string | null
          display_order: number
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          deleted_at?: string | null
          display_order?: number
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          deleted_at?: string | null
          display_order?: number
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ow_company_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_domain_verifications: {
        Row: {
          company_id: string
          created_at: string
          domain: string
          email: string
          expires_at: string
          id: string
          token: string
          verified_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          domain: string
          email: string
          expires_at: string
          id?: string
          token: string
          verified_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          domain?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_domain_verifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_domain_verifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_domain_verifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_employee_categories: {
        Row: {
          company_id: string
          created_at: string | null
          custom_name: string | null
          display_order: number
          id: string
          parent_role_id: string | null
          role_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          custom_name?: string | null
          display_order?: number
          id?: string
          parent_role_id?: string | null
          role_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          custom_name?: string | null
          display_order?: number
          id?: string
          parent_role_id?: string | null
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_employee_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_employee_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_employee_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_employee_categories_parent_role_id_fkey"
            columns: ["parent_role_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_employee_categories_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_external_links: {
        Row: {
          company_id: string
          created_at: string
          created_by_role: string
          created_by_user_id: string | null
          description: string | null
          id: string
          is_published: boolean
          published_at: string | null
          sort_order: number
          source_name: string | null
          thumbnail_url: string | null
          title: string
          type: string
          updated_at: string
          url: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by_role: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          sort_order?: number
          source_name?: string | null
          thumbnail_url?: string | null
          title: string
          type: string
          updated_at?: string
          url: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by_role?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          sort_order?: number
          source_name?: string | null
          thumbnail_url?: string | null
          title?: string
          type?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_external_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_external_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_external_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_follows: {
        Row: {
          company_id: string
          created_at: string
          follower_user_id: string
          id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          follower_user_id: string
          id?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          follower_user_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_follows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_follows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_follows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_follows_follower_user_id_fkey"
            columns: ["follower_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_genres: {
        Row: {
          ai_confidence: number | null
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          genre_id: string
          is_ai_suggested: boolean
          is_human_approved: boolean
        }
        Insert: {
          ai_confidence?: number | null
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          genre_id: string
          is_ai_suggested?: boolean
          is_human_approved?: boolean
        }
        Update: {
          ai_confidence?: number | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          genre_id?: string
          is_ai_suggested?: boolean
          is_human_approved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_genres_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_genres_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_genres_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_genres_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "ow_genres"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_hidden_experiences: {
        Row: {
          company_id: string
          experience_id: string
          hidden_at: string
          hidden_by: string | null
          id: string
        }
        Insert: {
          company_id: string
          experience_id: string
          hidden_at?: string
          hidden_by?: string | null
          id?: string
        }
        Update: {
          company_id?: string
          experience_id?: string
          hidden_at?: string
          hidden_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_hidden_experiences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_hidden_experiences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_hidden_experiences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_hidden_experiences_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "ow_experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_hidden_experiences_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "ow_company_admins"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_job_roles: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          display_order: number
          id: string
          name: string
          standard_role_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          name: string
          standard_role_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          name?: string
          standard_role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_job_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_job_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_job_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_job_roles_standard_role_id_fkey"
            columns: ["standard_role_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_join_requests: {
        Row: {
          created_at: string
          id: string
          new_company_description: string | null
          new_company_name: string | null
          new_company_url: string | null
          request_message: string | null
          request_type: string
          requested_permission: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_company_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_company_description?: string | null
          new_company_name?: string | null
          new_company_url?: string | null
          request_message?: string | null
          request_type: string
          requested_permission?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_company_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_company_description?: string | null
          new_company_name?: string | null
          new_company_url?: string | null
          request_message?: string | null
          request_type?: string
          requested_permission?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_company_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_join_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_join_requests_target_company_id_fkey"
            columns: ["target_company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_join_requests_target_company_id_fkey"
            columns: ["target_company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_join_requests_target_company_id_fkey"
            columns: ["target_company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_members: {
        Row: {
          approved_at: string | null
          company_id: string
          consent_at: string | null
          created_at: string
          created_via: string | null
          display_consent: boolean
          id: string
          invite_token: string
          invited_at: string | null
          invited_by: string | null
          is_public: boolean
          ops_reviewed_at: string | null
          role_title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          company_id: string
          consent_at?: string | null
          created_at?: string
          created_via?: string | null
          display_consent?: boolean
          id?: string
          invite_token?: string
          invited_at?: string | null
          invited_by?: string | null
          is_public?: boolean
          ops_reviewed_at?: string | null
          role_title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          company_id?: string
          consent_at?: string | null
          created_at?: string
          created_via?: string | null
          display_consent?: boolean
          id?: string
          invite_token?: string
          invited_at?: string | null
          invited_by?: string | null
          is_public?: boolean
          ops_reviewed_at?: string | null
          role_title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_office_photos: {
        Row: {
          caption: string | null
          category: string
          company_id: string
          created_at: string
          display_order: number
          id: string
          image_url: string
          tagged_user_id: string | null
        }
        Insert: {
          caption?: string | null
          category: string
          company_id: string
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          tagged_user_id?: string | null
        }
        Update: {
          caption?: string | null
          category?: string
          company_id?: string
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          tagged_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_office_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_office_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_office_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_office_photos_tagged_user_id_fkey"
            columns: ["tagged_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_perspectives: {
        Row: {
          author: string | null
          body_markdown: string | null
          company_id: string
          created_at: string
          id: string
          is_featured: boolean
          published_at: string | null
          title: string | null
        }
        Insert: {
          author?: string | null
          body_markdown?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_featured?: boolean
          published_at?: string | null
          title?: string | null
        }
        Update: {
          author?: string | null
          body_markdown?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_featured?: boolean
          published_at?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_perspectives_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_perspectives_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_perspectives_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_plans: {
        Row: {
          billing_cycle: string
          company_id: string
          created_at: string | null
          ended_at: string | null
          id: string
          monthly_fee: number | null
          plan_type: string
          started_at: string | null
          status: string
        }
        Insert: {
          billing_cycle?: string
          company_id: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          monthly_fee?: number | null
          plan_type: string
          started_at?: string | null
          status?: string
        }
        Update: {
          billing_cycle?: string
          company_id?: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          monthly_fee?: number | null
          plan_type?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_posts: {
        Row: {
          author_user_id: string | null
          body: string
          category: string
          company_id: string
          cover_image_url: string | null
          created_at: string
          id: string
          is_published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          body?: string
          category?: string
          company_id: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          category?: string
          company_id?: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_posts_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_segments: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          target: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          target?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          target?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_segments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_segments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_segments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_tools: {
        Row: {
          company_id: string
          created_at: string
          id: string
          note: string | null
          sort_order: number
          tool_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          note?: string | null
          sort_order?: number
          tool_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          note?: string | null
          sort_order?: number
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_tools_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_tools_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_tools_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_company_tools_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "ow_tool_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_contact_logs: {
        Row: {
          action_type: string
          actor_user_id: string | null
          candidate_user_id: string | null
          company_id: string | null
          created_at: string
          id: string
          job_id: string | null
          metadata: Json | null
        }
        Insert: {
          action_type: string
          actor_user_id?: string | null
          candidate_user_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          metadata?: Json | null
        }
        Update: {
          action_type?: string
          actor_user_id?: string | null
          candidate_user_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_contact_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_contact_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_contact_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_contact_submissions: {
        Row: {
          action_type: string
          created_at: string
          email: string
          id: string
          ip: string | null
          message: string | null
          metadata: Json | null
          name: string
          service: string | null
          situation: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          email: string
          id?: string
          ip?: string | null
          message?: string | null
          metadata?: Json | null
          name: string
          service?: string | null
          situation?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          email?: string
          id?: string
          ip?: string | null
          message?: string | null
          metadata?: Json | null
          name?: string
          service?: string | null
          situation?: string | null
        }
        Relationships: []
      }
      ow_conversation_messages: {
        Row: {
          body: string
          conversation_id: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          sender_participant_id: string | null
          sent_at: string
        }
        Insert: {
          body: string
          conversation_id: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_participant_id?: string | null
          sent_at?: string
        }
        Update: {
          body?: string
          conversation_id?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_participant_id?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ow_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_conversation_messages_sender_participant_id_fkey"
            columns: ["sender_participant_id"]
            isOneToOne: false
            referencedRelation: "ow_conversation_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          left_at: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          left_at?: string | null
          role: string
          user_id?: string | null
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          left_at?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ow_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_conversations: {
        Row: {
          candidate_user_id: string
          company_id: string | null
          created_at: string
          id: string
          kind: string
          last_message_at: string | null
          mentor_user_id: string | null
          stage: string
          status: string
        }
        Insert: {
          candidate_user_id: string
          company_id?: string | null
          created_at?: string
          id?: string
          kind: string
          last_message_at?: string | null
          mentor_user_id?: string | null
          stage?: string
          status?: string
        }
        Update: {
          candidate_user_id?: string
          company_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          last_message_at?: string | null
          mentor_user_id?: string | null
          stage?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_conversations_candidate_user_id_fkey"
            columns: ["candidate_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_conversations_mentor_user_id_fkey"
            columns: ["mentor_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_experience_gaps: {
        Row: {
          axis: string
          created_at: string
          experience_id: string
          id: string
          rating: string
          updated_at: string
        }
        Insert: {
          axis: string
          created_at?: string
          experience_id: string
          id?: string
          rating: string
          updated_at?: string
        }
        Update: {
          axis?: string
          created_at?: string
          experience_id?: string
          id?: string
          rating?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_experience_gaps_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "ow_experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_experience_roles: {
        Row: {
          experience_id: string
          is_primary: boolean
          role_id: string
        }
        Insert: {
          experience_id: string
          is_primary?: boolean
          role_id: string
        }
        Update: {
          experience_id?: string
          is_primary?: boolean
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_experience_roles_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "ow_experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_experience_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_experience_stories: {
        Row: {
          created_at: string
          description: string | null
          experience_id: string
          id: string
          image_url: string | null
          link_url: string | null
          og_image_url: string | null
          og_title: string | null
          period_end: string | null
          period_start: string | null
          section_id: string | null
          sort_order: number
          title: string | null
          type: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          experience_id: string
          id?: string
          image_url?: string | null
          link_url?: string | null
          og_image_url?: string | null
          og_title?: string | null
          period_end?: string | null
          period_start?: string | null
          section_id?: string | null
          sort_order: number
          title?: string | null
          type: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          experience_id?: string
          id?: string
          image_url?: string | null
          link_url?: string | null
          og_image_url?: string | null
          og_title?: string | null
          period_end?: string | null
          period_start?: string | null
          section_id?: string | null
          sort_order?: number
          title?: string | null
          type?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_experience_stories_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "ow_experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_experience_stories_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "ow_story_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_experiences: {
        Row: {
          company_anonymized: string | null
          company_id: string | null
          company_text: string | null
          created_at: string
          department: string | null
          department_id: string | null
          description: string | null
          display_order: number
          employment_type: string | null
          ended_at: string | null
          exit_reason: string | null
          id: string
          is_current: boolean
          join_reason: string | null
          join_reason_primary: string | null
          join_reasons: string[] | null
          learnings: string | null
          leave_reasons: string[] | null
          prefecture: string | null
          rank: string | null
          remote_work_status: string | null
          role_category_id: string
          role_title: string | null
          salary_base: number | null
          salary_bonus: number | null
          salary_man: number | null
          salary_stock: number | null
          started_at: string
          turning_point: string | null
          updated_at: string
          user_id: string
          visibility_company: string
          visibility_company_profile: string
          visibility_reason: boolean
          visibility_salary: boolean
        }
        Insert: {
          company_anonymized?: string | null
          company_id?: string | null
          company_text?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          description?: string | null
          display_order?: number
          employment_type?: string | null
          ended_at?: string | null
          exit_reason?: string | null
          id?: string
          is_current?: boolean
          join_reason?: string | null
          join_reason_primary?: string | null
          join_reasons?: string[] | null
          learnings?: string | null
          leave_reasons?: string[] | null
          prefecture?: string | null
          rank?: string | null
          remote_work_status?: string | null
          role_category_id: string
          role_title?: string | null
          salary_base?: number | null
          salary_bonus?: number | null
          salary_man?: number | null
          salary_stock?: number | null
          started_at: string
          turning_point?: string | null
          updated_at?: string
          user_id: string
          visibility_company?: string
          visibility_company_profile?: string
          visibility_reason?: boolean
          visibility_salary?: boolean
        }
        Update: {
          company_anonymized?: string | null
          company_id?: string | null
          company_text?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          description?: string | null
          display_order?: number
          employment_type?: string | null
          ended_at?: string | null
          exit_reason?: string | null
          id?: string
          is_current?: boolean
          join_reason?: string | null
          join_reason_primary?: string | null
          join_reasons?: string[] | null
          learnings?: string | null
          leave_reasons?: string[] | null
          prefecture?: string | null
          rank?: string | null
          remote_work_status?: string | null
          role_category_id?: string
          role_title?: string | null
          salary_base?: number | null
          salary_bonus?: number | null
          salary_man?: number | null
          salary_stock?: number | null
          started_at?: string
          turning_point?: string | null
          updated_at?: string
          user_id?: string
          visibility_company?: string
          visibility_company_profile?: string
          visibility_reason?: boolean
          visibility_salary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ow_experiences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_experiences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_experiences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_experiences_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "ow_company_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_experiences_role_category_id_fkey"
            columns: ["role_category_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_experiences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_favorites: {
        Row: {
          created_at: string | null
          id: string
          target_id: string
          target_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          target_id: string
          target_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ow_genres: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      ow_industries: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          requires_business_domain: boolean
          slug: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          requires_business_domain?: boolean
          slug: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          requires_business_domain?: boolean
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_industries_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ow_industries"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_invoices: {
        Row: {
          amount: number
          company_id: string
          created_at: string | null
          id: string
          invoice_date: string
          notes: string | null
          related_candidate_id: string | null
          related_job_id: string | null
          status: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string | null
          id?: string
          invoice_date: string
          notes?: string | null
          related_candidate_id?: string | null
          related_job_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string | null
          id?: string
          invoice_date?: string
          notes?: string | null
          related_candidate_id?: string | null
          related_job_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_invoices_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_invoices_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_invoices_tenant_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_invoices_tenant_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_invoices_tenant_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_job_applications: {
        Row: {
          agency_id: string | null
          agent_company: string | null
          billing_note: string | null
          billing_status: string
          conversation_id: string | null
          created_at: string | null
          email: string
          external_email: string | null
          external_name: string | null
          hired_confirmed_at: string | null
          hired_salary: number | null
          id: string
          invoiced_at: string | null
          job_id: string
          memo: string | null
          message: string | null
          name: string
          paid_at: string | null
          phone: string | null
          pipeline_stage_id: string | null
          resume_url: string | null
          source: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agency_id?: string | null
          agent_company?: string | null
          billing_note?: string | null
          billing_status?: string
          conversation_id?: string | null
          created_at?: string | null
          email: string
          external_email?: string | null
          external_name?: string | null
          hired_confirmed_at?: string | null
          hired_salary?: number | null
          id?: string
          invoiced_at?: string | null
          job_id: string
          memo?: string | null
          message?: string | null
          name: string
          paid_at?: string | null
          phone?: string | null
          pipeline_stage_id?: string | null
          resume_url?: string | null
          source?: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agency_id?: string | null
          agent_company?: string | null
          billing_note?: string | null
          billing_status?: string
          conversation_id?: string | null
          created_at?: string | null
          email?: string
          external_email?: string | null
          external_name?: string | null
          hired_confirmed_at?: string | null
          hired_salary?: number | null
          id?: string
          invoiced_at?: string | null
          job_id?: string
          memo?: string | null
          message?: string | null
          name?: string
          paid_at?: string | null
          phone?: string | null
          pipeline_stage_id?: string | null
          resume_url?: string | null
          source?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_job_applications_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "ow_agent_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_job_applications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ow_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_job_applications_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "ow_pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_job_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_job_assignees: {
        Row: {
          assigned_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_job_assignees_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_job_assignees_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_job_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_job_favorites: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_job_favorites_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_job_favorites_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_job_matching_tags: {
        Row: {
          id: string
          job_id: string | null
          tag_category: string | null
          tag_value: string | null
        }
        Insert: {
          id?: string
          job_id?: string | null
          tag_category?: string | null
          tag_value?: string | null
        }
        Update: {
          id?: string
          job_id?: string | null
          tag_category?: string | null
          tag_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_job_matching_tags_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_job_matching_tags_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_job_requirements: {
        Row: {
          content: string | null
          display_order: number | null
          id: string
          job_id: string | null
          requirement_type: string | null
        }
        Insert: {
          content?: string | null
          display_order?: number | null
          id?: string
          job_id?: string | null
          requirement_type?: string | null
        }
        Update: {
          content?: string | null
          display_order?: number | null
          id?: string
          job_id?: string | null
          requirement_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_job_requirements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_job_requirements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_job_roles: {
        Row: {
          is_primary: boolean
          job_id: string
          role_id: string
        }
        Insert: {
          is_primary?: boolean
          job_id: string
          role_id: string
        }
        Update: {
          is_primary?: boolean
          job_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_job_roles_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_job_roles_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_job_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_job_views: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_job_views_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_job_views_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_jobs: {
        Row: {
          appeal: string | null
          avg_overtime: string | null
          benefits: string | null
          business_model: string | null
          catch_copy: string | null
          company_id: string | null
          company_job_role_id: string | null
          created_at: string | null
          culture_fit: string | null
          department: string | null
          department_id: string | null
          description: string | null
          description_markdown: string | null
          employment_type: string | null
          expires_at: string | null
          first_90_days: string | null
          fit_negatives: Json | null
          fit_positives: Json | null
          gradient_preset: string | null
          holidays: string | null
          id: string
          incentive_note: string | null
          is_test: boolean
          job_category: string | null
          location: string | null
          main_image_url: string | null
          message_to_candidates: string | null
          negatives: string[] | null
          one_liner: string | null
          ote_max: number | null
          ote_min: number | null
          positives: string[] | null
          preferred: string | null
          preferred_skills: string[] | null
          probation_period: string | null
          published_at: string | null
          rejection_date: string | null
          rejection_reason: string | null
          rejection_reviewer: string | null
          remote_work_status: string | null
          required_skills: string[] | null
          requirements: string | null
          role_category_id: string | null
          salary_max: number | null
          salary_min: number | null
          salary_note: string | null
          sales_hunter_farmer: string | null
          sales_segment: string[] | null
          selection_duration: string | null
          selection_flow: string[] | null
          selection_process: Json | null
          selection_steps: string[] | null
          slug: string | null
          source_url: string | null
          source_verified_at: string | null
          start_date_preference: string | null
          status: string | null
          submitted_at: string | null
          team_composition: string | null
          tech_stack: string[]
          title: string
          trial_period: string | null
          updated_at: string | null
          urgency: string
          what_youll_do_intro: string | null
          who_we_want_intro: string | null
          why_hire: string | null
          why_we_exist: string | null
          work_hours: string | null
          work_style: string | null
        }
        Insert: {
          appeal?: string | null
          avg_overtime?: string | null
          benefits?: string | null
          business_model?: string | null
          catch_copy?: string | null
          company_id?: string | null
          company_job_role_id?: string | null
          created_at?: string | null
          culture_fit?: string | null
          department?: string | null
          department_id?: string | null
          description?: string | null
          description_markdown?: string | null
          employment_type?: string | null
          expires_at?: string | null
          first_90_days?: string | null
          fit_negatives?: Json | null
          fit_positives?: Json | null
          gradient_preset?: string | null
          holidays?: string | null
          id?: string
          incentive_note?: string | null
          is_test?: boolean
          job_category?: string | null
          location?: string | null
          main_image_url?: string | null
          message_to_candidates?: string | null
          negatives?: string[] | null
          one_liner?: string | null
          ote_max?: number | null
          ote_min?: number | null
          positives?: string[] | null
          preferred?: string | null
          preferred_skills?: string[] | null
          probation_period?: string | null
          published_at?: string | null
          rejection_date?: string | null
          rejection_reason?: string | null
          rejection_reviewer?: string | null
          remote_work_status?: string | null
          required_skills?: string[] | null
          requirements?: string | null
          role_category_id?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_note?: string | null
          sales_hunter_farmer?: string | null
          sales_segment?: string[] | null
          selection_duration?: string | null
          selection_flow?: string[] | null
          selection_process?: Json | null
          selection_steps?: string[] | null
          slug?: string | null
          source_url?: string | null
          source_verified_at?: string | null
          start_date_preference?: string | null
          status?: string | null
          submitted_at?: string | null
          team_composition?: string | null
          tech_stack?: string[]
          title: string
          trial_period?: string | null
          updated_at?: string | null
          urgency?: string
          what_youll_do_intro?: string | null
          who_we_want_intro?: string | null
          why_hire?: string | null
          why_we_exist?: string | null
          work_hours?: string | null
          work_style?: string | null
        }
        Update: {
          appeal?: string | null
          avg_overtime?: string | null
          benefits?: string | null
          business_model?: string | null
          catch_copy?: string | null
          company_id?: string | null
          company_job_role_id?: string | null
          created_at?: string | null
          culture_fit?: string | null
          department?: string | null
          department_id?: string | null
          description?: string | null
          description_markdown?: string | null
          employment_type?: string | null
          expires_at?: string | null
          first_90_days?: string | null
          fit_negatives?: Json | null
          fit_positives?: Json | null
          gradient_preset?: string | null
          holidays?: string | null
          id?: string
          incentive_note?: string | null
          is_test?: boolean
          job_category?: string | null
          location?: string | null
          main_image_url?: string | null
          message_to_candidates?: string | null
          negatives?: string[] | null
          one_liner?: string | null
          ote_max?: number | null
          ote_min?: number | null
          positives?: string[] | null
          preferred?: string | null
          preferred_skills?: string[] | null
          probation_period?: string | null
          published_at?: string | null
          rejection_date?: string | null
          rejection_reason?: string | null
          rejection_reviewer?: string | null
          remote_work_status?: string | null
          required_skills?: string[] | null
          requirements?: string | null
          role_category_id?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_note?: string | null
          sales_hunter_farmer?: string | null
          sales_segment?: string[] | null
          selection_duration?: string | null
          selection_flow?: string[] | null
          selection_process?: Json | null
          selection_steps?: string[] | null
          slug?: string | null
          source_url?: string | null
          source_verified_at?: string | null
          start_date_preference?: string | null
          status?: string | null
          submitted_at?: string | null
          team_composition?: string | null
          tech_stack?: string[]
          title?: string
          trial_period?: string | null
          updated_at?: string | null
          urgency?: string
          what_youll_do_intro?: string | null
          who_we_want_intro?: string | null
          why_hire?: string | null
          why_we_exist?: string | null
          work_hours?: string | null
          work_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_jobs_company_job_role_id_fkey"
            columns: ["company_job_role_id"]
            isOneToOne: false
            referencedRelation: "ow_company_job_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_jobs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "ow_company_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_jobs_role_category_id_fkey"
            columns: ["role_category_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_languages: {
        Row: {
          aliases: string[]
          created_at: string
          id: string
          is_active: boolean
          iso_639_1: string | null
          label: string
          sort_order: number
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          iso_639_1?: string | null
          label: string
          sort_order?: number
        }
        Update: {
          aliases?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          iso_639_1?: string | null
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      ow_match_scores: {
        Row: {
          career_score: number | null
          company_id: string
          created_at: string | null
          culture_score: number | null
          id: string
          match_reasons: string[] | null
          overall_score: number | null
          skill_score: number | null
          updated_at: string | null
          user_id: string
          workstyle_score: number | null
        }
        Insert: {
          career_score?: number | null
          company_id: string
          created_at?: string | null
          culture_score?: number | null
          id?: string
          match_reasons?: string[] | null
          overall_score?: number | null
          skill_score?: number | null
          updated_at?: string | null
          user_id: string
          workstyle_score?: number | null
        }
        Update: {
          career_score?: number | null
          company_id?: string
          created_at?: string | null
          culture_score?: number | null
          id?: string
          match_reasons?: string[] | null
          overall_score?: number | null
          skill_score?: number | null
          updated_at?: string | null
          user_id?: string
          workstyle_score?: number | null
        }
        Relationships: []
      }
      ow_matches: {
        Row: {
          company_id: string
          created_at: string
          id: string
          job_id: string | null
          match_reasons: string[] | null
          match_score: number | null
          user_id: string
          viewed_by_company: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          job_id?: string | null
          match_reasons?: string[] | null
          match_score?: number | null
          user_id: string
          viewed_by_company?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          job_id?: string | null
          match_reasons?: string[] | null
          match_score?: number | null
          user_id?: string
          viewed_by_company?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ow_matches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_matches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_matches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_matches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_matches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_meeting_feedbacks: {
        Row: {
          comment: string | null
          created_at: string
          helpful_tags: string[] | null
          id: string
          meeting_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          helpful_tags?: string[] | null
          id?: string
          meeting_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          helpful_tags?: string[] | null
          id?: string
          meeting_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: []
      }
      ow_mentor_reservations: {
        Row: {
          ambassador_id: string | null
          ambassador_user_id: string | null
          background: string | null
          contact_email: string
          created_at: string
          current_situation: string | null
          editor_note: string | null
          id: string
          mentor_note: string | null
          preferred_days: string[] | null
          preferred_platform: string | null
          preferred_times: string[] | null
          questions: string | null
          scheduled_at: string | null
          status: string
          themes: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ambassador_id?: string | null
          ambassador_user_id?: string | null
          background?: string | null
          contact_email: string
          created_at?: string
          current_situation?: string | null
          editor_note?: string | null
          id?: string
          mentor_note?: string | null
          preferred_days?: string[] | null
          preferred_platform?: string | null
          preferred_times?: string[] | null
          questions?: string | null
          scheduled_at?: string | null
          status?: string
          themes?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ambassador_id?: string | null
          ambassador_user_id?: string | null
          background?: string | null
          contact_email?: string
          created_at?: string
          current_situation?: string | null
          editor_note?: string | null
          id?: string
          mentor_note?: string | null
          preferred_days?: string[] | null
          preferred_platform?: string | null
          preferred_times?: string[] | null
          questions?: string | null
          scheduled_at?: string | null
          status?: string
          themes?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_mentor_reservations_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ow_company_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_mentor_reservations_ambassador_user_id_fkey"
            columns: ["ambassador_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_mentor_reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_message_reads: {
        Row: {
          message_id: string
          participant_id: string
          read_at: string
        }
        Insert: {
          message_id: string
          participant_id: string
          read_at?: string
        }
        Update: {
          message_id?: string
          participant_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ow_conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_message_reads_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "ow_conversation_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          sender_id: string | null
          sender_type: string | null
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_id?: string | null
          sender_type?: string | null
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_id?: string | null
          sender_type?: string | null
          thread_id?: string
        }
        Relationships: []
      }
      ow_notifications: {
        Row: {
          actor_company_id: string | null
          actor_user_id: string | null
          comment_id: string | null
          created_at: string
          id: string
          is_read: boolean
          post_id: string | null
          recipient_user_id: string
          scout_id: string | null
          type: string
        }
        Insert: {
          actor_company_id?: string | null
          actor_user_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          post_id?: string | null
          recipient_user_id: string
          scout_id?: string | null
          type: string
        }
        Update: {
          actor_company_id?: string | null
          actor_user_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          post_id?: string | null
          recipient_user_id?: string
          scout_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_notifications_actor_company_id_fkey"
            columns: ["actor_company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_notifications_actor_company_id_fkey"
            columns: ["actor_company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_notifications_actor_company_id_fkey"
            columns: ["actor_company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_notifications_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "ow_post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "ow_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "ow_posts_visible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_notifications_scout_id_fkey"
            columns: ["scout_id"]
            isOneToOne: false
            referencedRelation: "ow_scouts"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_page_views: {
        Row: {
          created_at: string
          id: number
          page_type: string | null
          path: string
          referrer_host: string | null
          target_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          page_type?: string | null
          path: string
          referrer_host?: string | null
          target_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          page_type?: string | null
          path?: string
          referrer_host?: string | null
          target_id?: string | null
        }
        Relationships: []
      }
      ow_pipeline_stages: {
        Row: {
          color: string
          company_id: string
          created_at: string
          id: string
          is_hired: boolean
          is_rejected: boolean
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          id?: string
          is_hired?: boolean
          is_rejected?: boolean
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          is_hired?: boolean
          is_rejected?: boolean
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_pipeline_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_pipeline_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_pipeline_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_placements: {
        Row: {
          annual_salary: number | null
          candidate_id: string
          channel: string
          company_id: string
          created_at: string
          current_role_id: string | null
          fee_amount: number | null
          id: string
          job_id: string | null
          joined_at: string
          previous_annual_salary: number | null
          previous_industry: string | null
          previous_role_id: string | null
          resignation_reason: string | null
          resigned_at: string | null
          updated_at: string
          years_of_experience: number | null
        }
        Insert: {
          annual_salary?: number | null
          candidate_id: string
          channel: string
          company_id: string
          created_at?: string
          current_role_id?: string | null
          fee_amount?: number | null
          id?: string
          job_id?: string | null
          joined_at: string
          previous_annual_salary?: number | null
          previous_industry?: string | null
          previous_role_id?: string | null
          resignation_reason?: string | null
          resigned_at?: string | null
          updated_at?: string
          years_of_experience?: number | null
        }
        Update: {
          annual_salary?: number | null
          candidate_id?: string
          channel?: string
          company_id?: string
          created_at?: string
          current_role_id?: string | null
          fee_amount?: number | null
          id?: string
          job_id?: string | null
          joined_at?: string
          previous_annual_salary?: number | null
          previous_industry?: string | null
          previous_role_id?: string | null
          resignation_reason?: string | null
          resigned_at?: string | null
          updated_at?: string
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_placements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_placements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_placements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_placements_current_role_id_fkey"
            columns: ["current_role_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_placements_previous_role_id_fkey"
            columns: ["previous_role_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "ow_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "ow_posts_visible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_post_hire_reports: {
        Row: {
          company_id: string | null
          concerns: string | null
          created_at: string | null
          culture_match: number | null
          gap_from_expectation: string | null
          good_points: string | null
          id: string
          is_published: boolean | null
          months_after: number
          overall_satisfaction: number | null
          salary_match: number | null
          user_id: string | null
          workstyle_match: number | null
          would_recommend: boolean | null
        }
        Insert: {
          company_id?: string | null
          concerns?: string | null
          created_at?: string | null
          culture_match?: number | null
          gap_from_expectation?: string | null
          good_points?: string | null
          id?: string
          is_published?: boolean | null
          months_after: number
          overall_satisfaction?: number | null
          salary_match?: number | null
          user_id?: string | null
          workstyle_match?: number | null
          would_recommend?: boolean | null
        }
        Update: {
          company_id?: string | null
          concerns?: string | null
          created_at?: string | null
          culture_match?: number | null
          gap_from_expectation?: string | null
          good_points?: string | null
          id?: string
          is_published?: boolean | null
          months_after?: number
          overall_satisfaction?: number | null
          salary_match?: number | null
          user_id?: string | null
          workstyle_match?: number | null
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_post_hire_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_post_hire_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_post_hire_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "ow_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "ow_posts_visible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_posts: {
        Row: {
          content: string
          created_at: string
          event_location: string | null
          event_starts_at: string | null
          event_title: string | null
          id: string
          image_url: string | null
          link_description: string | null
          link_domain: string | null
          link_image_url: string | null
          link_title: string | null
          link_url: string | null
          post_type: string
          ref_article_id: string | null
          ref_company_id: string | null
          ref_job_id: string | null
          ref_user_id: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          content: string
          created_at?: string
          event_location?: string | null
          event_starts_at?: string | null
          event_title?: string | null
          id?: string
          image_url?: string | null
          link_description?: string | null
          link_domain?: string | null
          link_image_url?: string | null
          link_title?: string | null
          link_url?: string | null
          post_type?: string
          ref_article_id?: string | null
          ref_company_id?: string | null
          ref_job_id?: string | null
          ref_user_id?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          content?: string
          created_at?: string
          event_location?: string | null
          event_starts_at?: string | null
          event_title?: string | null
          id?: string
          image_url?: string | null
          link_description?: string | null
          link_domain?: string | null
          link_image_url?: string | null
          link_title?: string | null
          link_url?: string | null
          post_type?: string
          ref_article_id?: string | null
          ref_company_id?: string | null
          ref_job_id?: string | null
          ref_user_id?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_posts_ref_article_id_fkey"
            columns: ["ref_article_id"]
            isOneToOne: false
            referencedRelation: "ow_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_posts_ref_company_id_fkey"
            columns: ["ref_company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_posts_ref_company_id_fkey"
            columns: ["ref_company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_posts_ref_company_id_fkey"
            columns: ["ref_company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_posts_ref_job_id_fkey"
            columns: ["ref_job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_posts_ref_job_id_fkey"
            columns: ["ref_job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_posts_ref_user_id_fkey"
            columns: ["ref_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_profile_desired_roles: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_profile_desired_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_profiles: {
        Row: {
          bio: string | null
          career_stance: string | null
          created_at: string | null
          desired_phase: string[] | null
          desired_prefectures: string[] | null
          desired_salary_max: number | null
          desired_salary_min: number | null
          desired_work_style: string | null
          desired_work_styles: string[] | null
          email_scout_enabled: boolean
          email_weekly_enabled: boolean
          experience_years: string | null
          id: string
          job_type: string | null
          location: string | null
          name: string | null
          name_kana: string | null
          onboarding_completed: boolean | null
          photo_url: string | null
          scout_enabled: boolean | null
          stance_updated_at: string | null
          transfer_timing: string | null
          transfer_timing_updated_at: string | null
          updated_at: string | null
          user_id: string | null
          worry: string | null
        }
        Insert: {
          bio?: string | null
          career_stance?: string | null
          created_at?: string | null
          desired_phase?: string[] | null
          desired_prefectures?: string[] | null
          desired_salary_max?: number | null
          desired_salary_min?: number | null
          desired_work_style?: string | null
          desired_work_styles?: string[] | null
          email_scout_enabled?: boolean
          email_weekly_enabled?: boolean
          experience_years?: string | null
          id?: string
          job_type?: string | null
          location?: string | null
          name?: string | null
          name_kana?: string | null
          onboarding_completed?: boolean | null
          photo_url?: string | null
          scout_enabled?: boolean | null
          stance_updated_at?: string | null
          transfer_timing?: string | null
          transfer_timing_updated_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          worry?: string | null
        }
        Update: {
          bio?: string | null
          career_stance?: string | null
          created_at?: string | null
          desired_phase?: string[] | null
          desired_prefectures?: string[] | null
          desired_salary_max?: number | null
          desired_salary_min?: number | null
          desired_work_style?: string | null
          desired_work_styles?: string[] | null
          email_scout_enabled?: boolean
          email_weekly_enabled?: boolean
          experience_years?: string | null
          id?: string
          job_type?: string | null
          location?: string | null
          name?: string | null
          name_kana?: string | null
          onboarding_completed?: boolean | null
          photo_url?: string | null
          scout_enabled?: boolean | null
          stance_updated_at?: string | null
          transfer_timing?: string | null
          transfer_timing_updated_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          worry?: string | null
        }
        Relationships: []
      }
      ow_role_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          role_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          role_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_role_aliases_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_roles: {
        Row: {
          created_at: string
          display_order: number
          icon_color: string | null
          id: string
          is_active: boolean
          is_it_saas: boolean
          level: number | null
          merged_into_id: string | null
          name: string
          name_en: string | null
          parent_id: string | null
          slug: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          icon_color?: string | null
          id?: string
          is_active?: boolean
          is_it_saas?: boolean
          level?: number | null
          merged_into_id?: string | null
          name: string
          name_en?: string | null
          parent_id?: string | null
          slug?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          icon_color?: string | null
          id?: string
          is_active?: boolean
          is_it_saas?: boolean
          level?: number | null
          merged_into_id?: string | null
          name?: string
          name_en?: string | null
          parent_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_roles_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_roles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_saas_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      ow_saved_companies: {
        Row: {
          company_id: string | null
          id: string
          saved_at: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          id?: string
          saved_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          id?: string
          saved_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_saved_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_saved_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_saved_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_saved_jobs: {
        Row: {
          id: string
          job_id: string | null
          saved_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          job_id?: string | null
          saved_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          job_id?: string | null
          saved_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_school_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_school_id: string | null
          created_at: string
          id: string
          requested_by: string
          school_name: string
          school_name_kana: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_school_id?: string | null
          created_at?: string
          id?: string
          requested_by: string
          school_name: string
          school_name_kana?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_school_id?: string | null
          created_at?: string
          id?: string
          requested_by?: string
          school_name?: string
          school_name_kana?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_school_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_school_requests_approved_school_id_fkey"
            columns: ["approved_school_id"]
            isOneToOne: false
            referencedRelation: "ow_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_school_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_schools: {
        Row: {
          country: string
          created_at: string
          id: string
          logo_gradient: string | null
          logo_letter: string | null
          logo_url: string | null
          name: string
          name_kana: string | null
          type: string
          updated_at: string
        }
        Insert: {
          country?: string
          created_at?: string
          id?: string
          logo_gradient?: string | null
          logo_letter?: string | null
          logo_url?: string | null
          name: string
          name_kana?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          logo_gradient?: string | null
          logo_letter?: string | null
          logo_url?: string | null
          name?: string
          name_kana?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ow_scout_blocks: {
        Row: {
          candidate_id: string
          company_id: string
          created_at: string
          id: string
        }
        Insert: {
          candidate_id: string
          company_id: string
          created_at?: string
          id?: string
        }
        Update: {
          candidate_id?: string
          company_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_scout_blocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_scout_blocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_scout_blocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_scout_quotas: {
        Row: {
          bonus_credits: number
          company_id: string
          monthly_limit: number
          period_start: string
          updated_at: string
          used_this_month: number
        }
        Insert: {
          bonus_credits?: number
          company_id: string
          monthly_limit?: number
          period_start?: string
          updated_at?: string
          used_this_month?: number
        }
        Update: {
          bonus_credits?: number
          company_id?: string
          monthly_limit?: number
          period_start?: string
          updated_at?: string
          used_this_month?: number
        }
        Relationships: [
          {
            foreignKeyName: "ow_scout_quotas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_scout_quotas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_scout_quotas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_scouts: {
        Row: {
          candidate_id: string | null
          company_id: string | null
          conversation_id: string | null
          id: string
          job_id: string | null
          message: string | null
          replied_at: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          candidate_id?: string | null
          company_id?: string | null
          conversation_id?: string | null
          id?: string
          job_id?: string | null
          message?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          candidate_id?: string | null
          company_id?: string | null
          conversation_id?: string | null
          id?: string
          job_id?: string | null
          message?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_scouts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_scouts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_scouts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_scouts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ow_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_scouts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_scouts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_search_logs: {
        Row: {
          conditions: Json | null
          created_at: string
          id: string
          primary_kind: string
          query: string
          result_count: number | null
          unresolved: string[] | null
          user_id: string | null
        }
        Insert: {
          conditions?: Json | null
          created_at?: string
          id?: string
          primary_kind: string
          query: string
          result_count?: number | null
          unresolved?: string[] | null
          user_id?: string | null
        }
        Update: {
          conditions?: Json | null
          created_at?: string
          id?: string
          primary_kind?: string
          query?: string
          result_count?: number | null
          unresolved?: string[] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_search_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      ow_skills: {
        Row: {
          aliases: string[]
          category: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          tool_id: string | null
        }
        Insert: {
          aliases?: string[]
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          tool_id?: string | null
        }
        Update: {
          aliases?: string[]
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          tool_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_skills_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "ow_tool_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_story_sections: {
        Row: {
          created_at: string
          experience_id: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          experience_id: string
          id?: string
          name: string
          sort_order: number
        }
        Update: {
          created_at?: string
          experience_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "ow_story_sections_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "ow_experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_terms_agreements: {
        Row: {
          agreed_at: string
          company_id: string | null
          id: string
          ip_address: unknown
          terms_type: string
          terms_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          agreed_at?: string
          company_id?: string | null
          id?: string
          ip_address?: unknown
          terms_type: string
          terms_version: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          agreed_at?: string
          company_id?: string | null
          id?: string
          ip_address?: unknown
          terms_type?: string
          terms_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_terms_agreements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_terms_agreements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_terms_agreements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_threads: {
        Row: {
          candidate_id: string
          company_id: string
          company_name: string | null
          created_at: string | null
          id: string
          last_message: string | null
          status: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          candidate_id: string
          company_id: string
          company_name?: string | null
          created_at?: string | null
          id?: string
          last_message?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string
          company_id?: string
          company_name?: string | null
          created_at?: string | null
          id?: string
          last_message?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ow_tool_masters: {
        Row: {
          aliases: string[]
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          sort_order: number
        }
        Insert: {
          aliases?: string[]
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          sort_order?: number
        }
        Update: {
          aliases?: string[]
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      ow_transitions: {
        Row: {
          age_at_move: number | null
          built_at: string
          from_company_id: string | null
          from_company_text: string | null
          from_industry: string | null
          from_role_category_id: string | null
          id: string
          industry_change: string
          moved_at: string
          role_change: string
          to_company_id: string | null
          to_company_text: string | null
          to_industry: string | null
          to_role_category_id: string | null
          user_id: string
          years_of_experience_at_move: number | null
        }
        Insert: {
          age_at_move?: number | null
          built_at?: string
          from_company_id?: string | null
          from_company_text?: string | null
          from_industry?: string | null
          from_role_category_id?: string | null
          id?: string
          industry_change: string
          moved_at: string
          role_change: string
          to_company_id?: string | null
          to_company_text?: string | null
          to_industry?: string | null
          to_role_category_id?: string | null
          user_id: string
          years_of_experience_at_move?: number | null
        }
        Update: {
          age_at_move?: number | null
          built_at?: string
          from_company_id?: string | null
          from_company_text?: string | null
          from_industry?: string | null
          from_role_category_id?: string | null
          id?: string
          industry_change?: string
          moved_at?: string
          role_change?: string
          to_company_id?: string | null
          to_company_text?: string | null
          to_industry?: string | null
          to_role_category_id?: string | null
          user_id?: string
          years_of_experience_at_move?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_transitions_from_company_id_fkey"
            columns: ["from_company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_transitions_from_company_id_fkey"
            columns: ["from_company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_transitions_from_company_id_fkey"
            columns: ["from_company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_transitions_from_role_category_id_fkey"
            columns: ["from_role_category_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_transitions_to_company_id_fkey"
            columns: ["to_company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_transitions_to_company_id_fkey"
            columns: ["to_company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_transitions_to_company_id_fkey"
            columns: ["to_company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_transitions_to_role_category_id_fkey"
            columns: ["to_role_category_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_transitions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_user_achievements: {
        Row: {
          created_at: string
          description: string | null
          experience_id: string | null
          id: string
          period_end: string | null
          period_start: string | null
          sort_order: number
          title: string
          unit: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          experience_id?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          sort_order: number
          title: string
          unit?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          experience_id?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          sort_order?: number
          title?: string
          unit?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_user_achievements_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "ow_experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_user_awards: {
        Row: {
          awarded_at: string | null
          created_at: string
          description: string | null
          experience_id: string | null
          id: string
          issuer: string | null
          sort_order: number
          title: string
          user_id: string
        }
        Insert: {
          awarded_at?: string | null
          created_at?: string
          description?: string | null
          experience_id?: string | null
          id?: string
          issuer?: string | null
          sort_order: number
          title: string
          user_id: string
        }
        Update: {
          awarded_at?: string | null
          created_at?: string
          description?: string | null
          experience_id?: string | null
          id?: string
          issuer?: string | null
          sort_order?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_user_awards_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "ow_experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_user_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_user_certifications: {
        Row: {
          created_at: string
          credential_id: string | null
          credential_url: string | null
          id: string
          issued_at: string | null
          issuer: string | null
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_id?: string | null
          credential_url?: string | null
          id?: string
          issued_at?: string | null
          issuer?: string | null
          name: string
          sort_order: number
          user_id: string
        }
        Update: {
          created_at?: string
          credential_id?: string | null
          credential_url?: string | null
          id?: string
          issued_at?: string | null
          issuer?: string | null
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_user_certifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_user_content_links: {
        Row: {
          created_at: string
          description: string | null
          id: string
          platform: string | null
          sort_order: number
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          platform?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          platform?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_user_content_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_user_educations: {
        Row: {
          created_at: string
          degree: string | null
          enrolled_at: string | null
          faculty: string | null
          graduated_at: string | null
          id: string
          is_current: boolean
          school: string
          school_id: string | null
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          degree?: string | null
          enrolled_at?: string | null
          faculty?: string | null
          graduated_at?: string | null
          id?: string
          is_current?: boolean
          school: string
          school_id?: string | null
          sort_order: number
          user_id: string
        }
        Update: {
          created_at?: string
          degree?: string | null
          enrolled_at?: string | null
          faculty?: string | null
          graduated_at?: string | null
          id?: string
          is_current?: boolean
          school?: string
          school_id?: string | null
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_user_educations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "ow_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_user_educations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_user_follows: {
        Row: {
          created_at: string
          follower_user_id: string
          id: string
          target_user_id: string
        }
        Insert: {
          created_at?: string
          follower_user_id: string
          id?: string
          target_user_id: string
        }
        Update: {
          created_at?: string
          follower_user_id?: string
          id?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_career_follows_follower_user_id_fkey"
            columns: ["follower_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_user_follows_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_user_languages: {
        Row: {
          created_at: string
          id: string
          language_id: string | null
          proficiency: string | null
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language_id?: string | null
          proficiency?: string | null
          sort_order: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language_id?: string | null
          proficiency?: string | null
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_user_languages_language_id_fkey"
            columns: ["language_id"]
            isOneToOne: false
            referencedRelation: "ow_languages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_user_languages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_user_media_appearances: {
        Row: {
          appeared_at: string | null
          created_at: string
          description: string | null
          id: string
          media_name: string | null
          sort_order: number
          thumbnail_url: string | null
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          appeared_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          media_name?: string | null
          sort_order: number
          thumbnail_url?: string | null
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          appeared_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          media_name?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_user_media_appearances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_user_profiles: {
        Row: {
          created_at: string | null
          current_job_type: string | null
          experience_years: number | null
          id: string
          preferred_job_types: string[] | null
          preferred_locations: string[] | null
          salary_max: number | null
          salary_min: number | null
          updated_at: string | null
          user_id: string
          work_style: string | null
        }
        Insert: {
          created_at?: string | null
          current_job_type?: string | null
          experience_years?: number | null
          id?: string
          preferred_job_types?: string[] | null
          preferred_locations?: string[] | null
          salary_max?: number | null
          salary_min?: number | null
          updated_at?: string | null
          user_id: string
          work_style?: string | null
        }
        Update: {
          created_at?: string | null
          current_job_type?: string | null
          experience_years?: number | null
          id?: string
          preferred_job_types?: string[] | null
          preferred_locations?: string[] | null
          salary_max?: number | null
          salary_min?: number | null
          updated_at?: string | null
          user_id?: string
          work_style?: string | null
        }
        Relationships: []
      }
      ow_user_recommendations: {
        Row: {
          content: string
          created_at: string
          id: string
          is_visible: boolean
          recommender_company: string | null
          recommender_name: string
          recommender_title: string | null
          recommender_user_id: string | null
          relationship: string | null
          target_user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_visible?: boolean
          recommender_company?: string | null
          recommender_name: string
          recommender_title?: string | null
          recommender_user_id?: string | null
          relationship?: string | null
          target_user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_visible?: boolean
          recommender_company?: string | null
          recommender_name?: string
          recommender_title?: string | null
          recommender_user_id?: string | null
          relationship?: string | null
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_user_recommendations_recommender_user_id_fkey"
            columns: ["recommender_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_user_recommendations_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_user_skills: {
        Row: {
          created_at: string
          id: string
          skill_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          skill_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          skill_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_user_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "ow_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_user_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_users: {
        Row: {
          about_me: string | null
          auth_id: string | null
          auth_linked_at: string | null
          avatar_color: string | null
          avatar_url: string | null
          birth_date: string | null
          can_casual_meeting: boolean
          can_talk_to_candidates: boolean
          can_talk_to_hr: boolean
          catchphrase: string | null
          cover_color: string | null
          cover_photo_url: string | null
          created_at: string
          email: string
          future_aspirations: string | null
          headline: string | null
          id: string
          is_active_mentor: boolean
          is_mentor: boolean
          is_open_to_work: boolean
          is_system: boolean
          is_test: boolean
          location: string | null
          mentor_registered_at: string | null
          name: string
          profile_setup_at: string | null
          social_links: Json | null
          statistics_opt_out: boolean
          updated_at: string
          username: string | null
          visibility: string
          welcome_sent_at: string | null
        }
        Insert: {
          about_me?: string | null
          auth_id?: string | null
          auth_linked_at?: string | null
          avatar_color?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          can_casual_meeting?: boolean
          can_talk_to_candidates?: boolean
          can_talk_to_hr?: boolean
          catchphrase?: string | null
          cover_color?: string | null
          cover_photo_url?: string | null
          created_at?: string
          email: string
          future_aspirations?: string | null
          headline?: string | null
          id?: string
          is_active_mentor?: boolean
          is_mentor?: boolean
          is_open_to_work?: boolean
          is_system?: boolean
          is_test?: boolean
          location?: string | null
          mentor_registered_at?: string | null
          name: string
          profile_setup_at?: string | null
          social_links?: Json | null
          statistics_opt_out?: boolean
          updated_at?: string
          username?: string | null
          visibility?: string
          welcome_sent_at?: string | null
        }
        Update: {
          about_me?: string | null
          auth_id?: string | null
          auth_linked_at?: string | null
          avatar_color?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          can_casual_meeting?: boolean
          can_talk_to_candidates?: boolean
          can_talk_to_hr?: boolean
          catchphrase?: string | null
          cover_color?: string | null
          cover_photo_url?: string | null
          created_at?: string
          email?: string
          future_aspirations?: string | null
          headline?: string | null
          id?: string
          is_active_mentor?: boolean
          is_mentor?: boolean
          is_open_to_work?: boolean
          is_system?: boolean
          is_test?: boolean
          location?: string | null
          mentor_registered_at?: string | null
          name?: string
          profile_setup_at?: string | null
          social_links?: Json | null
          statistics_opt_out?: boolean
          updated_at?: string
          username?: string | null
          visibility?: string
          welcome_sent_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      ow_business_job_performance: {
        Row: {
          application_count: number | null
          conversion_rate_pct: number | null
          created_at: string | null
          job_id: string | null
          status: string | null
          tenant_id: string | null
          title: string | null
          view_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_jobs_company_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_jobs_company_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_jobs_company_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_business_monthly_stats: {
        Row: {
          applications: number | null
          interviews: number | null
          month: string | null
          offers: number | null
          scouts: number | null
          tenant_id: string | null
        }
        Relationships: []
      }
      ow_business_todo_counts: {
        Row: {
          interviews_today: number | null
          new_applications: number | null
          reply_overdue: number | null
          scout_replies: number | null
          tenant_id: string | null
        }
        Relationships: []
      }
      ow_follows_v: {
        Row: {
          created_at: string | null
          follower_user_id: string | null
          id: string | null
          target_id: string | null
          target_type: string | null
        }
        Relationships: []
      }
      ow_posts_visible: {
        Row: {
          content: string | null
          created_at: string | null
          event_location: string | null
          event_starts_at: string | null
          event_title: string | null
          id: string | null
          image_url: string | null
          link_description: string | null
          link_domain: string | null
          link_image_url: string | null
          link_title: string | null
          link_url: string | null
          post_type: string | null
          ref_article_id: string | null
          ref_company_id: string | null
          ref_job_id: string | null
          ref_user_id: string | null
          updated_at: string | null
          user_id: string | null
          visibility: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          event_location?: string | null
          event_starts_at?: string | null
          event_title?: string | null
          id?: string | null
          image_url?: string | null
          link_description?: string | null
          link_domain?: string | null
          link_image_url?: string | null
          link_title?: string | null
          link_url?: string | null
          post_type?: string | null
          ref_article_id?: string | null
          ref_company_id?: string | null
          ref_job_id?: string | null
          ref_user_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          visibility?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          event_location?: string | null
          event_starts_at?: string | null
          event_title?: string | null
          id?: string | null
          image_url?: string | null
          link_description?: string | null
          link_domain?: string | null
          link_image_url?: string | null
          link_title?: string | null
          link_url?: string | null
          post_type?: string | null
          ref_article_id?: string | null
          ref_company_id?: string | null
          ref_job_id?: string | null
          ref_user_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_posts_ref_article_id_fkey"
            columns: ["ref_article_id"]
            isOneToOne: false
            referencedRelation: "ow_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_posts_ref_company_id_fkey"
            columns: ["ref_company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_posts_ref_company_id_fkey"
            columns: ["ref_company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_posts_ref_company_id_fkey"
            columns: ["ref_company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_posts_ref_job_id_fkey"
            columns: ["ref_job_id"]
            isOneToOne: false
            referencedRelation: "ow_business_job_performance"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ow_posts_ref_job_id_fkey"
            columns: ["ref_job_id"]
            isOneToOne: false
            referencedRelation: "ow_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_posts_ref_user_id_fkey"
            columns: ["ref_user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ow_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_school_request: {
        Args: {
          p_approved_by: string
          p_logo_gradient: string
          p_logo_letter: string
          p_request_id: string
        }
        Returns: {
          school_id: string
          updated_educations_count: number
        }[]
      }
      auth_is_admin: { Args: never; Returns: boolean }
      auth_is_company_admin: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      auth_is_company_member: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      auth_ow_user_id: { Args: never; Returns: string }
      can_send_scout: {
        Args: { p_candidate_id: string; p_company_id: string }
        Returns: boolean
      }
      consume_scout_quota: { Args: { p_company_id: string }; Returns: boolean }
      create_conversation: {
        Args: {
          p_candidate_user_id: string
          p_company_id?: string
          p_kind: string
          p_mentor_user_id?: string
        }
        Returns: {
          conversation_id: string
          created: boolean
        }[]
      }
      find_companies_by_normalized_name: {
        Args: { p_name: string }
        Returns: {
          canonical_company_id: string
          created_at: string
          id: string
          is_approved: boolean
          is_published: boolean
          name: string
          slug: string
          source: string
        }[]
      }
      get_blocked_companies: {
        Args: { p_auth_user_id: string }
        Returns: {
          block_reason: string
          company_id: string
          company_name: string
        }[]
      }
      get_public_career_steps: {
        Args: { p_user_id: string }
        Returns: {
          company_anonymized: string
          company_id: string
          company_text: string
          created_at: string
          description: string
          display_order: number
          employment_type: string
          ended_at: string
          id: string
          is_current: boolean
          join_reason: string
          role_category_id: string
          role_title: string
          started_at: string
          updated_at: string
          user_id: string
          visibility_company: string
          visibility_reason: boolean
        }[]
      }
      is_solicitation_blocked: {
        Args: { p_candidate_id: string }
        Returns: boolean
      }
      merge_role: {
        Args: { from_role_id: string; to_role_id: string }
        Returns: Json
      }
      normalize_company_name: { Args: { p_name: string }; Returns: string }
      ow_uploads_can_write: { Args: { object_name: string }; Returns: boolean }
      purge_old_page_views: { Args: never; Returns: undefined }
      rebuild_ow_transitions: { Args: never; Returns: number }
      reject_school_request: {
        Args: { p_approved_by: string; p_request_id: string }
        Returns: {
          rejected_at: string
        }[]
      }
      set_company_business_domains: {
        Args: {
          p_company_id: string
          p_domain_ids: string[]
          p_primary_domain_id: string
        }
        Returns: number
      }
    }
    Enums: {
      engagement_status_enum: "none" | "verified" | "contracted"
      listing_status_enum: "draft" | "listed"
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
      engagement_status_enum: ["none", "verified", "contracted"],
      listing_status_enum: ["draft", "listed"],
    },
  },
} as const
