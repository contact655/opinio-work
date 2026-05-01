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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_client_relations: {
        Row: {
          agent_tenant_id: string | null
          created_at: string | null
          hiring_tenant_id: string | null
          id: string
          status: string | null
        }
        Insert: {
          agent_tenant_id?: string | null
          created_at?: string | null
          hiring_tenant_id?: string | null
          id?: string
          status?: string | null
        }
        Update: {
          agent_tenant_id?: string | null
          created_at?: string | null
          hiring_tenant_id?: string | null
          id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_client_relations_agent_tenant_id_fkey"
            columns: ["agent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_client_relations_hiring_tenant_id_fkey"
            columns: ["hiring_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_company_access: {
        Row: {
          agent_id: string
          company_id: string
          created_at: string | null
          id: string
          tenant_id: string | null
        }
        Insert: {
          agent_id: string
          company_id: string
          created_at?: string | null
          id?: string
          tenant_id?: string | null
        }
        Update: {
          agent_id?: string
          company_id?: string
          created_at?: string | null
          id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_company_access_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_company_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_company_access_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_members: {
        Row: {
          agent_tenant_id: string | null
          created_at: string | null
          email: string
          id: string
          name: string | null
          role: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          agent_tenant_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          role?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          agent_tenant_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          role?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_members_agent_tenant_id_fkey"
            columns: ["agent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          auth_user_id: string | null
          company_name: string
          created_at: string | null
          email: string
          id: string
          name: string
          role: string | null
          status: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          company_name?: string
          created_at?: string | null
          email: string
          id?: string
          name: string
          role?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          company_name?: string
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          role?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_interviews: {
        Row: {
          answers: Json | null
          candidate_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          duration_minutes: number
          expires_at: string | null
          id: string
          interview_type: string
          job_id: string | null
          notes: string | null
          question_count: number
          questions: Json | null
          report: string | null
          scores: Json | null
          started_at: string | null
          status: string
          tenant_id: string
          title: string
          token: string
          updated_at: string
        }
        Insert: {
          answers?: Json | null
          candidate_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          duration_minutes?: number
          expires_at?: string | null
          id?: string
          interview_type?: string
          job_id?: string | null
          notes?: string | null
          question_count?: number
          questions?: Json | null
          report?: string | null
          scores?: Json | null
          started_at?: string | null
          status?: string
          tenant_id: string
          title?: string
          token?: string
          updated_at?: string
        }
        Update: {
          answers?: Json | null
          candidate_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          duration_minutes?: number
          expires_at?: string | null
          id?: string
          interview_type?: string
          job_id?: string | null
          notes?: string | null
          question_count?: number
          questions?: Json | null
          report?: string | null
          scores?: Json | null
          started_at?: string | null
          status?: string
          tenant_id?: string
          title?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          agent_id: string | null
          application_type: string
          applied_at: string | null
          candidate_id: string
          id: string
          job_id: string
          motivation: string | null
          notes: string | null
          status: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          application_type?: string
          applied_at?: string | null
          candidate_id: string
          id?: string
          job_id: string
          motivation?: string | null
          notes?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          application_type?: string
          applied_at?: string | null
          candidate_id?: string
          id?: string
          job_id?: string
          motivation?: string | null
          notes?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_certifications: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          name?: string
          tenant_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_certifications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_documents: {
        Row: {
          candidate_id: string | null
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          storage_path: string
          tenant_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          storage_path: string
          tenant_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          storage_path?: string
          tenant_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_educations: {
        Row: {
          candidate_id: string
          created_at: string
          end_year: number | null
          faculty: string | null
          id: string
          school: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          end_year?: number | null
          faculty?: string | null
          id?: string
          school?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          end_year?: number | null
          faculty?: string | null
          id?: string
          school?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_educations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_hearings: {
        Row: {
          application_id: string | null
          candidate_id: string
          concerns: string | null
          created_at: string
          id: string
          job_change_timing: string | null
          motivation_score: number
          other_companies: string[] | null
          stage: string
          tenant_id: string
        }
        Insert: {
          application_id?: string | null
          candidate_id: string
          concerns?: string | null
          created_at?: string
          id?: string
          job_change_timing?: string | null
          motivation_score: number
          other_companies?: string[] | null
          stage?: string
          tenant_id: string
        }
        Update: {
          application_id?: string | null
          candidate_id?: string
          concerns?: string | null
          created_at?: string
          id?: string
          job_change_timing?: string | null
          motivation_score?: number
          other_companies?: string[] | null
          stage?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_hearings_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_hearings_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_hearings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_job_activities: {
        Row: {
          candidate_id: string | null
          company_name: string
          created_at: string | null
          id: string
          motivation: string | null
          notes: string | null
          position: string | null
          stage: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          candidate_id?: string | null
          company_name: string
          created_at?: string | null
          id?: string
          motivation?: string | null
          notes?: string | null
          position?: string | null
          stage?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string | null
          company_name?: string
          created_at?: string | null
          id?: string
          motivation?: string | null
          notes?: string | null
          position?: string | null
          stage?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_job_activities_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_messages: {
        Row: {
          body: string | null
          candidate_id: string | null
          id: string
          sent_at: string | null
          sent_by: string | null
          subject: string | null
          tenant_id: string | null
          type: string | null
        }
        Insert: {
          body?: string | null
          candidate_id?: string | null
          id?: string
          sent_at?: string | null
          sent_by?: string | null
          subject?: string | null
          tenant_id?: string | null
          type?: string | null
        }
        Update: {
          body?: string | null
          candidate_id?: string | null
          id?: string
          sent_at?: string | null
          sent_by?: string | null
          subject?: string | null
          tenant_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_messages_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_notes: {
        Row: {
          candidate_id: string | null
          created_at: string | null
          id: string
          tenant_id: string | null
          text: string
          who: string | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          tenant_id?: string | null
          text: string
          who?: string | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          tenant_id?: string | null
          text?: string
          who?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_timeline_events: {
        Row: {
          application_id: string | null
          candidate_id: string
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          description: string | null
          evaluation_id: string | null
          event_type: string
          id: string
          interview_date: string | null
          interview_location: string | null
          interview_status: string | null
          interview_url: string | null
          interviewer_name: string | null
          tenant_id: string | null
          title: string
        }
        Insert: {
          application_id?: string | null
          candidate_id: string
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          evaluation_id?: string | null
          event_type: string
          id?: string
          interview_date?: string | null
          interview_location?: string | null
          interview_status?: string | null
          interview_url?: string | null
          interviewer_name?: string | null
          tenant_id?: string | null
          title: string
        }
        Update: {
          application_id?: string | null
          candidate_id?: string
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          evaluation_id?: string | null
          event_type?: string
          id?: string
          interview_date?: string | null
          interview_location?: string | null
          interview_status?: string | null
          interview_url?: string | null
          interviewer_name?: string | null
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_timeline_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_timeline_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_timeline_events_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_timeline_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_work_histories: {
        Row: {
          candidate_id: string
          company: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          position: string | null
          start_date: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          company?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          position?: string | null
          start_date?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          company?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          position?: string | null
          start_date?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_work_histories_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          age: number | null
          created_at: string | null
          current_company: string | null
          current_salary: number | null
          current_title: string | null
          desired_salary: number | null
          email: string
          first_name: string
          github_url: string | null
          id: string
          joining_timing: string | null
          last_name: string
          linkedin_url: string | null
          minimum_salary: number | null
          nearest_station: string | null
          notes: string | null
          phone: string | null
          portal_token: string | null
          priority_rank: number | null
          resume_url: string | null
          salary_hard_min: number | null
          skills: string[] | null
          source: string | null
          tenant_id: string | null
          university_deviation_value: number | null
          updated_at: string | null
          years_of_experience: number | null
        }
        Insert: {
          age?: number | null
          created_at?: string | null
          current_company?: string | null
          current_salary?: number | null
          current_title?: string | null
          desired_salary?: number | null
          email: string
          first_name: string
          github_url?: string | null
          id?: string
          joining_timing?: string | null
          last_name: string
          linkedin_url?: string | null
          minimum_salary?: number | null
          nearest_station?: string | null
          notes?: string | null
          phone?: string | null
          portal_token?: string | null
          priority_rank?: number | null
          resume_url?: string | null
          salary_hard_min?: number | null
          skills?: string[] | null
          source?: string | null
          tenant_id?: string | null
          university_deviation_value?: number | null
          updated_at?: string | null
          years_of_experience?: number | null
        }
        Update: {
          age?: number | null
          created_at?: string | null
          current_company?: string | null
          current_salary?: number | null
          current_title?: string | null
          desired_salary?: number | null
          email?: string
          first_name?: string
          github_url?: string | null
          id?: string
          joining_timing?: string | null
          last_name?: string
          linkedin_url?: string | null
          minimum_salary?: number | null
          nearest_station?: string | null
          notes?: string | null
          phone?: string | null
          portal_token?: string | null
          priority_rank?: number | null
          resume_url?: string | null
          salary_hard_min?: number | null
          skills?: string[] | null
          source?: string | null
          tenant_id?: string | null
          university_deviation_value?: number | null
          updated_at?: string | null
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      competing_offers: {
        Row: {
          candidate_id: string | null
          company_name: string
          created_at: string | null
          id: string
          notes: string | null
          stage: string | null
          tenant_id: string | null
        }
        Insert: {
          candidate_id?: string | null
          company_name: string
          created_at?: string | null
          id?: string
          notes?: string | null
          stage?: string | null
          tenant_id?: string | null
        }
        Update: {
          candidate_id?: string | null
          company_name?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          stage?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competing_offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competing_offers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      concurrent_applications: {
        Row: {
          candidate_id: string
          company_name: string
          created_at: string | null
          id: string
          job_title: string | null
          memo: string | null
          priority: number | null
          selection_stage: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          candidate_id: string
          company_name: string
          created_at?: string | null
          id?: string
          job_title?: string | null
          memo?: string | null
          priority?: number | null
          selection_stage?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string
          company_name?: string
          created_at?: string | null
          id?: string
          job_title?: string | null
          memo?: string | null
          priority?: number | null
          selection_stage?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concurrent_applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_cases: {
        Row: {
          action_taken: string | null
          anon_profile: string
          consent_given: boolean | null
          consulted_at: string | null
          created_at: string | null
          display_order: number | null
          id: string
          insight: string
          is_published: boolean | null
          mentor_id: string | null
          worry_category: string
          worry_summary: string
        }
        Insert: {
          action_taken?: string | null
          anon_profile: string
          consent_given?: boolean | null
          consulted_at?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          insight: string
          is_published?: boolean | null
          mentor_id?: string | null
          worry_category: string
          worry_summary: string
        }
        Update: {
          action_taken?: string | null
          anon_profile?: string
          consent_given?: boolean | null
          consulted_at?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          insight?: string
          is_published?: boolean | null
          mentor_id?: string | null
          worry_category?: string
          worry_summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_cases_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "ow_mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_type: string
          agent_tenant_id: string
          content: string
          created_at: string
          created_by: string | null
          crm_candidate_id: string
          id: string
        }
        Insert: {
          activity_type?: string
          agent_tenant_id: string
          content?: string
          created_at?: string
          created_by?: string | null
          crm_candidate_id: string
          id?: string
        }
        Update: {
          activity_type?: string
          agent_tenant_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          crm_candidate_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_agent_tenant_id_fkey"
            columns: ["agent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_crm_candidate_id_fkey"
            columns: ["crm_candidate_id"]
            isOneToOne: false
            referencedRelation: "crm_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_applications: {
        Row: {
          agent_tenant_id: string | null
          company_name: string | null
          created_at: string | null
          crm_candidate_id: string | null
          id: string
          job_id: string | null
          job_title: string | null
          notes: string | null
          stage: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          agent_tenant_id?: string | null
          company_name?: string | null
          created_at?: string | null
          crm_candidate_id?: string | null
          id?: string
          job_id?: string | null
          job_title?: string | null
          notes?: string | null
          stage?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_tenant_id?: string | null
          company_name?: string | null
          created_at?: string | null
          crm_candidate_id?: string | null
          id?: string
          job_id?: string | null
          job_title?: string | null
          notes?: string | null
          stage?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_applications_agent_tenant_id_fkey"
            columns: ["agent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_applications_crm_candidate_id_fkey"
            columns: ["crm_candidate_id"]
            isOneToOne: false
            referencedRelation: "crm_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_candidates: {
        Row: {
          agent_tenant_id: string | null
          created_at: string | null
          current_company: string | null
          current_position: string | null
          current_salary: number | null
          date_of_birth: string | null
          desired_location: string | null
          desired_salary_max: number | null
          desired_salary_min: number | null
          email: string | null
          experience_years: number | null
          first_name: string
          gender: string | null
          id: string
          last_name: string
          memo: string | null
          phone: string | null
          skills: string[] | null
          status: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          agent_tenant_id?: string | null
          created_at?: string | null
          current_company?: string | null
          current_position?: string | null
          current_salary?: number | null
          date_of_birth?: string | null
          desired_location?: string | null
          desired_salary_max?: number | null
          desired_salary_min?: number | null
          email?: string | null
          experience_years?: number | null
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          memo?: string | null
          phone?: string | null
          skills?: string[] | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          agent_tenant_id?: string | null
          created_at?: string | null
          current_company?: string | null
          current_position?: string | null
          current_salary?: number | null
          date_of_birth?: string | null
          desired_location?: string | null
          desired_salary_max?: number | null
          desired_salary_min?: number | null
          email?: string | null
          experience_years?: number | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          memo?: string | null
          phone?: string | null
          skills?: string[] | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_candidates_agent_tenant_id_fkey"
            columns: ["agent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_client_companies: {
        Row: {
          agent_tenant_id: string
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          industry: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          agent_tenant_id: string
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          agent_tenant_id?: string
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_client_companies_agent_tenant_id_fkey"
            columns: ["agent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_interviews: {
        Row: {
          agent_tenant_id: string
          created_at: string
          created_by: string | null
          crm_candidate_id: string
          id: string
          interview_type: string
          location: string | null
          notes: string | null
          scheduled_at: string
          status: string
        }
        Insert: {
          agent_tenant_id: string
          created_at?: string
          created_by?: string | null
          crm_candidate_id: string
          id?: string
          interview_type?: string
          location?: string | null
          notes?: string | null
          scheduled_at: string
          status?: string
        }
        Update: {
          agent_tenant_id?: string
          created_at?: string
          created_by?: string | null
          crm_candidate_id?: string
          id?: string
          interview_type?: string
          location?: string | null
          notes?: string | null
          scheduled_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_interviews_agent_tenant_id_fkey"
            columns: ["agent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_interviews_crm_candidate_id_fkey"
            columns: ["crm_candidate_id"]
            isOneToOne: false
            referencedRelation: "crm_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_jobs: {
        Row: {
          benefits: string | null
          created_at: string | null
          description: string | null
          employer_id: string | null
          employment_type: string | null
          expires_at: string | null
          id: string
          job_type: string | null
          location: string | null
          preferred: string | null
          products: string[] | null
          remote_type: string | null
          requirements: string | null
          salary_max: number | null
          salary_min: number | null
          selection_flow: string | null
          status: string | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          benefits?: string | null
          created_at?: string | null
          description?: string | null
          employer_id?: string | null
          employment_type?: string | null
          expires_at?: string | null
          id?: string
          job_type?: string | null
          location?: string | null
          preferred?: string | null
          products?: string[] | null
          remote_type?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          selection_flow?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          benefits?: string | null
          created_at?: string | null
          description?: string | null
          employer_id?: string | null
          employment_type?: string | null
          expires_at?: string | null
          id?: string
          job_type?: string | null
          location?: string | null
          preferred?: string | null
          products?: string[] | null
          remote_type?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          selection_flow?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employer_jobs_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_profiles: {
        Row: {
          company_name: string
          company_url: string | null
          contact_name: string
          created_at: string | null
          email: string
          employee_count: string | null
          id: string
          industry: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company_name: string
          company_url?: string | null
          contact_name: string
          created_at?: string | null
          email: string
          employee_count?: string | null
          id?: string
          industry?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_name?: string
          company_url?: string | null
          contact_name?: string
          created_at?: string | null
          email?: string
          employee_count?: string | null
          id?: string
          industry?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      evaluations: {
        Row: {
          application_id: string | null
          average_score: number | null
          candidate_id: string
          comment: string | null
          created_at: string | null
          evaluated_at: string | null
          evaluator_id: string | null
          evaluator_name: string | null
          id: string
          score_communication: number
          score_culture_fit: number
          score_growth: number
          score_leadership: number
          score_technical: number
          tenant_id: string | null
        }
        Insert: {
          application_id?: string | null
          average_score?: number | null
          candidate_id: string
          comment?: string | null
          created_at?: string | null
          evaluated_at?: string | null
          evaluator_id?: string | null
          evaluator_name?: string | null
          id?: string
          score_communication?: number
          score_culture_fit?: number
          score_growth?: number
          score_leadership?: number
          score_technical?: number
          tenant_id?: string | null
        }
        Update: {
          application_id?: string | null
          average_score?: number | null
          candidate_id?: string
          comment?: string | null
          created_at?: string | null
          evaluated_at?: string | null
          evaluator_id?: string | null
          evaluator_name?: string | null
          id?: string
          score_communication?: number
          score_culture_fit?: number
          score_growth?: number
          score_leadership?: number
          score_technical?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      iv_companies: {
        Row: {
          axes: Json
          created_at: string | null
          id: string
          jd_text: string
          name: string
          q_count: number
        }
        Insert: {
          axes?: Json
          created_at?: string | null
          id?: string
          jd_text?: string
          name: string
          q_count?: number
        }
        Update: {
          axes?: Json
          created_at?: string | null
          id?: string
          jd_text?: string
          name?: string
          q_count?: number
        }
        Relationships: []
      }
      iv_interviews: {
        Row: {
          candidate_name: string
          company_id: string
          completed_at: string | null
          created_at: string | null
          eval_json: Json | null
          id: string
          score: number | null
          started_at: string | null
          status: string
          verdict: string | null
        }
        Insert: {
          candidate_name?: string
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          eval_json?: Json | null
          id?: string
          score?: number | null
          started_at?: string | null
          status?: string
          verdict?: string | null
        }
        Update: {
          candidate_name?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          eval_json?: Json | null
          id?: string
          score?: number | null
          started_at?: string | null
          status?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iv_interviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "iv_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      iv_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          interview_id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          interview_id: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          interview_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "iv_messages_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "iv_interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      job_interests: {
        Row: {
          created_at: string | null
          id: string
          interest_type: string | null
          job_id: string | null
          talent_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          interest_type?: string | null
          job_id?: string | null
          talent_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          interest_type?: string | null
          job_id?: string | null
          talent_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_interests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "employer_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          appeal: string | null
          benefits: string | null
          category: string | null
          company_id: string | null
          created_at: string | null
          department: string
          description: string
          expected_start: string | null
          experience_level: string
          headcount: number | null
          hiring_deadline: string | null
          holidays: string | null
          id: string
          insurance: string | null
          is_published: boolean
          job_type: string
          location: string
          opinio_comment: string | null
          personality: string | null
          position_level: string | null
          preferred_skills: string | null
          probation_period: string | null
          remote_type: string | null
          required_skills: string | null
          requirements: string
          salary_max: number | null
          salary_min: number | null
          selection_flow: string | null
          selection_steps: number | null
          status: string
          target_count: number | null
          team_info: string | null
          tech_stack: string[] | null
          tenant_id: string | null
          title: string
          updated_at: string | null
          working_hours: string | null
        }
        Insert: {
          appeal?: string | null
          benefits?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          department?: string
          description?: string
          expected_start?: string | null
          experience_level?: string
          headcount?: number | null
          hiring_deadline?: string | null
          holidays?: string | null
          id?: string
          insurance?: string | null
          is_published?: boolean
          job_type?: string
          location?: string
          opinio_comment?: string | null
          personality?: string | null
          position_level?: string | null
          preferred_skills?: string | null
          probation_period?: string | null
          remote_type?: string | null
          required_skills?: string | null
          requirements?: string
          salary_max?: number | null
          salary_min?: number | null
          selection_flow?: string | null
          selection_steps?: number | null
          status?: string
          target_count?: number | null
          team_info?: string | null
          tech_stack?: string[] | null
          tenant_id?: string | null
          title: string
          updated_at?: string | null
          working_hours?: string | null
        }
        Update: {
          appeal?: string | null
          benefits?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          department?: string
          description?: string
          expected_start?: string | null
          experience_level?: string
          headcount?: number | null
          hiring_deadline?: string | null
          holidays?: string | null
          id?: string
          insurance?: string | null
          is_published?: boolean
          job_type?: string
          location?: string
          opinio_comment?: string | null
          personality?: string | null
          position_level?: string | null
          preferred_skills?: string | null
          probation_period?: string | null
          remote_type?: string | null
          required_skills?: string | null
          requirements?: string
          salary_max?: number | null
          salary_min?: number | null
          selection_flow?: string | null
          selection_steps?: number | null
          status?: string
          target_count?: number | null
          team_info?: string | null
          tech_stack?: string[] | null
          tenant_id?: string | null
          title?: string
          updated_at?: string | null
          working_hours?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nurturing_candidates: {
        Row: {
          candidate_id: string | null
          contact_interval_months: number | null
          created_at: string | null
          id: string
          memo: string | null
          next_contact_at: string | null
          reason: string | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          candidate_id?: string | null
          contact_interval_months?: number | null
          created_at?: string | null
          id?: string
          memo?: string | null
          next_contact_at?: string | null
          reason?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          candidate_id?: string | null
          contact_interval_months?: number | null
          created_at?: string | null
          id?: string
          memo?: string | null
          next_contact_at?: string | null
          reason?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nurturing_candidates_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nurturing_candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_letters: {
        Row: {
          application_id: string | null
          candidate_id: string
          content: string
          created_at: string
          decline_reason: string | null
          id: string
          job_id: string | null
          manager_message: string | null
          responded_at: string | null
          status: string
          strengths: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          candidate_id: string
          content?: string
          created_at?: string
          decline_reason?: string | null
          id?: string
          job_id?: string | null
          manager_message?: string | null
          responded_at?: string | null
          status?: string
          strengths?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          candidate_id?: string
          content?: string
          created_at?: string
          decline_reason?: string | null
          id?: string
          job_id?: string | null
          manager_message?: string | null
          responded_at?: string | null
          status?: string
          strengths?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_letters_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_letters_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_letters_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_letters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      ow_casual_meetings: {
        Row: {
          assignee_user_id: string | null
          company_id: string
          company_internal_memo: string | null
          company_read_at: string | null
          contact_email: string
          created_at: string
          id: string
          intent: string | null
          interest_reason: string | null
          job_id: string | null
          preferred_format: string | null
          questions: string | null
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
          contact_email: string
          created_at?: string
          id?: string
          intent?: string | null
          interest_reason?: string | null
          job_id?: string | null
          preferred_format?: string | null
          questions?: string | null
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
          contact_email?: string
          created_at?: string
          id?: string
          intent?: string | null
          interest_reason?: string | null
          job_id?: string | null
          preferred_format?: string | null
          questions?: string | null
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
          avg_age: number | null
          avg_overtime: number | null
          avg_overtime_hours: string | null
          avg_salary: string | null
          avg_selection_weeks: number | null
          avg_tenure: string | null
          avg_tenure_years: string | null
          benefits: string[] | null
          bonus_times: number | null
          brand_color: string | null
          business_stage: string | null
          casual_interview_url: string | null
          ceo_name: string | null
          childcare_leave_rate: string | null
          core_time: string | null
          cover_color: string | null
          created_at: string | null
          culture_description: string | null
          description: string | null
          draft_data: Json | null
          employee_count: string | null
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
          has_book_allowance: boolean | null
          has_health_support: boolean | null
          has_housing_allowance: boolean | null
          has_incentive: boolean | null
          has_internal_transfer: boolean | null
          has_learning_support: boolean | null
          has_meal_allowance: boolean | null
          has_stock_option: boolean | null
          header_image_url: string | null
          headquarters_address: string | null
          id: string
          incentive_detail: string | null
          industry: string | null
          is_published: boolean
          location: string | null
          logo_gradient: string | null
          logo_letter: string | null
          logo_url: string | null
          management_style: string | null
          maternity_leave_female: number | null
          maternity_leave_male: number | null
          mid_career_ratio: number | null
          mission: string | null
          name: string
          name_en: string | null
          nearest_station: string | null
          notification_emails: string[] | null
          office_count: string | null
          office_days_per_week: string | null
          official_language: string | null
          one_on_one_freq: string | null
          opinio_comment: string | null
          paid_leave_rate: number | null
          phase: string | null
          plan: string | null
          prev_career_note: string | null
          published_at: string | null
          recruiter_avatar_url: string | null
          recruiter_message: string | null
          recruiter_name: string | null
          recruiter_role: string | null
          remote_rate: number | null
          remote_work_status: string | null
          salary_raise_frequency: string | null
          salary_review_times: number | null
          selection_count: number | null
          selection_flow: string[] | null
          side_job_ok: boolean | null
          status: string | null
          tagline: string | null
          top_down_ratio: number | null
          turnover_rate: string | null
          updated_at: string | null
          url: string | null
          user_id: string | null
          why_join: string | null
          work_time_system: string | null
          workstyle_description: string | null
        }
        Insert: {
          about_markdown?: string | null
          accepting_casual_meetings?: boolean
          annual_hire_count?: string | null
          annual_holiday_days?: number | null
          arr_scale?: string | null
          autonomy_level?: string | null
          avg_age?: number | null
          avg_overtime?: number | null
          avg_overtime_hours?: string | null
          avg_salary?: string | null
          avg_selection_weeks?: number | null
          avg_tenure?: string | null
          avg_tenure_years?: string | null
          benefits?: string[] | null
          bonus_times?: number | null
          brand_color?: string | null
          business_stage?: string | null
          casual_interview_url?: string | null
          ceo_name?: string | null
          childcare_leave_rate?: string | null
          core_time?: string | null
          cover_color?: string | null
          created_at?: string | null
          culture_description?: string | null
          description?: string | null
          draft_data?: Json | null
          employee_count?: string | null
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
          has_book_allowance?: boolean | null
          has_health_support?: boolean | null
          has_housing_allowance?: boolean | null
          has_incentive?: boolean | null
          has_internal_transfer?: boolean | null
          has_learning_support?: boolean | null
          has_meal_allowance?: boolean | null
          has_stock_option?: boolean | null
          header_image_url?: string | null
          headquarters_address?: string | null
          id?: string
          incentive_detail?: string | null
          industry?: string | null
          is_published?: boolean
          location?: string | null
          logo_gradient?: string | null
          logo_letter?: string | null
          logo_url?: string | null
          management_style?: string | null
          maternity_leave_female?: number | null
          maternity_leave_male?: number | null
          mid_career_ratio?: number | null
          mission?: string | null
          name: string
          name_en?: string | null
          nearest_station?: string | null
          notification_emails?: string[] | null
          office_count?: string | null
          office_days_per_week?: string | null
          official_language?: string | null
          one_on_one_freq?: string | null
          opinio_comment?: string | null
          paid_leave_rate?: number | null
          phase?: string | null
          plan?: string | null
          prev_career_note?: string | null
          published_at?: string | null
          recruiter_avatar_url?: string | null
          recruiter_message?: string | null
          recruiter_name?: string | null
          recruiter_role?: string | null
          remote_rate?: number | null
          remote_work_status?: string | null
          salary_raise_frequency?: string | null
          salary_review_times?: number | null
          selection_count?: number | null
          selection_flow?: string[] | null
          side_job_ok?: boolean | null
          status?: string | null
          tagline?: string | null
          top_down_ratio?: number | null
          turnover_rate?: string | null
          updated_at?: string | null
          url?: string | null
          user_id?: string | null
          why_join?: string | null
          work_time_system?: string | null
          workstyle_description?: string | null
        }
        Update: {
          about_markdown?: string | null
          accepting_casual_meetings?: boolean
          annual_hire_count?: string | null
          annual_holiday_days?: number | null
          arr_scale?: string | null
          autonomy_level?: string | null
          avg_age?: number | null
          avg_overtime?: number | null
          avg_overtime_hours?: string | null
          avg_salary?: string | null
          avg_selection_weeks?: number | null
          avg_tenure?: string | null
          avg_tenure_years?: string | null
          benefits?: string[] | null
          bonus_times?: number | null
          brand_color?: string | null
          business_stage?: string | null
          casual_interview_url?: string | null
          ceo_name?: string | null
          childcare_leave_rate?: string | null
          core_time?: string | null
          cover_color?: string | null
          created_at?: string | null
          culture_description?: string | null
          description?: string | null
          draft_data?: Json | null
          employee_count?: string | null
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
          has_book_allowance?: boolean | null
          has_health_support?: boolean | null
          has_housing_allowance?: boolean | null
          has_incentive?: boolean | null
          has_internal_transfer?: boolean | null
          has_learning_support?: boolean | null
          has_meal_allowance?: boolean | null
          has_stock_option?: boolean | null
          header_image_url?: string | null
          headquarters_address?: string | null
          id?: string
          incentive_detail?: string | null
          industry?: string | null
          is_published?: boolean
          location?: string | null
          logo_gradient?: string | null
          logo_letter?: string | null
          logo_url?: string | null
          management_style?: string | null
          maternity_leave_female?: number | null
          maternity_leave_male?: number | null
          mid_career_ratio?: number | null
          mission?: string | null
          name?: string
          name_en?: string | null
          nearest_station?: string | null
          notification_emails?: string[] | null
          office_count?: string | null
          office_days_per_week?: string | null
          official_language?: string | null
          one_on_one_freq?: string | null
          opinio_comment?: string | null
          paid_leave_rate?: number | null
          phase?: string | null
          plan?: string | null
          prev_career_note?: string | null
          published_at?: string | null
          recruiter_avatar_url?: string | null
          recruiter_message?: string | null
          recruiter_name?: string | null
          recruiter_role?: string | null
          remote_rate?: number | null
          remote_work_status?: string | null
          salary_raise_frequency?: string | null
          salary_review_times?: number | null
          selection_count?: number | null
          selection_flow?: string[] | null
          side_job_ok?: boolean | null
          status?: string | null
          tagline?: string | null
          top_down_ratio?: number | null
          turnover_rate?: string | null
          updated_at?: string | null
          url?: string | null
          user_id?: string | null
          why_join?: string | null
          work_time_system?: string | null
          workstyle_description?: string | null
        }
        Relationships: []
      }
      ow_company_admins: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          department: string | null
          id: string
          invitation_token: string | null
          invited_at: string | null
          invited_by_user_id: string | null
          invited_email: string | null
          is_active: boolean
          is_default: boolean
          joined_at: string | null
          permission: string
          role_title: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          department?: string | null
          id?: string
          invitation_token?: string | null
          invited_at?: string | null
          invited_by_user_id?: string | null
          invited_email?: string | null
          is_active?: boolean
          is_default?: boolean
          joined_at?: string | null
          permission?: string
          role_title?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          department?: string | null
          id?: string
          invitation_token?: string | null
          invited_at?: string | null
          invited_by_user_id?: string | null
          invited_email?: string | null
          is_active?: boolean
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
      ow_company_members: {
        Row: {
          background: string | null
          company_id: string | null
          display_order: number | null
          id: string
          job_types: string[] | null
          name: string | null
          photo_url: string | null
          role: string | null
        }
        Insert: {
          background?: string | null
          company_id?: string | null
          display_order?: number | null
          id?: string
          job_types?: string[] | null
          name?: string | null
          photo_url?: string | null
          role?: string | null
        }
        Update: {
          background?: string | null
          company_id?: string | null
          display_order?: number | null
          id?: string
          job_types?: string[] | null
          name?: string | null
          photo_url?: string | null
          role?: string | null
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
        }
        Insert: {
          caption?: string | null
          category: string
          company_id: string
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
        }
        Update: {
          caption?: string | null
          category?: string
          company_id?: string
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
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
      ow_company_photos: {
        Row: {
          company_id: string | null
          display_order: number | null
          id: string
          is_main: boolean | null
          photo_url: string | null
        }
        Insert: {
          company_id?: string | null
          display_order?: number | null
          id?: string
          is_main?: boolean | null
          photo_url?: string | null
        }
        Update: {
          company_id?: string | null
          display_order?: number | null
          id?: string
          is_main?: boolean | null
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_company_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_company_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_company_reviews: {
        Row: {
          company_id: string
          content: string
          created_at: string | null
          id: string
          is_approved: boolean | null
          rating: number | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          rating?: number | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          rating?: number | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ow_consultations: {
        Row: {
          candidate_id: string | null
          consultation_date: string | null
          consulted_at: string
          created_at: string | null
          duration_min: number | null
          id: string
          is_shareable: boolean | null
          memo: string | null
          mentor_id: string | null
          mentor_name: string | null
          summary: string | null
          tags: string[] | null
          topic: string | null
          user_id: string | null
        }
        Insert: {
          candidate_id?: string | null
          consultation_date?: string | null
          consulted_at: string
          created_at?: string | null
          duration_min?: number | null
          id?: string
          is_shareable?: boolean | null
          memo?: string | null
          mentor_id?: string | null
          mentor_name?: string | null
          summary?: string | null
          tags?: string[] | null
          topic?: string | null
          user_id?: string | null
        }
        Update: {
          candidate_id?: string | null
          consultation_date?: string | null
          consulted_at?: string
          created_at?: string | null
          duration_min?: number | null
          id?: string
          is_shareable?: boolean | null
          memo?: string | null
          mentor_id?: string | null
          mentor_name?: string | null
          summary?: string | null
          tags?: string[] | null
          topic?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_consultations_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "ow_mentors"
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
          description: string | null
          display_order: number
          ended_at: string | null
          id: string
          is_current: boolean
          role_category_id: string
          role_title: string | null
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_anonymized?: string | null
          company_id?: string | null
          company_text?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          ended_at?: string | null
          id?: string
          is_current?: boolean
          role_category_id: string
          role_title?: string | null
          started_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_anonymized?: string | null
          company_id?: string | null
          company_text?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          ended_at?: string | null
          id?: string
          is_current?: boolean
          role_category_id?: string
          role_title?: string | null
          started_at?: string
          updated_at?: string
          user_id?: string
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
      ow_invoices: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          invoice_date: string
          notes: string | null
          related_candidate_id: string | null
          related_job_id: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          invoice_date: string
          notes?: string | null
          related_candidate_id?: string | null
          related_job_id?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          invoice_date?: string
          notes?: string | null
          related_candidate_id?: string | null
          related_job_id?: string | null
          status?: string
          tenant_id?: string
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
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ow_job_applications: {
        Row: {
          created_at: string | null
          email: string
          id: string
          job_id: string
          message: string | null
          name: string
          phone: string | null
          resume_url: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          job_id: string
          message?: string | null
          name: string
          phone?: string | null
          resume_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          job_id?: string
          message?: string | null
          name?: string
          phone?: string | null
          resume_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
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
          catch_copy: string | null
          company_id: string | null
          created_at: string | null
          culture_fit: string | null
          department: string | null
          description: string | null
          description_markdown: string | null
          employment_type: string | null
          expires_at: string | null
          fit_negatives: Json | null
          fit_positives: Json | null
          gradient_preset: string | null
          holidays: string | null
          id: string
          job_category: string | null
          location: string | null
          main_image_url: string | null
          message_to_candidates: string | null
          negatives: string[] | null
          one_liner: string | null
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
          selection_duration: string | null
          selection_flow: string[] | null
          selection_process: Json | null
          selection_steps: string[] | null
          start_date_preference: string | null
          status: string | null
          submitted_at: string | null
          title: string
          trial_period: string | null
          updated_at: string | null
          what_youll_do_intro: string | null
          who_we_want_intro: string | null
          why_we_exist: string | null
          work_hours: string | null
          work_style: string | null
        }
        Insert: {
          appeal?: string | null
          avg_overtime?: string | null
          benefits?: string | null
          catch_copy?: string | null
          company_id?: string | null
          created_at?: string | null
          culture_fit?: string | null
          department?: string | null
          description?: string | null
          description_markdown?: string | null
          employment_type?: string | null
          expires_at?: string | null
          fit_negatives?: Json | null
          fit_positives?: Json | null
          gradient_preset?: string | null
          holidays?: string | null
          id?: string
          job_category?: string | null
          location?: string | null
          main_image_url?: string | null
          message_to_candidates?: string | null
          negatives?: string[] | null
          one_liner?: string | null
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
          selection_duration?: string | null
          selection_flow?: string[] | null
          selection_process?: Json | null
          selection_steps?: string[] | null
          start_date_preference?: string | null
          status?: string | null
          submitted_at?: string | null
          title: string
          trial_period?: string | null
          updated_at?: string | null
          what_youll_do_intro?: string | null
          who_we_want_intro?: string | null
          why_we_exist?: string | null
          work_hours?: string | null
          work_style?: string | null
        }
        Update: {
          appeal?: string | null
          avg_overtime?: string | null
          benefits?: string | null
          catch_copy?: string | null
          company_id?: string | null
          created_at?: string | null
          culture_fit?: string | null
          department?: string | null
          description?: string | null
          description_markdown?: string | null
          employment_type?: string | null
          expires_at?: string | null
          fit_negatives?: Json | null
          fit_positives?: Json | null
          gradient_preset?: string | null
          holidays?: string | null
          id?: string
          job_category?: string | null
          location?: string | null
          main_image_url?: string | null
          message_to_candidates?: string | null
          negatives?: string[] | null
          one_liner?: string | null
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
          selection_duration?: string | null
          selection_flow?: string[] | null
          selection_process?: Json | null
          selection_steps?: string[] | null
          start_date_preference?: string | null
          status?: string | null
          submitted_at?: string | null
          title?: string
          trial_period?: string | null
          updated_at?: string | null
          what_youll_do_intro?: string | null
          who_we_want_intro?: string | null
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
            foreignKeyName: "ow_jobs_role_category_id_fkey"
            columns: ["role_category_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
        ]
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
      ow_mentor_reservations: {
        Row: {
          background: string | null
          contact_email: string
          created_at: string
          current_situation: string | null
          editor_note: string | null
          id: string
          mentor_id: string | null
          mentor_note: string | null
          mentor_user_id: string | null
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
          background?: string | null
          contact_email: string
          created_at?: string
          current_situation?: string | null
          editor_note?: string | null
          id?: string
          mentor_id?: string | null
          mentor_note?: string | null
          mentor_user_id?: string | null
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
          background?: string | null
          contact_email?: string
          created_at?: string
          current_situation?: string | null
          editor_note?: string | null
          id?: string
          mentor_id?: string | null
          mentor_note?: string | null
          mentor_user_id?: string | null
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
            foreignKeyName: "ow_mentor_reservations_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "ow_mentors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ow_mentor_reservations_mentor_user_id_fkey"
            columns: ["mentor_user_id"]
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
      ow_mentors: {
        Row: {
          avatar_color: string | null
          avatar_initial: string | null
          bio: string | null
          calendly_url: string | null
          catchphrase: string | null
          concerns: string[] | null
          created_at: string | null
          current_career: string | null
          current_company: string | null
          current_role: string | null
          display_order: number | null
          id: string
          is_available: boolean | null
          name: string
          previous_career: string | null
          question_tags: string[] | null
          roles: string[] | null
          success_count: number | null
          total_consultations: number | null
          total_sessions: number | null
          worries: string[] | null
        }
        Insert: {
          avatar_color?: string | null
          avatar_initial?: string | null
          bio?: string | null
          calendly_url?: string | null
          catchphrase?: string | null
          concerns?: string[] | null
          created_at?: string | null
          current_career?: string | null
          current_company?: string | null
          current_role?: string | null
          display_order?: number | null
          id?: string
          is_available?: boolean | null
          name: string
          previous_career?: string | null
          question_tags?: string[] | null
          roles?: string[] | null
          success_count?: number | null
          total_consultations?: number | null
          total_sessions?: number | null
          worries?: string[] | null
        }
        Update: {
          avatar_color?: string | null
          avatar_initial?: string | null
          bio?: string | null
          calendly_url?: string | null
          catchphrase?: string | null
          concerns?: string[] | null
          created_at?: string | null
          current_career?: string | null
          current_company?: string | null
          current_role?: string | null
          display_order?: number | null
          id?: string
          is_available?: boolean | null
          name?: string
          previous_career?: string | null
          question_tags?: string[] | null
          roles?: string[] | null
          success_count?: number | null
          total_consultations?: number | null
          total_sessions?: number | null
          worries?: string[] | null
        }
        Relationships: []
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
      ow_profiles: {
        Row: {
          bio: string | null
          created_at: string | null
          desired_phase: string[] | null
          desired_salary_max: number | null
          desired_salary_min: number | null
          desired_work_style: string | null
          experience_years: string | null
          id: string
          job_type: string | null
          location: string | null
          name: string | null
          name_kana: string | null
          onboarding_completed: boolean | null
          photo_url: string | null
          skills: string[] | null
          tools: string[] | null
          transfer_timing: string | null
          updated_at: string | null
          user_id: string | null
          worry: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          desired_phase?: string[] | null
          desired_salary_max?: number | null
          desired_salary_min?: number | null
          desired_work_style?: string | null
          experience_years?: string | null
          id?: string
          job_type?: string | null
          location?: string | null
          name?: string | null
          name_kana?: string | null
          onboarding_completed?: boolean | null
          photo_url?: string | null
          skills?: string[] | null
          tools?: string[] | null
          transfer_timing?: string | null
          updated_at?: string | null
          user_id?: string | null
          worry?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          desired_phase?: string[] | null
          desired_salary_max?: number | null
          desired_salary_min?: number | null
          desired_work_style?: string | null
          experience_years?: string | null
          id?: string
          job_type?: string | null
          location?: string | null
          name?: string | null
          name_kana?: string | null
          onboarding_completed?: boolean | null
          photo_url?: string | null
          skills?: string[] | null
          tools?: string[] | null
          transfer_timing?: string | null
          updated_at?: string | null
          user_id?: string | null
          worry?: string | null
        }
        Relationships: []
      }
      ow_roles: {
        Row: {
          created_at: string
          display_order: number
          icon_color: string | null
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          icon_color?: string | null
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          icon_color?: string | null
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ow_roles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ow_roles"
            referencedColumns: ["id"]
          },
        ]
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
      ow_scouts: {
        Row: {
          candidate_id: string | null
          company_id: string | null
          id: string
          job_id: string | null
          message: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          candidate_id?: string | null
          company_id?: string | null
          id?: string
          job_id?: string | null
          message?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          candidate_id?: string | null
          company_id?: string | null
          id?: string
          job_id?: string | null
          message?: string | null
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
      ow_tenant_plans: {
        Row: {
          created_at: string | null
          ended_at: string | null
          id: string
          monthly_fee: number | null
          performance_rate: number | null
          plan_type: string
          started_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          monthly_fee?: number | null
          performance_rate?: number | null
          plan_type: string
          started_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          monthly_fee?: number | null
          performance_rate?: number | null
          plan_type?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ow_tenant_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_tenant_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ow_tenant_plans_tenant_id_fkey"
            columns: ["tenant_id"]
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
      ow_users: {
        Row: {
          about_me: string | null
          age_range: string | null
          auth_id: string | null
          avatar_color: string | null
          cover_color: string | null
          created_at: string
          email: string
          id: string
          is_active_mentor: boolean
          is_mentor: boolean
          location: string | null
          mentor_registered_at: string | null
          mentor_themes: string[] | null
          name: string
          social_links: Json | null
          updated_at: string
          visibility: string
        }
        Insert: {
          about_me?: string | null
          age_range?: string | null
          auth_id?: string | null
          avatar_color?: string | null
          cover_color?: string | null
          created_at?: string
          email: string
          id?: string
          is_active_mentor?: boolean
          is_mentor?: boolean
          location?: string | null
          mentor_registered_at?: string | null
          mentor_themes?: string[] | null
          name: string
          social_links?: Json | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          about_me?: string | null
          age_range?: string | null
          auth_id?: string | null
          avatar_color?: string | null
          cover_color?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active_mentor?: boolean
          is_mentor?: boolean
          location?: string | null
          mentor_registered_at?: string | null
          mentor_themes?: string[] | null
          name?: string
          social_links?: Json | null
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      salary_viewers: {
        Row: {
          candidate_id: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          candidate_id?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          candidate_id?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_viewers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_viewers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scout_history: {
        Row: {
          body: string | null
          id: string
          job_id: string | null
          method: string | null
          opened_at: string | null
          replied_at: string | null
          result: string | null
          sent_at: string | null
          subject: string | null
          talent_pool_id: string | null
          tenant_id: string | null
        }
        Insert: {
          body?: string | null
          id?: string
          job_id?: string | null
          method?: string | null
          opened_at?: string | null
          replied_at?: string | null
          result?: string | null
          sent_at?: string | null
          subject?: string | null
          talent_pool_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          body?: string | null
          id?: string
          job_id?: string | null
          method?: string | null
          opened_at?: string | null
          replied_at?: string | null
          result?: string | null
          sent_at?: string | null
          subject?: string | null
          talent_pool_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scout_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scout_history_talent_pool_id_fkey"
            columns: ["talent_pool_id"]
            isOneToOne: false
            referencedRelation: "talent_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scout_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scout_messages: {
        Row: {
          created_at: string | null
          employer_id: string | null
          id: string
          is_read: boolean | null
          job_id: string | null
          message: string
          talent_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          employer_id?: string | null
          id?: string
          is_read?: boolean | null
          job_id?: string | null
          message: string
          talent_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          employer_id?: string | null
          id?: string
          is_read?: boolean | null
          job_id?: string | null
          message?: string
          talent_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scout_messages_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scout_messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "employer_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      selection_feedback: {
        Row: {
          application_id: string | null
          candidate_id: string | null
          created_at: string | null
          id: string
          interviewer_id: string | null
          job_id: string | null
          reapply_after_months: number | null
          reapply_eligible: boolean | null
          rejection_detail: string | null
          rejection_reason: string | null
          result: string
          strong_points: string | null
          tenant_id: string | null
          weak_points: string | null
        }
        Insert: {
          application_id?: string | null
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          interviewer_id?: string | null
          job_id?: string | null
          reapply_after_months?: number | null
          reapply_eligible?: boolean | null
          rejection_detail?: string | null
          rejection_reason?: string | null
          result: string
          strong_points?: string | null
          tenant_id?: string | null
          weak_points?: string | null
        }
        Update: {
          application_id?: string | null
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          interviewer_id?: string | null
          job_id?: string | null
          reapply_after_months?: number | null
          reapply_eligible?: boolean | null
          rejection_detail?: string | null
          rejection_reason?: string | null
          result?: string
          strong_points?: string | null
          tenant_id?: string | null
          weak_points?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "selection_feedback_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selection_feedback_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selection_feedback_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selection_feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_pool: {
        Row: {
          candidate_id: string | null
          created_at: string | null
          id: string
          last_contacted_at: string | null
          next_contact_at: string | null
          notes: string | null
          registered_at: string | null
          source: string | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          last_contacted_at?: string | null
          next_contact_at?: string | null
          notes?: string | null
          registered_at?: string | null
          source?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          last_contacted_at?: string | null
          next_contact_at?: string | null
          notes?: string | null
          registered_at?: string | null
          source?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talent_pool_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_pool_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_profiles: {
        Row: {
          avg_deal_size: string | null
          company: string | null
          conversion_rate: number | null
          created_at: string | null
          current_salary: number | null
          desired_job_type: string | null
          desired_location: string | null
          desired_salary: number | null
          email: string
          experience_years: number | null
          id: string
          intent: string | null
          is_public: boolean | null
          job_type: string | null
          location: string | null
          managed_accounts: number | null
          name: string
          new_arr: string | null
          nps_score: number | null
          phone: string | null
          product_name: string | null
          products: string[] | null
          renewal_rate: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avg_deal_size?: string | null
          company?: string | null
          conversion_rate?: number | null
          created_at?: string | null
          current_salary?: number | null
          desired_job_type?: string | null
          desired_location?: string | null
          desired_salary?: number | null
          email: string
          experience_years?: number | null
          id?: string
          intent?: string | null
          is_public?: boolean | null
          job_type?: string | null
          location?: string | null
          managed_accounts?: number | null
          name: string
          new_arr?: string | null
          nps_score?: number | null
          phone?: string | null
          product_name?: string | null
          products?: string[] | null
          renewal_rate?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avg_deal_size?: string | null
          company?: string | null
          conversion_rate?: number | null
          created_at?: string | null
          current_salary?: number | null
          desired_job_type?: string | null
          desired_location?: string | null
          desired_salary?: number | null
          email?: string
          experience_years?: number | null
          id?: string
          intent?: string | null
          is_public?: boolean | null
          job_type?: string | null
          location?: string | null
          managed_accounts?: number | null
          name?: string
          new_arr?: string | null
          nps_score?: number | null
          phone?: string | null
          product_name?: string | null
          products?: string[] | null
          renewal_rate?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tenant_master_options: {
        Row: {
          category: string
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
          tenant_id: string
          updated_at: string | null
          value: string
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
          tenant_id: string
          updated_at?: string | null
          value: string
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          name: string
          plan: string | null
          slug: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          plan?: string | null
          slug: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          plan?: string | null
          slug?: string
          type?: string | null
        }
        Relationships: []
      }
      work_histories: {
        Row: {
          company_id: string
          created_at: string | null
          department: string | null
          good_points: string | null
          hard_points: string | null
          id: string
          is_public: boolean | null
          joined_year: number
          left_year: number | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          department?: string | null
          good_points?: string | null
          hard_points?: string | null
          id?: string
          is_public?: boolean | null
          joined_year: number
          left_year?: number | null
          role: string
          status: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          department?: string | null
          good_points?: string | null
          hard_points?: string | null
          id?: string
          is_public?: boolean | null
          joined_year?: number
          left_year?: number | null
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_histories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_monthly_stats"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "work_histories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_business_todo_counts"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "work_histories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ow_companies"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Functions: {
      auth_is_admin: { Args: never; Returns: boolean }
      auth_is_company_admin: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      auth_is_company_member: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      get_tenant_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
