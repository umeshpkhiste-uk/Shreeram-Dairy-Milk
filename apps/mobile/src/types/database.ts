/**
 * Hand-written to match supabase/migrations/20261028082301_stage2_schema.sql.
 * Keep in sync with the migrations. Once the Supabase CLI/MCP is reliably
 * reachable in this environment, this can be replaced by
 * `supabase gen types typescript --linked`.
 *
 * `Relationships: []` on every table is required by @supabase/postgrest-js's
 * `GenericTable` constraint even though we don't use embedded-resource
 * selects (see src/lib/api/workers.ts for why) — omitting it silently
 * collapses every Insert/Update/Row generic to `never`.
 */

export type UserRole = 'admin' | 'worker';
export type CustomerStatus = 'active' | 'inactive';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string;
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, never>; // rows are created only by the handle_new_user trigger
        Update: Partial<{
          full_name: string;
          phone: string | null;
          role: UserRole;
          is_active: boolean;
        }>;
        Relationships: [];
      };
      routes: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
        };
        Update: Partial<{
          name: string;
          description: string | null;
          is_active: boolean;
        }>;
        Relationships: [];
      };
      workers: {
        Row: {
          id: string;
          route_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          route_id?: string | null;
          notes?: string | null;
        };
        Update: Partial<{
          route_id: string | null;
          notes: string | null;
        }>;
        Relationships: [];
      };
      milk_types: {
        Row: {
          id: string;
          name: string;
          default_price_paise: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          default_price_paise: number;
          is_active?: boolean;
        };
        Update: Partial<{
          name: string;
          default_price_paise: number;
          is_active: boolean;
        }>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          full_name: string;
          mobile_number: string;
          email: string | null;
          address: string;
          locality: string | null;
          landmark: string | null;
          assigned_worker_id: string | null;
          route_id: string | null;
          route_sequence: number | null;
          status: CustomerStatus;
          default_daily_quantity_ml: number;
          milk_type_id: string;
          preferred_delivery_window: string | null;
          delivery_start_date: string;
          notes: string | null;
          billing_contact_name: string | null;
          billing_contact_phone: string | null;
          account_reference: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          full_name: string;
          mobile_number: string;
          email?: string | null;
          address: string;
          locality?: string | null;
          landmark?: string | null;
          assigned_worker_id?: string | null;
          route_id?: string | null;
          route_sequence?: number | null;
          status?: CustomerStatus;
          default_daily_quantity_ml: number;
          milk_type_id: string;
          preferred_delivery_window?: string | null;
          delivery_start_date?: string;
          notes?: string | null;
          billing_contact_name?: string | null;
          billing_contact_phone?: string | null;
          account_reference?: string | null;
        };
        Update: Partial<{
          full_name: string;
          mobile_number: string;
          email: string | null;
          address: string;
          locality: string | null;
          landmark: string | null;
          assigned_worker_id: string | null;
          route_id: string | null;
          route_sequence: number | null;
          status: CustomerStatus;
          default_daily_quantity_ml: number;
          milk_type_id: string;
          preferred_delivery_window: string | null;
          delivery_start_date: string;
          notes: string | null;
          billing_contact_name: string | null;
          billing_contact_phone: string | null;
          account_reference: string | null;
        }>;
        Relationships: [];
      };
      customer_milk_rates: {
        Row: {
          id: string;
          customer_id: string;
          milk_type_id: string;
          price_paise: number;
          effective_from: string;
          effective_to: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          customer_id: string;
          milk_type_id: string;
          price_paise: number;
          effective_from: string;
          effective_to?: string | null;
        };
        Update: Partial<{
          effective_to: string | null;
        }>;
        Relationships: [];
      };
      business_settings: {
        Row: {
          id: true;
          business_name: string;
          contact_phone: string | null;
          contact_email: string | null;
          address: string | null;
          currency_code: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: Partial<{
          business_name: string;
          contact_phone: string | null;
          contact_email: string | null;
          address: string | null;
          currency_code: string;
          timezone: string;
        }>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          before_data: Record<string, unknown> | null;
          after_data: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Record<string, never>; // written only by audit triggers
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      customer_status: CustomerStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
