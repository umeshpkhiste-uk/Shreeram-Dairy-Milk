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
export type DeliveryStatus = 'completed' | 'partial' | 'missed' | 'skipped';
export type DeliveryEventType = 'created' | 'corrected';
export type BillStatus = 'draft' | 'finalized' | 'partially_paid' | 'paid' | 'voided';
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'other';

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
      deliveries: {
        Row: {
          id: string;
          customer_id: string;
          worker_id: string;
          milk_type_id: string;
          delivery_date: string;
          scheduled_quantity_ml: number;
          delivered_quantity_ml: number;
          status: DeliveryStatus;
          reason: string | null;
          price_paise_snapshot: number;
          device_recorded_at: string;
          server_created_at: string;
          version: number;
          has_conflict: boolean;
          created_by: string | null;
          updated_at: string;
        };
        // Written only by the submit_delivery_event RPC — never inserted/updated directly.
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      delivery_events: {
        Row: {
          id: string;
          delivery_id: string;
          customer_id: string;
          worker_id: string;
          event_type: DeliveryEventType;
          payload: Record<string, unknown>;
          device_recorded_at: string;
          server_received_at: string;
          applied: boolean;
          conflict: boolean;
        };
        Insert: Record<string, never>; // written only by submit_delivery_event
        Update: Record<string, never>;
        Relationships: [];
      };
      delivery_sync_receipts: {
        Row: {
          event_id: string;
          delivery_id: string;
          outcome: string;
          processed_at: string;
        };
        Insert: Record<string, never>; // written only by submit_delivery_event
        Update: Record<string, never>;
        Relationships: [];
      };
      monthly_bills: {
        Row: {
          id: string;
          customer_id: string;
          billing_month: string;
          bill_number: string;
          status: BillStatus;
          previous_outstanding_balance_paise: number;
          subtotal_paise: number;
          adjustments_total_paise: number;
          total_payable_paise: number;
          flagged_for_review: boolean;
          flagged_reason: string | null;
          sent_at: string | null;
          finalized_at: string | null;
          finalized_by: string | null;
          voided_at: string | null;
          void_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        // Written only by the billing RPCs — never inserted/updated directly.
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      bill_items: {
        Row: {
          id: string;
          bill_id: string;
          delivery_id: string;
          delivery_date: string;
          milk_type_id: string;
          quantity_ml: number;
          price_paise: number;
          amount_paise: number;
          voided: boolean;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      bill_adjustments: {
        Row: {
          id: string;
          bill_id: string;
          amount_paise: number;
          reason: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: Record<string, never>; // written only by add_bill_adjustment
        Update: Record<string, never>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          bill_id: string;
          customer_id: string;
          amount_paise: number;
          method: PaymentMethod;
          method_detail: string | null;
          transaction_reference: string | null;
          payment_date: string;
          notes: string | null;
          recorded_by: string | null;
          voided_at: string | null;
          void_reason: string | null;
          created_at: string;
        };
        Insert: Record<string, never>; // written only by record_payment/void_payment
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      submit_delivery_event: {
        Args: {
          p_event_id: string;
          p_delivery_id: string;
          p_customer_id: string;
          p_milk_type_id: string;
          p_delivery_date: string;
          p_event_type: DeliveryEventType;
          p_status: DeliveryStatus;
          p_delivered_quantity_ml: number;
          p_reason: string | null;
          p_expected_version: number | null;
          p_device_recorded_at: string;
        };
        Returns: {
          applied: boolean;
          duplicate: boolean;
          conflict: boolean;
          outcome: string;
          delivery: Database['public']['Tables']['deliveries']['Row'] | null;
        };
      };
      admin_mark_delivery_skipped: {
        Args: { p_customer_id: string; p_delivery_date: string; p_reason: string };
        Returns: Database['public']['Tables']['deliveries']['Row'];
      };
      create_draft_bill: {
        Args: { p_customer_id: string; p_billing_month: string };
        Returns: Database['public']['Tables']['monthly_bills']['Row'];
      };
      recalculate_draft_bill: {
        Args: { p_bill_id: string };
        Returns: Database['public']['Tables']['monthly_bills']['Row'];
      };
      add_bill_adjustment: {
        Args: { p_bill_id: string; p_amount_paise: number; p_reason: string };
        Returns: Database['public']['Tables']['monthly_bills']['Row'];
      };
      finalize_bill: {
        Args: { p_bill_id: string };
        Returns: Database['public']['Tables']['monthly_bills']['Row'];
      };
      void_bill: {
        Args: { p_bill_id: string; p_reason: string };
        Returns: Database['public']['Tables']['monthly_bills']['Row'];
      };
      acknowledge_bill_flag: {
        Args: { p_bill_id: string };
        Returns: Database['public']['Tables']['monthly_bills']['Row'];
      };
      mark_bill_sent: {
        Args: { p_bill_id: string };
        Returns: Database['public']['Tables']['monthly_bills']['Row'];
      };
      record_payment: {
        Args: {
          p_payment_id: string;
          p_bill_id: string;
          p_amount_paise: number;
          p_method: PaymentMethod;
          p_method_detail: string | null;
          p_transaction_reference: string | null;
          p_payment_date: string;
          p_notes: string | null;
        };
        Returns: {
          duplicate: boolean;
          bill: Database['public']['Tables']['monthly_bills']['Row'];
        };
      };
      void_payment: {
        Args: { p_payment_id: string; p_reason: string };
        Returns: Database['public']['Tables']['monthly_bills']['Row'];
      };
    };
    Enums: {
      user_role: UserRole;
      customer_status: CustomerStatus;
      delivery_status: DeliveryStatus;
      delivery_event_type: DeliveryEventType;
      bill_status: BillStatus;
      payment_method: PaymentMethod;
    };
    CompositeTypes: Record<string, never>;
  };
}
