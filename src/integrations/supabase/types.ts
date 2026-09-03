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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          batch_id: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_marks: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          mark_source: Database["public"]["Enums"]["mark_source"]
          marked_by: string
          reason: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          mark_source?: Database["public"]["Enums"]["mark_source"]
          marked_by: string
          reason?: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          mark_source?: Database["public"]["Enums"]["mark_source"]
          marked_by?: string
          reason?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_marks_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_day_marks: {
        Row: {
          batch_id: string
          color: string
          created_at: string
          created_by: string | null
          day: string
          id: string
          is_off: boolean
          label: string | null
          note: string | null
          updated_at: string
        }
        Insert: {
          batch_id: string
          color?: string
          created_at?: string
          created_by?: string | null
          day: string
          id?: string
          is_off?: boolean
          label?: string | null
          note?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string
          color?: string
          created_at?: string
          created_by?: string | null
          day?: string
          id?: string
          is_off?: boolean
          label?: string | null
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_day_marks_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_feed_tokens: {
        Row: {
          batch_id: string
          created_at: string
          token: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          token?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_feed_tokens_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: true
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_memberships: {
        Row: {
          batch_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          note: string | null
          role: Database["public"]["Enums"]["app_role"]
          section_id: string | null
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          section_id?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          section_id?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_memberships_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_memberships_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_memberships_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_registro_credentials: {
        Row: {
          batch_id: string
          password: string
          term_id: string | null
          updated_at: string
          updated_by: string | null
          username: string
        }
        Insert: {
          batch_id: string
          password: string
          term_id?: string | null
          updated_at?: string
          updated_by?: string | null
          username: string
        }
        Update: {
          batch_id?: string
          password?: string
          term_id?: string | null
          updated_at?: string
          updated_by?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_registro_credentials_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: true
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_sync_state: {
        Row: {
          batch_id: string
          consecutive_failures: number
          last_count: number | null
          last_error: string | null
          last_run_at: string | null
          last_success_at: string | null
          lease_until: string | null
          paused: boolean
          updated_at: string
        }
        Insert: {
          batch_id: string
          consecutive_failures?: number
          last_count?: number | null
          last_error?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          lease_until?: string | null
          paused?: boolean
          updated_at?: string
        }
        Update: {
          batch_id?: string
          consecutive_failures?: number
          last_count?: number | null
          last_error?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          lease_until?: string | null
          paused?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_sync_state_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: true
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          attendance_threshold: number
          created_at: string
          end_year: number | null
          ics_url: string | null
          id: string
          is_public: boolean
          name: string
          programme_id: string
          registro_term_id: string | null
          slug: string
          start_year: number | null
          updated_at: string
        }
        Insert: {
          attendance_threshold?: number
          created_at?: string
          end_year?: number | null
          ics_url?: string | null
          id?: string
          is_public?: boolean
          name: string
          programme_id: string
          registro_term_id?: string | null
          slug: string
          start_year?: number | null
          updated_at?: string
        }
        Update: {
          attendance_threshold?: number
          created_at?: string
          end_year?: number | null
          ics_url?: string | null
          id?: string
          is_public?: boolean
          name?: string
          programme_id?: string
          registro_term_id?: string | null
          slug?: string
          start_year?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          batch_id: string
          classroom: string | null
          course_code: string | null
          course_name: string | null
          created_at: string
          created_by: string | null
          end_at: string
          external_uid: string | null
          faculty_name: string | null
          id: string
          is_holiday: boolean
          notes: string | null
          section: string | null
          session_number: number | null
          short_name: string | null
          source: Database["public"]["Enums"]["session_source"]
          start_at: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          batch_id: string
          classroom?: string | null
          course_code?: string | null
          course_name?: string | null
          created_at?: string
          created_by?: string | null
          end_at: string
          external_uid?: string | null
          faculty_name?: string | null
          id?: string
          is_holiday?: boolean
          notes?: string | null
          section?: string | null
          session_number?: number | null
          short_name?: string | null
          source?: Database["public"]["Enums"]["session_source"]
          start_at: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          batch_id?: string
          classroom?: string | null
          course_code?: string | null
          course_name?: string | null
          created_at?: string
          created_by?: string | null
          end_at?: string
          external_uid?: string | null
          faculty_name?: string | null
          id?: string
          is_holiday?: boolean
          notes?: string | null
          section?: string | null
          session_number?: number | null
          short_name?: string | null
          source?: Database["public"]["Enums"]["session_source"]
          start_at?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          batch_id: string
          code: string
          color: string | null
          created_at: string
          faculty_name: string | null
          id: string
          name: string
          short_name: string
        }
        Insert: {
          batch_id: string
          code: string
          color?: string | null
          created_at?: string
          faculty_name?: string | null
          id?: string
          name: string
          short_name: string
        }
        Update: {
          batch_id?: string
          code?: string
          color?: string | null
          created_at?: string
          faculty_name?: string | null
          id?: string
          name?: string
          short_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      deadlines: {
        Row: {
          all_day: boolean
          batch_id: string
          created_at: string
          created_by: string | null
          due_at: string
          end_at: string | null
          group_size: number | null
          id: string
          is_major: boolean
          location: string | null
          notes: string | null
          source: string
          status: string
          subject: string
          subject_code: string | null
          submission_link: string | null
          title: string
          type: Database["public"]["Enums"]["deadline_type"]
          updated_at: string
          work_mode: Database["public"]["Enums"]["work_mode"]
          working_group: string | null
        }
        Insert: {
          all_day?: boolean
          batch_id: string
          created_at?: string
          created_by?: string | null
          due_at: string
          end_at?: string | null
          group_size?: number | null
          id?: string
          is_major?: boolean
          location?: string | null
          notes?: string | null
          source?: string
          status?: string
          subject: string
          subject_code?: string | null
          submission_link?: string | null
          title: string
          type?: Database["public"]["Enums"]["deadline_type"]
          updated_at?: string
          work_mode?: Database["public"]["Enums"]["work_mode"]
          working_group?: string | null
        }
        Update: {
          all_day?: boolean
          batch_id?: string
          created_at?: string
          created_by?: string | null
          due_at?: string
          end_at?: string | null
          group_size?: number | null
          id?: string
          is_major?: boolean
          location?: string | null
          notes?: string | null
          source?: string
          status?: string
          subject?: string
          subject_code?: string | null
          submission_link?: string | null
          title?: string
          type?: Database["public"]["Enums"]["deadline_type"]
          updated_at?: string
          work_mode?: Database["public"]["Enums"]["work_mode"]
          working_group?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deadlines_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      email_ingest: {
        Row: {
          batch_id: string
          body: string | null
          confidence: number | null
          created_at: string
          deadline_id: string | null
          error: string | null
          extracted: Json | null
          id: string
          message_key: string | null
          received_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          sender: string | null
          status: Database["public"]["Enums"]["review_status"]
          subject: string | null
        }
        Insert: {
          batch_id: string
          body?: string | null
          confidence?: number | null
          created_at?: string
          deadline_id?: string | null
          error?: string | null
          extracted?: Json | null
          id?: string
          message_key?: string | null
          received_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          subject?: string | null
        }
        Update: {
          batch_id?: string
          body?: string | null
          confidence?: number | null
          created_at?: string
          deadline_id?: string | null
          error?: string | null
          extracted?: Json | null
          id?: string
          message_key?: string | null
          received_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_ingest_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_ingest_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "deadlines"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_marks: {
        Row: {
          batch_id: string
          created_at: string
          deadline_id: string
          id: string
          score: number
          total: number
          updated_at: string
          user_id: string
          weightage: number
        }
        Insert: {
          batch_id: string
          created_at?: string
          deadline_id: string
          id?: string
          score?: number
          total?: number
          updated_at?: string
          user_id: string
          weightage?: number
        }
        Update: {
          batch_id?: string
          created_at?: string
          deadline_id?: string
          id?: string
          score?: number
          total?: number
          updated_at?: string
          user_id?: string
          weightage?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_marks_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_marks_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "deadlines"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          admin_note: string | null
          batch_id: string | null
          created_at: string
          id: string
          kind: string
          message: string
          page: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          batch_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message: string
          page?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          batch_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          page?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          github_url: string | null
          id: string
          linkedin_url: string | null
          notify_email: boolean
          phone: string | null
          pronouns: string | null
          registration_no: string | null
          reminder_hours: number
          section: string | null
          timezone: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          github_url?: string | null
          id: string
          linkedin_url?: string | null
          notify_email?: boolean
          phone?: string | null
          pronouns?: string | null
          registration_no?: string | null
          reminder_hours?: number
          section?: string | null
          timezone?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          github_url?: string | null
          id?: string
          linkedin_url?: string | null
          notify_email?: boolean
          phone?: string | null
          pronouns?: string | null
          registration_no?: string | null
          reminder_hours?: number
          section?: string | null
          timezone?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      programmes: {
        Row: {
          created_at: string
          id: string
          name: string
          school_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          school_id: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "programmes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "schools_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "student" | "mod" | "admin"
      attendance_status: "present" | "absent" | "late" | "excused"
      deadline_type:
        | "quiz"
        | "assignment"
        | "presentation"
        | "midterm"
        | "endterm"
        | "guest_lecture"
        | "other"
      leave_type: "personal" | "institutional"
      mark_source: "self" | "rep"
      membership_status: "pending" | "approved" | "rejected" | "removed"
      review_status: "pending" | "approved" | "rejected"
      session_source: "registro" | "ics" | "custom"
      work_mode: "individual" | "group"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["student", "mod", "admin"],
      attendance_status: ["present", "absent", "late", "excused"],
      deadline_type: [
        "quiz",
        "assignment",
        "presentation",
        "midterm",
        "endterm",
        "guest_lecture",
        "other",
      ],
      leave_type: ["personal", "institutional"],
      mark_source: ["self", "rep"],
      membership_status: ["pending", "approved", "rejected", "removed"],
      review_status: ["pending", "approved", "rejected"],
      session_source: ["registro", "ics", "custom"],
      work_mode: ["individual", "group"],
    },
  },
} as const
