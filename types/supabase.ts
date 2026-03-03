export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      agency_settings: {
        Row: {
          id: string;
          monthly_overheads: number;
          utilization_pct: number;
          target_margin_pct: number;
          currency: string;
          role_costs_json: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          monthly_overheads: number;
          utilization_pct: number;
          target_margin_pct: number;
          currency: string;
          role_costs_json?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['agency_settings']['Insert']>;
      };
      offerings: {
        Row: {
          id: string;
          name: string;
          unit_type: 'fixed' | 'retainer';
          baseline_hours: number;
          roles_mix_json: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          unit_type: Database['public']['Tables']['offerings']['Row']['unit_type'];
          baseline_hours: number;
          roles_mix_json?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['offerings']['Insert']>;
      };
      deals: {
        Row: {
          id: string;
          close_date: string;
          amount: number | null;
          currency: string;
          outcome: 'won' | 'lost';
          description: string;
          client_domain: string;
          offering_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          close_date: string;
          amount?: number | null;
          currency: string;
          outcome: Database['public']['Tables']['deals']['Row']['outcome'];
          description: string;
          client_domain: string;
          offering_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['deals']['Insert']>;
      };
      client_profiles: {
        Row: {
          id: string;
          domain: string;
          company_name: string | null;
          status: 'pending' | 'ready';
          clay_signals: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          domain: string;
          company_name?: string | null;
          status?: Database['public']['Tables']['client_profiles']['Row']['status'];
          clay_signals?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['client_profiles']['Insert']>;
      };
      model_runs: {
        Row: {
          id: string;
          offering_id: string;
          client_domain: string;
          inputs: Json;
          outputs: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          offering_id: string;
          client_domain: string;
          inputs?: Json;
          outputs?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['model_runs']['Insert']>;
      };
      documents: {
        Row: {
          id: string;
          client_domain: string;
          offering_id: string;
          package_name: string;
          type: 'proposal' | 'sow';
          markdown: string;
          pdf_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_domain: string;
          offering_id: string;
          package_name: string;
          type: Database['public']['Tables']['documents']['Row']['type'];
          markdown: string;
          pdf_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['documents']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type TableRow<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TableInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TableUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
