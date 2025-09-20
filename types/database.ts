export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      attendance: {
        Row: {
          classroom_id: string;
          created_at: string | null;
          date: string;
          id: string;
          note: string | null;
          school_id: string;
          status: "P" | "A" | "R";
          student_id: string;
          taken_by: string;
          updated_at: string | null;
        };
        Insert: {
          classroom_id: string;
          created_at?: string | null;
          date: string;
          id?: string;
          note?: string | null;
          school_id: string;
          status: "P" | "A" | "R";
          student_id: string;
          taken_by: string;
          updated_at?: string | null;
        };
        Update: {
          classroom_id?: string;
          created_at?: string | null;
          date?: string;
          id?: string;
          note?: string | null;
          school_id?: string;
          status?: "P" | "A" | "R";
          student_id?: string;
          taken_by?: string;
          updated_at?: string | null;
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
          profile_id: string;
          relationship: string | null;
          student_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          profile_id: string;
          relationship?: string | null;
          student_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          profile_id?: string;
          relationship?: string | null;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guardian_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "user_profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guardian_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "student";
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
          role: "director" | "teacher" | "parent";
          school_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          display_name?: string | null;
          id: string;
          role?: "director" | "teacher" | "parent";
          school_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          display_name?: string | null;
          id?: string;
          role?: "director" | "teacher" | "parent";
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
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}
