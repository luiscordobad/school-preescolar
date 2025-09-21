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
      attendance: {
        Row: {
          classroom_id: string;
          created_at: string;
          date: string;
          id: string;
          note: string | null;
          school_id: string;
          status: "P" | "A" | "R";
          student_id: string;
          taken_by: string;
          updated_at: string;
        };
        Insert: {
          classroom_id: string;
          created_at?: string;
          date: string;
          id?: string;
          note?: string | null;
          school_id: string;
          status: "P" | "A" | "R";
          student_id: string;
          taken_by: string;
          updated_at?: string;
        };
        Update: {
          classroom_id?: string;
          created_at?: string;
          date?: string;
          id?: string;
          note?: string | null;
          school_id?: string;
          status?: "P" | "A" | "R";
          student_id?: string;
          taken_by?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_classroom_id_fkey";
            columns: ["classroom_id"];
            referencedRelation: "classroom";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "school";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "student";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_taken_by_fkey";
            columns: ["taken_by"];
            referencedRelation: "user_profile";
            referencedColumns: ["id"];
          }
        ];
      };
      classroom: {
        Row: {
          created_at: string | null;
          id: string;
          name: string;
          school_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
          school_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classroom_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "school";
            referencedColumns: ["id"];
          }
        ];
      };
      enrollment: {
        Row: {
          classroom_id: string;
          created_at: string | null;
          id: string;
          school_id: string;
          student_id: string;
        };
        Insert: {
          classroom_id: string;
          created_at?: string | null;
          id?: string;
          school_id: string;
          student_id: string;
        };
        Update: {
          classroom_id?: string;
          created_at?: string | null;
          id?: string;
          school_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enrollment_classroom_id_fkey";
            columns: ["classroom_id"];
            referencedRelation: "classroom";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollment_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "student";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollment_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "school";
            referencedColumns: ["id"];
          }
        ];
      };
      guardian: {
        Row: {
          created_at: string | null;
          id: string;
          relationship: string | null;
          student_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          relationship?: string | null;
          student_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          relationship?: string | null;
          student_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guardian_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "student";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guardian_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "user_profile";
            referencedColumns: ["id"];
          }
        ];
      };
      message: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          sender_id: string;
          thread_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          sender_id: string;
          thread_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          sender_id?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_sender_id_fkey";
            columns: ["sender_id"];
            referencedRelation: "user_profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_thread_id_fkey";
            columns: ["thread_id"];
            referencedRelation: "message_thread";
            referencedColumns: ["id"];
          }
        ];
      };
      message_thread: {
        Row: {
          classroom_id: string | null;
          created_at: string;
          created_by: string;
          id: string;
          school_id: string;
          title: string;
        };
        Insert: {
          classroom_id?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          school_id: string;
          title: string;
        };
        Update: {
          classroom_id?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          school_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_thread_classroom_id_fkey";
            columns: ["classroom_id"];
            referencedRelation: "classroom";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_thread_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "user_profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_thread_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "school";
            referencedColumns: ["id"];
          }
        ];
      };
      school: {
        Row: {
          created_at: string | null;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      student: {
        Row: {
          created_at: string | null;
          date_of_birth: string | null;
          first_name: string;
          id: string;
          last_name: string;
          school_id: string;
        };
        Insert: {
          created_at?: string | null;
          date_of_birth?: string | null;
          first_name: string;
          id?: string;
          last_name: string;
          school_id: string;
        };
        Update: {
          created_at?: string | null;
          date_of_birth?: string | null;
          first_name?: string;
          id?: string;
          last_name?: string;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "school";
            referencedColumns: ["id"];
          }
        ];
      };
      teacher_classroom: {
        Row: {
          classroom_id: string;
          created_at: string | null;
          id: string;
          teacher_id: string;
        };
        Insert: {
          classroom_id: string;
          created_at?: string | null;
          id?: string;
          teacher_id: string;
        };
        Update: {
          classroom_id?: string;
          created_at?: string | null;
          id?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_classroom_classroom_id_fkey";
            columns: ["classroom_id"];
            referencedRelation: "classroom";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_classroom_teacher_id_fkey";
            columns: ["teacher_id"];
            referencedRelation: "user_profile";
            referencedColumns: ["id"];
          }
        ];
      };
      user_profile: {
        Row: {
          created_at: string | null;
          display_name: string | null;
          id: string;
          role: "director" | "teacher" | "parent" | "maestra";
          school_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          display_name?: string | null;
          id: string;
          role?: "director" | "teacher" | "parent" | "maestra";
          school_id?: string | null;
        };
          Update: {
            created_at?: string | null;
            display_name?: string | null;
            id?: string;
            role?: "director" | "teacher" | "parent" | "maestra";
            school_id?: string | null;
          };
        Relationships: [
          {
            foreignKeyName: "user_profile_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "school";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profile_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      v_attendance_day_classroom: {
        Row: {
          classroom_id: string;
          date: string;
          present_count: number;
          absent_count: number;
          tardy_count: number;
        };
        Relationships: [];
      };
      v_attendance_month_student: {
        Row: {
          student_id: string;
          month: string;
          present_count: number;
          absent_count: number;
          tardy_count: number;
          total_days: number;
          attendance_percentage: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
