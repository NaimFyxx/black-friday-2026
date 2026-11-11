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
      activations: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_users: {
        Row: {
          active: boolean
          created_at: string
          email: string
          is_owner: boolean
          modules: string[]
          name: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          is_owner?: boolean
          modules?: string[]
          name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          is_owner?: boolean
          modules?: string[]
          name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      b2b_delivery_alerts: {
        Row: {
          checked_at: string | null
          closed_at: string | null
          customer: string | null
          emails: number
          first_seen: string
          invoice: string | null
          last_emailed_at: string | null
          odoo_created_at: string | null
          picking: string | null
          picking_id: number
          reserved: number | null
          salesperson: string | null
          so: string | null
          units: number | null
        }
        Insert: {
          checked_at?: string | null
          closed_at?: string | null
          customer?: string | null
          emails?: number
          first_seen?: string
          invoice?: string | null
          last_emailed_at?: string | null
          odoo_created_at?: string | null
          picking?: string | null
          picking_id: number
          reserved?: number | null
          salesperson?: string | null
          so?: string | null
          units?: number | null
        }
        Update: {
          checked_at?: string | null
          closed_at?: string | null
          customer?: string | null
          emails?: number
          first_seen?: string
          invoice?: string | null
          last_emailed_at?: string | null
          odoo_created_at?: string | null
          picking?: string | null
          picking_id?: number
          reserved?: number | null
          salesperson?: string | null
          so?: string | null
          units?: number | null
        }
        Relationships: []
      }
      bak_inv_resolution_summary_20261111: {
        Row: {
          id: string | null
          issue_ref: string | null
          resolution_summary: string | null
        }
        Insert: {
          id?: string | null
          issue_ref?: string | null
          resolution_summary?: string | null
        }
        Update: {
          id?: string | null
          issue_ref?: string | null
          resolution_summary?: string | null
        }
        Relationships: []
      }
      btg_pin_fails: {
        Row: {
          at: string
          id: number
          ip: string | null
        }
        Insert: {
          at?: string
          id?: number
          ip?: string | null
        }
        Update: {
          at?: string
          id?: number
          ip?: string | null
        }
        Relationships: []
      }
      btg_requests: {
        Row: {
          bom_id: number | null
          bottle_cost: number
          bottle_ml: number
          bottle_name: string
          bottle_product_id: number
          bottle_sku: string | null
          cost_per_pour: number
          created_at: string
          error: string | null
          finished_at: string | null
          flag: string | null
          id: number
          margin: number
          odoo_changes: Json | null
          odoo_product_id: number | null
          odoo_template_id: number | null
          option_name: string | null
          pour_ml: number
          price: number
          price_before_confirm: number | null
          price_confirmed_at: string | null
          price_confirmed_by: string | null
          price_note: string | null
          reported_at: string | null
          reported_by: string | null
          shopify_product_id: string | null
          shopify_variant_id: string | null
          sku: string | null
          staff_name: string
          started_at: string | null
          status: string
        }
        Insert: {
          bom_id?: number | null
          bottle_cost: number
          bottle_ml: number
          bottle_name: string
          bottle_product_id: number
          bottle_sku?: string | null
          cost_per_pour: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          flag?: string | null
          id?: number
          margin: number
          odoo_changes?: Json | null
          odoo_product_id?: number | null
          odoo_template_id?: number | null
          option_name?: string | null
          pour_ml: number
          price: number
          price_before_confirm?: number | null
          price_confirmed_at?: string | null
          price_confirmed_by?: string | null
          price_note?: string | null
          reported_at?: string | null
          reported_by?: string | null
          shopify_product_id?: string | null
          shopify_variant_id?: string | null
          sku?: string | null
          staff_name: string
          started_at?: string | null
          status?: string
        }
        Update: {
          bom_id?: number | null
          bottle_cost?: number
          bottle_ml?: number
          bottle_name?: string
          bottle_product_id?: number
          bottle_sku?: string | null
          cost_per_pour?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          flag?: string | null
          id?: number
          margin?: number
          odoo_changes?: Json | null
          odoo_product_id?: number | null
          odoo_template_id?: number | null
          option_name?: string | null
          pour_ml?: number
          price?: number
          price_before_confirm?: number | null
          price_confirmed_at?: string | null
          price_confirmed_by?: string | null
          price_note?: string | null
          reported_at?: string | null
          reported_by?: string | null
          shopify_product_id?: string | null
          shopify_variant_id?: string | null
          sku?: string | null
          staff_name?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      cancelled_orders: {
        Row: {
          cancelled_at: string
          created_at: string
          order_id: string
        }
        Insert: {
          cancelled_at: string
          created_at?: string
          order_id: string
        }
        Update: {
          cancelled_at?: string
          created_at?: string
          order_id?: string
        }
        Relationships: []
      }
      cust_odoo: {
        Row: {
          active: boolean | null
          create_date: string | null
          customer_rank: number | null
          email: string | null
          id: number
          is_company: boolean | null
          loaded_at: string | null
          loyalty_cards: number | null
          mobile: string | null
          name: string | null
          parent_id: number | null
          phone: string | null
          ref: string | null
          shopify_id: string | null
        }
        Insert: {
          active?: boolean | null
          create_date?: string | null
          customer_rank?: number | null
          email?: string | null
          id: number
          is_company?: boolean | null
          loaded_at?: string | null
          loyalty_cards?: number | null
          mobile?: string | null
          name?: string | null
          parent_id?: number | null
          phone?: string | null
          ref?: string | null
          shopify_id?: string | null
        }
        Update: {
          active?: boolean | null
          create_date?: string | null
          customer_rank?: number | null
          email?: string | null
          id?: number
          is_company?: boolean | null
          loaded_at?: string | null
          loyalty_cards?: number | null
          mobile?: string | null
          name?: string | null
          parent_id?: number | null
          phone?: string | null
          ref?: string | null
          shopify_id?: string | null
        }
        Relationships: []
      }
      cust_shopify: {
        Row: {
          addr_phone: string | null
          created_at: string | null
          email: string | null
          email_marketing: string | null
          first_name: string | null
          id: string
          last_name: string | null
          loaded_at: string | null
          note: string | null
          orders: number | null
          phone: string | null
          sms_marketing: string | null
          spent: number | null
          state: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          addr_phone?: string | null
          created_at?: string | null
          email?: string | null
          email_marketing?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          loaded_at?: string | null
          note?: string | null
          orders?: number | null
          phone?: string | null
          sms_marketing?: string | null
          spent?: number | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          addr_phone?: string | null
          created_at?: string | null
          email?: string | null
          email_marketing?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          loaded_at?: string | null
          note?: string | null
          orders?: number | null
          phone?: string | null
          sms_marketing?: string | null
          spent?: number | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_identity: {
        Row: {
          created_at: string
          first_confirmed_at: string
          id: string
          klaviyo_order_matches: number
          klaviyo_profile_id: string | null
          last_confirmed_at: string
          loyaltylion_id: string | null
          matched_how: string
          shopify_customer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_confirmed_at?: string
          id?: string
          klaviyo_order_matches?: number
          klaviyo_profile_id?: string | null
          last_confirmed_at?: string
          loyaltylion_id?: string | null
          matched_how: string
          shopify_customer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_confirmed_at?: string
          id?: string
          klaviyo_order_matches?: number
          klaviyo_profile_id?: string | null
          last_confirmed_at?: string
          loyaltylion_id?: string | null
          matched_how?: string
          shopify_customer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_viewers: {
        Row: {
          created_at: string
          email: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          name?: string
        }
        Relationships: []
      }
      delivery_issues: {
        Row: {
          checked_at: string | null
          detail: string | null
          id: number
          kind: string | null
          odoo_order: string | null
          odoo_picking: string | null
          odoo_url: string | null
          order_created: string | null
          order_name: string | null
          shopify_status: string | null
          shopify_url: string | null
        }
        Insert: {
          checked_at?: string | null
          detail?: string | null
          id?: number
          kind?: string | null
          odoo_order?: string | null
          odoo_picking?: string | null
          odoo_url?: string | null
          order_created?: string | null
          order_name?: string | null
          shopify_status?: string | null
          shopify_url?: string | null
        }
        Update: {
          checked_at?: string | null
          detail?: string | null
          id?: number
          kind?: string | null
          odoo_order?: string | null
          odoo_picking?: string | null
          odoo_url?: string | null
          order_created?: string | null
          order_name?: string | null
          shopify_status?: string | null
          shopify_url?: string | null
        }
        Relationships: []
      }
      delivery_issues_removed_pos: {
        Row: {
          checked_at: string | null
          detail: string | null
          id: number | null
          kind: string | null
          odoo_order: string | null
          odoo_picking: string | null
          odoo_url: string | null
          order_created: string | null
          order_name: string | null
          shopify_status: string | null
          shopify_url: string | null
        }
        Insert: {
          checked_at?: string | null
          detail?: string | null
          id?: number | null
          kind?: string | null
          odoo_order?: string | null
          odoo_picking?: string | null
          odoo_url?: string | null
          order_created?: string | null
          order_name?: string | null
          shopify_status?: string | null
          shopify_url?: string | null
        }
        Update: {
          checked_at?: string | null
          detail?: string | null
          id?: number | null
          kind?: string | null
          odoo_order?: string | null
          odoo_picking?: string | null
          odoo_url?: string | null
          order_created?: string | null
          order_name?: string | null
          shopify_status?: string | null
          shopify_url?: string | null
        }
        Relationships: []
      }
      delivery_issues_snapshot_20261110: {
        Row: {
          checked_at: string | null
          detail: string | null
          id: number | null
          kind: string | null
          odoo_order: string | null
          odoo_picking: string | null
          odoo_url: string | null
          order_created: string | null
          order_name: string | null
          shopify_status: string | null
          shopify_url: string | null
        }
        Insert: {
          checked_at?: string | null
          detail?: string | null
          id?: number | null
          kind?: string | null
          odoo_order?: string | null
          odoo_picking?: string | null
          odoo_url?: string | null
          order_created?: string | null
          order_name?: string | null
          shopify_status?: string | null
          shopify_url?: string | null
        }
        Update: {
          checked_at?: string | null
          detail?: string | null
          id?: number | null
          kind?: string | null
          odoo_order?: string | null
          odoo_picking?: string | null
          odoo_url?: string | null
          order_created?: string | null
          order_name?: string | null
          shopify_status?: string | null
          shopify_url?: string | null
        }
        Relationships: []
      }
      delivery_open: {
        Row: {
          checked_at: string | null
          customer: string | null
          kind: string | null
          odoo_order: string | null
          odoo_url: string | null
          picking: string
          shopify_order: string | null
          shopify_status: string | null
          shopify_url: string | null
          since: string | null
          state: string | null
        }
        Insert: {
          checked_at?: string | null
          customer?: string | null
          kind?: string | null
          odoo_order?: string | null
          odoo_url?: string | null
          picking: string
          shopify_order?: string | null
          shopify_status?: string | null
          shopify_url?: string | null
          since?: string | null
          state?: string | null
        }
        Update: {
          checked_at?: string | null
          customer?: string | null
          kind?: string | null
          odoo_order?: string | null
          odoo_url?: string | null
          picking?: string
          shopify_order?: string | null
          shopify_status?: string | null
          shopify_url?: string | null
          since?: string | null
          state?: string | null
        }
        Relationships: []
      }
      identity_conflicts: {
        Row: {
          detected_at: string
          first_detected_at: string
          id: string
          klaviyo_profile_id: string
          order_count: number
          shopify_customer_ids: string[]
        }
        Insert: {
          detected_at?: string
          first_detected_at?: string
          id?: string
          klaviyo_profile_id: string
          order_count?: number
          shopify_customer_ids: string[]
        }
        Update: {
          detected_at?: string
          first_detected_at?: string
          id?: string
          klaviyo_profile_id?: string
          order_count?: number
          shopify_customer_ids?: string[]
        }
        Relationships: []
      }
      identity_snapshots: {
        Row: {
          conflicts: number
          created_at: string
          klaviyo_profiles_seen: number
          klaviyo_unlinked: number
          linked_klaviyo: number
          linked_loyaltylion: number
          measured_on: string
          shopify_customers: number
        }
        Insert: {
          conflicts?: number
          created_at?: string
          klaviyo_profiles_seen?: number
          klaviyo_unlinked?: number
          linked_klaviyo?: number
          linked_loyaltylion?: number
          measured_on: string
          shopify_customers?: number
        }
        Update: {
          conflicts?: number
          created_at?: string
          klaviyo_profiles_seen?: number
          klaviyo_unlinked?: number
          linked_klaviyo?: number
          linked_loyaltylion?: number
          measured_on?: string
          shopify_customers?: number
        }
        Relationships: []
      }
      inv_admins: {
        Row: {
          created_at: string
          email: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          name?: string
        }
        Relationships: []
      }
      inv_connector_changes: {
        Row: {
          created_at: string
          day: string
          id: string
          kind: string
          odoo_change: number | null
          odoo_now: number | null
          ours: number | null
          product: string | null
          shopify_change: number | null
          shopify_now: number | null
          shopify_sold: number | null
          sku: string
          verdict: string
          who: string | null
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          kind: string
          odoo_change?: number | null
          odoo_now?: number | null
          ours?: number | null
          product?: string | null
          shopify_change?: number | null
          shopify_now?: number | null
          shopify_sold?: number | null
          sku: string
          verdict: string
          who?: string | null
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          kind?: string
          odoo_change?: number | null
          odoo_now?: number | null
          ours?: number | null
          product?: string | null
          shopify_change?: number | null
          shopify_now?: number | null
          shopify_sold?: number | null
          sku?: string
          verdict?: string
          who?: string | null
        }
        Relationships: []
      }
      inv_employees: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      inv_fix_log: {
        Row: {
          at: string | null
          detail: Json | null
          error: string | null
          id: number
          issue_ref: string | null
          ok: boolean | null
          ref: string | null
          step: string | null
          target: string | null
        }
        Insert: {
          at?: string | null
          detail?: Json | null
          error?: string | null
          id?: number
          issue_ref?: string | null
          ok?: boolean | null
          ref?: string | null
          step?: string | null
          target?: string | null
        }
        Update: {
          at?: string | null
          detail?: Json | null
          error?: string | null
          id?: number
          issue_ref?: string | null
          ok?: boolean | null
          ref?: string | null
          step?: string | null
          target?: string | null
        }
        Relationships: []
      }
      inv_health_snapshots: {
        Row: {
          active_skus: number | null
          below_zero_skus: number | null
          out_of_step_pct: number | null
          out_of_step_skus: number | null
          saved_at: string | null
          taken_at: string | null
          week_start: string
        }
        Insert: {
          active_skus?: number | null
          below_zero_skus?: number | null
          out_of_step_pct?: number | null
          out_of_step_skus?: number | null
          saved_at?: string | null
          taken_at?: string | null
          week_start: string
        }
        Update: {
          active_skus?: number | null
          below_zero_skus?: number | null
          out_of_step_pct?: number | null
          out_of_step_skus?: number | null
          saved_at?: string | null
          taken_at?: string | null
          week_start?: string
        }
        Relationships: []
      }
      inv_health_weekly: {
        Row: {
          below_zero_skus: number | null
          biggest_drag: string | null
          era: string
          hand_adj_lines: number | null
          hand_adj_source: string | null
          hand_adj_units: number | null
          hand_adj_value_jod: number | null
          late_deliveries: number | null
          late_transfers: number | null
          net_taken_off_value_jod: number | null
          out_of_step_pct: number | null
          out_of_step_skus: number | null
          out_of_step_source: string | null
          p1_count_accuracy: number | null
          p2_hand_adjustments: number | null
          p3_really_missing: number | null
          p4_paperwork_late: number | null
          p5_out_of_step: number | null
          p6_repeats_below_zero: number | null
          parts_used: string[] | null
          refreshed_at: string | null
          repeat_skus: number | null
          reports_matched_after_paperwork: number | null
          reports_missing_units: number | null
          reports_resolved: number | null
          score: number | null
          stuck_quotations: number | null
          week_end: string
          week_start: string
        }
        Insert: {
          below_zero_skus?: number | null
          biggest_drag?: string | null
          era: string
          hand_adj_lines?: number | null
          hand_adj_source?: string | null
          hand_adj_units?: number | null
          hand_adj_value_jod?: number | null
          late_deliveries?: number | null
          late_transfers?: number | null
          net_taken_off_value_jod?: number | null
          out_of_step_pct?: number | null
          out_of_step_skus?: number | null
          out_of_step_source?: string | null
          p1_count_accuracy?: number | null
          p2_hand_adjustments?: number | null
          p3_really_missing?: number | null
          p4_paperwork_late?: number | null
          p5_out_of_step?: number | null
          p6_repeats_below_zero?: number | null
          parts_used?: string[] | null
          refreshed_at?: string | null
          repeat_skus?: number | null
          reports_matched_after_paperwork?: number | null
          reports_missing_units?: number | null
          reports_resolved?: number | null
          score?: number | null
          stuck_quotations?: number | null
          week_end: string
          week_start: string
        }
        Update: {
          below_zero_skus?: number | null
          biggest_drag?: string | null
          era?: string
          hand_adj_lines?: number | null
          hand_adj_source?: string | null
          hand_adj_units?: number | null
          hand_adj_value_jod?: number | null
          late_deliveries?: number | null
          late_transfers?: number | null
          net_taken_off_value_jod?: number | null
          out_of_step_pct?: number | null
          out_of_step_skus?: number | null
          out_of_step_source?: string | null
          p1_count_accuracy?: number | null
          p2_hand_adjustments?: number | null
          p3_really_missing?: number | null
          p4_paperwork_late?: number | null
          p5_out_of_step?: number | null
          p6_repeats_below_zero?: number | null
          parts_used?: string[] | null
          refreshed_at?: string | null
          repeat_skus?: number | null
          reports_matched_after_paperwork?: number | null
          reports_missing_units?: number | null
          reports_resolved?: number | null
          score?: number | null
          stuck_quotations?: number | null
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      inv_health_weights: {
        Row: {
          label: string
          part: string
          rule: string
          weight: number
        }
        Insert: {
          label: string
          part: string
          rule: string
          weight: number
        }
        Update: {
          label?: string
          part?: string
          rule?: string
          weight?: number
        }
        Relationships: []
      }
      inv_issue_events: {
        Row: {
          actor: string
          at: string
          detail: Json
          event_type: string
          id: number
          issue_id: string
        }
        Insert: {
          actor: string
          at?: string
          detail?: Json
          event_type: string
          id?: never
          issue_id: string
        }
        Update: {
          actor?: string
          at?: string
          detail?: Json
          event_type?: string
          id?: never
          issue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_issue_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "inv_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_issue_events_deleted_backup: {
        Row: {
          actor: string | null
          at: string | null
          detail: Json | null
          event_type: string | null
          id: number | null
          issue_id: string | null
        }
        Insert: {
          actor?: string | null
          at?: string | null
          detail?: Json | null
          event_type?: string | null
          id?: number | null
          issue_id?: string | null
        }
        Update: {
          actor?: string | null
          at?: string | null
          detail?: Json | null
          event_type?: string | null
          id?: number | null
          issue_id?: string | null
        }
        Relationships: []
      }
      inv_issues: {
        Row: {
          backfilled: boolean
          barcode: string | null
          diff_physical_vs_odoo: number | null
          diff_physical_vs_shopify: number | null
          email_error: string | null
          email_status: string | null
          employee_name: string
          first_submitted_at: string | null
          id: string
          is_test: boolean
          issue_ref: string
          location_name: string
          notes: string | null
          odoo_qty: number | null
          odoo_qty_source: string | null
          odoo_states: Json | null
          physical_qty: number
          product_title: string
          product_type: string | null
          recounts: number
          resolution_kind: string | null
          resolution_missing: number | null
          resolution_moves: Json | null
          resolution_note: string | null
          resolution_summary: string | null
          resolve_odoo_expected: number | null
          resolve_odoo_matched: boolean | null
          resolve_odoo_qty: number | null
          resolved_at: string | null
          resolved_by: string | null
          restored_at: string | null
          scenario: string | null
          shopify_action: string | null
          shopify_action_error: string | null
          shopify_action_result: string | null
          shopify_inventory_item_id: string | null
          shopify_location_id: string | null
          shopify_product_id: string
          shopify_qty_live: number | null
          shopify_qty_reported: number
          shopify_states: Json | null
          shopify_variant_id: string
          sku: string | null
          status: string
          status_before: string | null
          stock_story: Json | null
          submission_key: string
          submitted_at: string
          sync_check_due_at: string | null
          sync_checked_at: string | null
          sync_result: string | null
          unlisted_by_system: boolean
          updated_at: string
          variant_title: string | null
          was_published_before: boolean | null
        }
        Insert: {
          backfilled?: boolean
          barcode?: string | null
          diff_physical_vs_odoo?: number | null
          diff_physical_vs_shopify?: number | null
          email_error?: string | null
          email_status?: string | null
          employee_name: string
          first_submitted_at?: string | null
          id?: string
          is_test?: boolean
          issue_ref?: string
          location_name?: string
          notes?: string | null
          odoo_qty?: number | null
          odoo_qty_source?: string | null
          odoo_states?: Json | null
          physical_qty: number
          product_title: string
          product_type?: string | null
          recounts?: number
          resolution_kind?: string | null
          resolution_missing?: number | null
          resolution_moves?: Json | null
          resolution_note?: string | null
          resolution_summary?: string | null
          resolve_odoo_expected?: number | null
          resolve_odoo_matched?: boolean | null
          resolve_odoo_qty?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          restored_at?: string | null
          scenario?: string | null
          shopify_action?: string | null
          shopify_action_error?: string | null
          shopify_action_result?: string | null
          shopify_inventory_item_id?: string | null
          shopify_location_id?: string | null
          shopify_product_id: string
          shopify_qty_live?: number | null
          shopify_qty_reported: number
          shopify_states?: Json | null
          shopify_variant_id: string
          sku?: string | null
          status?: string
          status_before?: string | null
          stock_story?: Json | null
          submission_key: string
          submitted_at?: string
          sync_check_due_at?: string | null
          sync_checked_at?: string | null
          sync_result?: string | null
          unlisted_by_system?: boolean
          updated_at?: string
          variant_title?: string | null
          was_published_before?: boolean | null
        }
        Update: {
          backfilled?: boolean
          barcode?: string | null
          diff_physical_vs_odoo?: number | null
          diff_physical_vs_shopify?: number | null
          email_error?: string | null
          email_status?: string | null
          employee_name?: string
          first_submitted_at?: string | null
          id?: string
          is_test?: boolean
          issue_ref?: string
          location_name?: string
          notes?: string | null
          odoo_qty?: number | null
          odoo_qty_source?: string | null
          odoo_states?: Json | null
          physical_qty?: number
          product_title?: string
          product_type?: string | null
          recounts?: number
          resolution_kind?: string | null
          resolution_missing?: number | null
          resolution_moves?: Json | null
          resolution_note?: string | null
          resolution_summary?: string | null
          resolve_odoo_expected?: number | null
          resolve_odoo_matched?: boolean | null
          resolve_odoo_qty?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          restored_at?: string | null
          scenario?: string | null
          shopify_action?: string | null
          shopify_action_error?: string | null
          shopify_action_result?: string | null
          shopify_inventory_item_id?: string | null
          shopify_location_id?: string | null
          shopify_product_id?: string
          shopify_qty_live?: number | null
          shopify_qty_reported?: number
          shopify_states?: Json | null
          shopify_variant_id?: string
          sku?: string | null
          status?: string
          status_before?: string | null
          stock_story?: Json | null
          submission_key?: string
          submitted_at?: string
          sync_check_due_at?: string | null
          sync_checked_at?: string | null
          sync_result?: string | null
          unlisted_by_system?: boolean
          updated_at?: string
          variant_title?: string | null
          was_published_before?: boolean | null
        }
        Relationships: []
      }
      inv_issues_deleted: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          events: Json | null
          id: string
          issue_ref: string | null
          reason: string | null
          report: Json
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          events?: Json | null
          id: string
          issue_ref?: string | null
          reason?: string | null
          report: Json
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          events?: Json | null
          id?: string
          issue_ref?: string | null
          reason?: string | null
          report?: Json
        }
        Relationships: []
      }
      inv_issues_deleted_backup: {
        Row: {
          backfilled: boolean | null
          barcode: string | null
          deleted_at: string | null
          diff_physical_vs_odoo: number | null
          diff_physical_vs_shopify: number | null
          email_error: string | null
          email_status: string | null
          employee_name: string | null
          first_submitted_at: string | null
          id: string | null
          is_test: boolean | null
          issue_ref: string | null
          location_name: string | null
          notes: string | null
          odoo_qty: number | null
          odoo_qty_source: string | null
          odoo_states: Json | null
          physical_qty: number | null
          product_title: string | null
          recounts: number | null
          resolve_odoo_expected: number | null
          resolve_odoo_matched: boolean | null
          resolve_odoo_qty: number | null
          resolved_at: string | null
          resolved_by: string | null
          restored_at: string | null
          scenario: string | null
          shopify_action: string | null
          shopify_action_error: string | null
          shopify_action_result: string | null
          shopify_inventory_item_id: string | null
          shopify_location_id: string | null
          shopify_product_id: string | null
          shopify_qty_live: number | null
          shopify_qty_reported: number | null
          shopify_states: Json | null
          shopify_variant_id: string | null
          sku: string | null
          status: string | null
          status_before: string | null
          stock_story: Json | null
          submission_key: string | null
          submitted_at: string | null
          sync_check_due_at: string | null
          sync_checked_at: string | null
          sync_result: string | null
          unlisted_by_system: boolean | null
          updated_at: string | null
          variant_title: string | null
          was_published_before: boolean | null
        }
        Insert: {
          backfilled?: boolean | null
          barcode?: string | null
          deleted_at?: string | null
          diff_physical_vs_odoo?: number | null
          diff_physical_vs_shopify?: number | null
          email_error?: string | null
          email_status?: string | null
          employee_name?: string | null
          first_submitted_at?: string | null
          id?: string | null
          is_test?: boolean | null
          issue_ref?: string | null
          location_name?: string | null
          notes?: string | null
          odoo_qty?: number | null
          odoo_qty_source?: string | null
          odoo_states?: Json | null
          physical_qty?: number | null
          product_title?: string | null
          recounts?: number | null
          resolve_odoo_expected?: number | null
          resolve_odoo_matched?: boolean | null
          resolve_odoo_qty?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          restored_at?: string | null
          scenario?: string | null
          shopify_action?: string | null
          shopify_action_error?: string | null
          shopify_action_result?: string | null
          shopify_inventory_item_id?: string | null
          shopify_location_id?: string | null
          shopify_product_id?: string | null
          shopify_qty_live?: number | null
          shopify_qty_reported?: number | null
          shopify_states?: Json | null
          shopify_variant_id?: string | null
          sku?: string | null
          status?: string | null
          status_before?: string | null
          stock_story?: Json | null
          submission_key?: string | null
          submitted_at?: string | null
          sync_check_due_at?: string | null
          sync_checked_at?: string | null
          sync_result?: string | null
          unlisted_by_system?: boolean | null
          updated_at?: string | null
          variant_title?: string | null
          was_published_before?: boolean | null
        }
        Update: {
          backfilled?: boolean | null
          barcode?: string | null
          deleted_at?: string | null
          diff_physical_vs_odoo?: number | null
          diff_physical_vs_shopify?: number | null
          email_error?: string | null
          email_status?: string | null
          employee_name?: string | null
          first_submitted_at?: string | null
          id?: string | null
          is_test?: boolean | null
          issue_ref?: string | null
          location_name?: string | null
          notes?: string | null
          odoo_qty?: number | null
          odoo_qty_source?: string | null
          odoo_states?: Json | null
          physical_qty?: number | null
          product_title?: string | null
          recounts?: number | null
          resolve_odoo_expected?: number | null
          resolve_odoo_matched?: boolean | null
          resolve_odoo_qty?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          restored_at?: string | null
          scenario?: string | null
          shopify_action?: string | null
          shopify_action_error?: string | null
          shopify_action_result?: string | null
          shopify_inventory_item_id?: string | null
          shopify_location_id?: string | null
          shopify_product_id?: string | null
          shopify_qty_live?: number | null
          shopify_qty_reported?: number | null
          shopify_states?: Json | null
          shopify_variant_id?: string | null
          sku?: string | null
          status?: string | null
          status_before?: string | null
          stock_story?: Json | null
          submission_key?: string | null
          submitted_at?: string | null
          sync_check_due_at?: string | null
          sync_checked_at?: string | null
          sync_result?: string | null
          unlisted_by_system?: boolean | null
          updated_at?: string | null
          variant_title?: string | null
          was_published_before?: boolean | null
        }
        Relationships: []
      }
      inv_kit_checks: {
        Row: {
          can_make: number | null
          day: string
          managed_by: string | null
          odoo_can_make: number | null
          parts: Json | null
          product: string | null
          shopify_available: number | null
          sku: string
          verdict: string | null
        }
        Insert: {
          can_make?: number | null
          day: string
          managed_by?: string | null
          odoo_can_make?: number | null
          parts?: Json | null
          product?: string | null
          shopify_available?: number | null
          sku: string
          verdict?: string | null
        }
        Update: {
          can_make?: number | null
          day?: string
          managed_by?: string | null
          odoo_can_make?: number | null
          parts?: Json | null
          product?: string | null
          shopify_available?: number | null
          sku?: string
          verdict?: string | null
        }
        Relationships: []
      }
      inv_kits: {
        Row: {
          bom_type: string | null
          box_only: boolean
          components: Json
          odoo_name: string | null
          refreshed_at: string
          sku: string
        }
        Insert: {
          bom_type?: string | null
          box_only?: boolean
          components?: Json
          odoo_name?: string | null
          refreshed_at?: string
          sku: string
        }
        Update: {
          bom_type?: string | null
          box_only?: boolean
          components?: Json
          odoo_name?: string | null
          refreshed_at?: string
          sku?: string
        }
        Relationships: []
      }
      inv_order_edits: {
        Row: {
          created_at: string | null
          first_day: string | null
          fixed_at: string | null
          id: number
          kind: string | null
          last_checked: string | null
          odoo_delivered: number | null
          odoo_order: string | null
          odoo_qty: number | null
          order_name: string
          product: string | null
          shopify_ordered: number | null
          shopify_qty: number | null
          sku: string
          todo: string | null
        }
        Insert: {
          created_at?: string | null
          first_day?: string | null
          fixed_at?: string | null
          id?: number
          kind?: string | null
          last_checked?: string | null
          odoo_delivered?: number | null
          odoo_order?: string | null
          odoo_qty?: number | null
          order_name: string
          product?: string | null
          shopify_ordered?: number | null
          shopify_qty?: number | null
          sku: string
          todo?: string | null
        }
        Update: {
          created_at?: string | null
          first_day?: string | null
          fixed_at?: string | null
          id?: number
          kind?: string | null
          last_checked?: string | null
          odoo_delivered?: number | null
          odoo_order?: string | null
          odoo_qty?: number | null
          order_name?: string
          product?: string | null
          shopify_ordered?: number | null
          shopify_qty?: number | null
          sku?: string
          todo?: string | null
        }
        Relationships: []
      }
      inv_recount_requests: {
        Row: {
          done_at: string | null
          done_issue_ref: string | null
          id: number
          issue_id: string | null
          issue_ref: string | null
          last_sent_at: string | null
          name: string
          requested_at: string
          sku: string | null
          times_sent: number
        }
        Insert: {
          done_at?: string | null
          done_issue_ref?: string | null
          id?: never
          issue_id?: string | null
          issue_ref?: string | null
          last_sent_at?: string | null
          name: string
          requested_at?: string
          sku?: string | null
          times_sent?: number
        }
        Update: {
          done_at?: string | null
          done_issue_ref?: string | null
          id?: never
          issue_id?: string | null
          issue_ref?: string | null
          last_sent_at?: string | null
          name?: string
          requested_at?: string
          sku?: string | null
          times_sent?: number
        }
        Relationships: [
          {
            foreignKeyName: "inv_recount_requests_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "inv_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      inv_stock_compare: {
        Row: {
          odoo_available: number | null
          odoo_forecasted: number | null
          odoo_found: boolean | null
          odoo_on_hand: number | null
          odoo_outgoing: number | null
          product: string | null
          product_status: string | null
          product_type: string | null
          shopify_available: number | null
          shopify_committed: number | null
          shopify_on_hand: number | null
          sku: string | null
          taken_at: string
          variant: string | null
          variant_id: string
        }
        Insert: {
          odoo_available?: number | null
          odoo_forecasted?: number | null
          odoo_found?: boolean | null
          odoo_on_hand?: number | null
          odoo_outgoing?: number | null
          product?: string | null
          product_status?: string | null
          product_type?: string | null
          shopify_available?: number | null
          shopify_committed?: number | null
          shopify_on_hand?: number | null
          sku?: string | null
          taken_at: string
          variant?: string | null
          variant_id: string
        }
        Update: {
          odoo_available?: number | null
          odoo_forecasted?: number | null
          odoo_found?: boolean | null
          odoo_on_hand?: number | null
          odoo_outgoing?: number | null
          product?: string | null
          product_status?: string | null
          product_type?: string | null
          shopify_available?: number | null
          shopify_committed?: number | null
          shopify_on_hand?: number | null
          sku?: string | null
          taken_at?: string
          variant?: string | null
          variant_id?: string
        }
        Relationships: []
      }
      inv_sync_failures: {
        Row: {
          action: string | null
          created_at: string
          error: string | null
          id: string
          inventory_item_id: string | null
          issue_id: string | null
          issue_ref: string | null
          odoo_on_hand: number | null
          odoo_outgoing: number | null
          product: string | null
          result: string | null
          shopify_after: number | null
          shopify_before: number | null
          sku: string | null
          source: string
          variant_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          error?: string | null
          id?: string
          inventory_item_id?: string | null
          issue_id?: string | null
          issue_ref?: string | null
          odoo_on_hand?: number | null
          odoo_outgoing?: number | null
          product?: string | null
          result?: string | null
          shopify_after?: number | null
          shopify_before?: number | null
          sku?: string | null
          source?: string
          variant_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          error?: string | null
          id?: string
          inventory_item_id?: string | null
          issue_id?: string | null
          issue_ref?: string | null
          odoo_on_hand?: number | null
          odoo_outgoing?: number | null
          product?: string | null
          result?: string | null
          shopify_after?: number | null
          shopify_before?: number | null
          sku?: string | null
          source?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_sync_failures_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "inv_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_weekly_briefs: {
        Row: {
          error: string | null
          id: number
          preview: boolean | null
          sent_at: string | null
          status: string | null
          week_from: string
          week_to: string
        }
        Insert: {
          error?: string | null
          id?: number
          preview?: boolean | null
          sent_at?: string | null
          status?: string | null
          week_from: string
          week_to: string
        }
        Update: {
          error?: string | null
          id?: number
          preview?: boolean | null
          sent_at?: string | null
          status?: string | null
          week_from?: string
          week_to?: string
        }
        Relationships: []
      }
      kitchen_pin_fails: {
        Row: {
          at: string
          id: number
          ip: string
        }
        Insert: {
          at?: string
          id?: number
          ip: string
        }
        Update: {
          at?: string
          id?: number
          ip?: string
        }
        Relationships: []
      }
      kitchen_toggle_log: {
        Row: {
          created_at: string | null
          error: string | null
          from_status: string | null
          id: number
          product_id: string
          product_title: string | null
          result: string | null
          staff_name: string | null
          to_status: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          from_status?: string | null
          id?: number
          product_id: string
          product_title?: string | null
          result?: string | null
          staff_name?: string | null
          to_status?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          from_status?: string | null
          id?: number
          product_id?: string
          product_title?: string | null
          result?: string | null
          staff_name?: string | null
          to_status?: string | null
        }
        Relationships: []
      }
      klaviyo_attributed_daily: {
        Row: {
          created_at: string
          date: string
          id: string
          orders: number
          revenue_jod: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          orders?: number
          revenue_jod?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          orders?: number
          revenue_jod?: number
          updated_at?: string
        }
        Relationships: []
      }
      klaviyo_attributed_orders: {
        Row: {
          created_at: string
          date: string
          id: string
          order_id: string
          revenue_jod: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          order_id: string
          revenue_jod?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          order_id?: string
          revenue_jod?: number
          updated_at?: string
        }
        Relationships: []
      }
      klaviyo_campaigns: {
        Row: {
          campaign_id: string
          campaign_message_id: string
          click_rate: number
          clicked: number
          conversion_rate: number
          created_at: string
          delivered: number
          id: string
          name: string
          open_rate: number
          opened: number
          orders: number
          revenue_jod: number
          send_channel: string
          sent: number
          sent_on: string
          spam_complaints: number | null
          unsubscribe_rate: number | null
          unsubscribes: number | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          campaign_message_id: string
          click_rate?: number
          clicked?: number
          conversion_rate?: number
          created_at?: string
          delivered?: number
          id?: string
          name: string
          open_rate?: number
          opened?: number
          orders?: number
          revenue_jod?: number
          send_channel?: string
          sent?: number
          sent_on: string
          spam_complaints?: number | null
          unsubscribe_rate?: number | null
          unsubscribes?: number | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          campaign_message_id?: string
          click_rate?: number
          clicked?: number
          conversion_rate?: number
          created_at?: string
          delivered?: number
          id?: string
          name?: string
          open_rate?: number
          opened?: number
          orders?: number
          revenue_jod?: number
          send_channel?: string
          sent?: number
          sent_on?: string
          spam_complaints?: number | null
          unsubscribe_rate?: number | null
          unsubscribes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      klaviyo_flow_monthly: {
        Row: {
          click_rate: number
          clicked: number
          conversion_rate: number
          conversions: number
          created_at: string
          delivered: number
          flow_id: string
          flow_message_id: string
          flow_name: string
          month: string
          open_rate: number
          opened: number
          recipients: number
          revenue_jod: number
          send_channel: string
          spam_complaints: number | null
          unique_buyers: number | null
          unsubscribes: number | null
          updated_at: string
        }
        Insert: {
          click_rate?: number
          clicked?: number
          conversion_rate?: number
          conversions?: number
          created_at?: string
          delivered?: number
          flow_id: string
          flow_message_id: string
          flow_name: string
          month: string
          open_rate?: number
          opened?: number
          recipients?: number
          revenue_jod?: number
          send_channel?: string
          spam_complaints?: number | null
          unique_buyers?: number | null
          unsubscribes?: number | null
          updated_at?: string
        }
        Update: {
          click_rate?: number
          clicked?: number
          conversion_rate?: number
          conversions?: number
          created_at?: string
          delivered?: number
          flow_id?: string
          flow_message_id?: string
          flow_name?: string
          month?: string
          open_rate?: number
          opened?: number
          recipients?: number
          revenue_jod?: number
          send_channel?: string
          spam_complaints?: number | null
          unique_buyers?: number | null
          unsubscribes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      klaviyo_flows: {
        Row: {
          click_rate: number
          clicked: number
          conversion_rate: number
          conversions: number
          created_at: string
          date: string
          delivered: number
          flow_id: string
          flow_message_id: string
          flow_name: string
          id: string
          open_rate: number
          opened: number
          recipients: number
          revenue_jod: number
          send_channel: string
          spam_complaints: number | null
          unsubscribe_rate: number | null
          unsubscribes: number | null
          updated_at: string
        }
        Insert: {
          click_rate?: number
          clicked?: number
          conversion_rate?: number
          conversions?: number
          created_at?: string
          date: string
          delivered?: number
          flow_id: string
          flow_message_id: string
          flow_name: string
          id?: string
          open_rate?: number
          opened?: number
          recipients?: number
          revenue_jod?: number
          send_channel?: string
          spam_complaints?: number | null
          unsubscribe_rate?: number | null
          unsubscribes?: number | null
          updated_at?: string
        }
        Update: {
          click_rate?: number
          clicked?: number
          conversion_rate?: number
          conversions?: number
          created_at?: string
          date?: string
          delivered?: number
          flow_id?: string
          flow_message_id?: string
          flow_name?: string
          id?: string
          open_rate?: number
          opened?: number
          recipients?: number
          revenue_jod?: number
          send_channel?: string
          spam_complaints?: number | null
          unsubscribe_rate?: number | null
          unsubscribes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      klaviyo_order_influence: {
        Row: {
          created_at: string
          date: string
          hours_since_click: number | null
          id: string
          order_id: string
          ordered_at: string
          revenue_jod: number
          sub_channel: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          hours_since_click?: number | null
          id?: string
          order_id: string
          ordered_at: string
          revenue_jod?: number
          sub_channel: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          hours_since_click?: number | null
          id?: string
          order_id?: string
          ordered_at?: string
          revenue_jod?: number
          sub_channel?: string
          updated_at?: string
        }
        Relationships: []
      }
      klaviyo_push: {
        Row: {
          conversions: number
          created_at: string
          delivered: number
          id: string
          message_id: string
          open_rate: number
          opened: number
          revenue_jod: number
          sent: number
          sent_on: string
          source_id: string
          source_name: string
          source_type: string
          updated_at: string
        }
        Insert: {
          conversions?: number
          created_at?: string
          delivered?: number
          id?: string
          message_id: string
          open_rate?: number
          opened?: number
          revenue_jod?: number
          sent?: number
          sent_on: string
          source_id: string
          source_name: string
          source_type?: string
          updated_at?: string
        }
        Update: {
          conversions?: number
          created_at?: string
          delivered?: number
          id?: string
          message_id?: string
          open_rate?: number
          opened?: number
          revenue_jod?: number
          sent?: number
          sent_on?: string
          source_id?: string
          source_name?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      klaviyo_reach_daily: {
        Row: {
          channel: string
          created_at: string
          date: string
          event_count: number
          id: string
          profile_count: number
          profile_hashes: number[]
          source: string
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          date: string
          event_count?: number
          id?: string
          profile_count?: number
          profile_hashes?: number[]
          source: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          date?: string
          event_count?: number
          id?: string
          profile_count?: number
          profile_hashes?: number[]
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      ll_activities: {
        Row: {
          activity_date: string
          activity_id: string
          created_at: string
          detail: string | null
          expires_at: string | null
          initial_points: number
          kind: string
          ll_customer_id: string
          points_expired: number
          points_remaining: number
          pre_enrollment: boolean
          shopify_order_id: string | null
          source: string
          state: string
        }
        Insert: {
          activity_date: string
          activity_id: string
          created_at?: string
          detail?: string | null
          expires_at?: string | null
          initial_points?: number
          kind: string
          ll_customer_id: string
          points_expired?: number
          points_remaining?: number
          pre_enrollment?: boolean
          shopify_order_id?: string | null
          source: string
          state: string
        }
        Update: {
          activity_date?: string
          activity_id?: string
          created_at?: string
          detail?: string | null
          expires_at?: string | null
          initial_points?: number
          kind?: string
          ll_customer_id?: string
          points_expired?: number
          points_remaining?: number
          pre_enrollment?: boolean
          shopify_order_id?: string | null
          source?: string
          state?: string
        }
        Relationships: []
      }
      ll_rewards: {
        Row: {
          amount: number | null
          claimed_at: string
          cost_points: number
          created_at: string
          discount_type: string | null
          expires_at: string | null
          first_used_at: string | null
          ll_customer_id: string
          order_total_jod: number | null
          source: string
          state: string
          title: string
          used_with_orders: string | null
        }
        Insert: {
          amount?: number | null
          claimed_at: string
          cost_points?: number
          created_at?: string
          discount_type?: string | null
          expires_at?: string | null
          first_used_at?: string | null
          ll_customer_id: string
          order_total_jod?: number | null
          source: string
          state: string
          title: string
          used_with_orders?: string | null
        }
        Update: {
          amount?: number | null
          claimed_at?: string
          cost_points?: number
          created_at?: string
          discount_type?: string | null
          expires_at?: string | null
          first_used_at?: string | null
          ll_customer_id?: string
          order_total_jod?: number | null
          source?: string
          state?: string
          title?: string
          used_with_orders?: string | null
        }
        Relationships: []
      }
      ll_snapshots: {
        Row: {
          birthday_rewards_issued: number
          blue_members: number
          created_at: string
          gold_members: number
          id: string
          platinum_members: number
          points_earned: number | null
          points_earned_reversed: number | null
          points_expired: number | null
          points_outstanding: number
          points_outstanding_start: number | null
          points_redeemed: number | null
          points_redeemed_reimbursed: number | null
          points_source: string
          redemption_rate: number
          redemptions: number
          silver_members: number
          snapshot_date: string
          updated_at: string
        }
        Insert: {
          birthday_rewards_issued?: number
          blue_members?: number
          created_at?: string
          gold_members?: number
          id?: string
          platinum_members?: number
          points_earned?: number | null
          points_earned_reversed?: number | null
          points_expired?: number | null
          points_outstanding?: number
          points_outstanding_start?: number | null
          points_redeemed?: number | null
          points_redeemed_reimbursed?: number | null
          points_source?: string
          redemption_rate?: number
          redemptions?: number
          silver_members?: number
          snapshot_date: string
          updated_at?: string
        }
        Update: {
          birthday_rewards_issued?: number
          blue_members?: number
          created_at?: string
          gold_members?: number
          id?: string
          platinum_members?: number
          points_earned?: number | null
          points_earned_reversed?: number | null
          points_expired?: number | null
          points_outstanding?: number
          points_outstanding_start?: number | null
          points_redeemed?: number | null
          points_redeemed_reimbursed?: number | null
          points_source?: string
          redemption_rate?: number
          redemptions?: number
          silver_members?: number
          snapshot_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      ll_transactions: {
        Row: {
          activity_title: string | null
          created_at: string
          flow_title: string | null
          ll_customer_id: string
          occurred_at: string
          points_approved: number
          points_pending: number
          resource: string
          shopify_order_id: string | null
          source: string
          transaction_id: string
        }
        Insert: {
          activity_title?: string | null
          created_at?: string
          flow_title?: string | null
          ll_customer_id: string
          occurred_at: string
          points_approved?: number
          points_pending?: number
          resource: string
          shopify_order_id?: string | null
          source: string
          transaction_id: string
        }
        Update: {
          activity_title?: string | null
          created_at?: string
          flow_title?: string | null
          ll_customer_id?: string
          occurred_at?: string
          points_approved?: number
          points_pending?: number
          resource?: string
          shopify_order_id?: string | null
          source?: string
          transaction_id?: string
        }
        Relationships: []
      }
      loyalty_tag_sync: {
        Row: {
          collection_id: string | null
          created_at: string | null
          id: number
          product_name: string | null
          removed: boolean
          sku: string | null
          tag_id: number | null
          tag_name: string | null
          template_id: number | null
        }
        Insert: {
          collection_id?: string | null
          created_at?: string | null
          id?: number
          product_name?: string | null
          removed?: boolean
          sku?: string | null
          tag_id?: number | null
          tag_name?: string | null
          template_id?: number | null
        }
        Update: {
          collection_id?: string | null
          created_at?: string | null
          id?: number
          product_name?: string | null
          removed?: boolean
          sku?: string | null
          tag_id?: number | null
          tag_name?: string | null
          template_id?: number | null
        }
        Relationships: []
      }
      odoo_code_age: {
        Row: {
          action: string | null
          app: string | null
          checked_at: string | null
          code: string
          created_at: string | null
          ends_at: string | null
          kind: string | null
          last_order: string | null
          last_used: string | null
          starts_at: string | null
          status: string | null
          title: string | null
          usage_limit: number | null
          uses: number | null
        }
        Insert: {
          action?: string | null
          app?: string | null
          checked_at?: string | null
          code: string
          created_at?: string | null
          ends_at?: string | null
          kind?: string | null
          last_order?: string | null
          last_used?: string | null
          starts_at?: string | null
          status?: string | null
          title?: string | null
          usage_limit?: number | null
          uses?: number | null
        }
        Update: {
          action?: string | null
          app?: string | null
          checked_at?: string | null
          code?: string
          created_at?: string | null
          ends_at?: string | null
          kind?: string | null
          last_order?: string | null
          last_used?: string | null
          starts_at?: string | null
          status?: string | null
          title?: string | null
          usage_limit?: number | null
          uses?: number | null
        }
        Relationships: []
      }
      odoo_code_build: {
        Row: {
          action: string
          at: string
          card_id: number | null
          code: string | null
          detail: Json | null
          id: number
          program_id: number | null
        }
        Insert: {
          action: string
          at?: string
          card_id?: number | null
          code?: string | null
          detail?: Json | null
          id?: never
          program_id?: number | null
        }
        Update: {
          action?: string
          at?: string
          card_id?: number | null
          code?: string | null
          detail?: Json | null
          id?: never
          program_id?: number | null
        }
        Relationships: []
      }
      odoo_code_coverage: {
        Row: {
          code: string
          id: number
          kind: string | null
          odoo_card: number | null
          odoo_points: number | null
          problem: string
          run_at: string
          title: string | null
        }
        Insert: {
          code: string
          id?: never
          kind?: string | null
          odoo_card?: number | null
          odoo_points?: number | null
          problem: string
          run_at: string
          title?: string | null
        }
        Update: {
          code?: string
          id?: never
          kind?: string | null
          odoo_card?: number | null
          odoo_points?: number | null
          problem?: string
          run_at?: string
          title?: string | null
        }
        Relationships: []
      }
      odoo_code_retire: {
        Row: {
          action: string | null
          at: string | null
          code: string | null
          codes_count: number | null
          done: boolean | null
          error: string | null
          id: number
          node_id: string | null
          status_before: string | null
          summary: string | null
          title_before: string | null
          type: string | null
        }
        Insert: {
          action?: string | null
          at?: string | null
          code?: string | null
          codes_count?: number | null
          done?: boolean | null
          error?: string | null
          id?: number
          node_id?: string | null
          status_before?: string | null
          summary?: string | null
          title_before?: string | null
          type?: string | null
        }
        Update: {
          action?: string | null
          at?: string | null
          code?: string | null
          codes_count?: number | null
          done?: boolean | null
          error?: string | null
          id?: number
          node_id?: string | null
          status_before?: string | null
          summary?: string | null
          title_before?: string | null
          type?: string | null
        }
        Relationships: []
      }
      odoo_code_usage: {
        Row: {
          after_points: number | null
          at: string
          before_points: number | null
          card_id: number
          code: string
          dry: boolean
          id: number
          program: string | null
          reason: string | null
          shopify_order: string | null
        }
        Insert: {
          after_points?: number | null
          at?: string
          before_points?: number | null
          card_id: number
          code: string
          dry?: boolean
          id?: never
          program?: string | null
          reason?: string | null
          shopify_order?: string | null
        }
        Update: {
          after_points?: number | null
          at?: string
          before_points?: number | null
          card_id?: number
          code?: string
          dry?: boolean
          id?: never
          program?: string | null
          reason?: string | null
          shopify_order?: string | null
        }
        Relationships: []
      }
      odoo_discount_watch: {
        Row: {
          after: string | null
          before: string | null
          change: string
          created_at: string
          dry: boolean
          id: number
          program_id: number | null
          program_name: string | null
          reward_id: number | null
        }
        Insert: {
          after?: string | null
          before?: string | null
          change: string
          created_at?: string
          dry?: boolean
          id?: never
          program_id?: number | null
          program_name?: string | null
          reward_id?: number | null
        }
        Update: {
          after?: string | null
          before?: string | null
          change?: string
          created_at?: string
          dry?: boolean
          id?: never
          program_id?: number | null
          program_name?: string | null
          reward_id?: number | null
        }
        Relationships: []
      }
      odoo_first_po: {
        Row: {
          first_po_at: string | null
          first_po_name: string | null
          loaded_at: string | null
          product_id: number | null
          sku: string
        }
        Insert: {
          first_po_at?: string | null
          first_po_name?: string | null
          loaded_at?: string | null
          product_id?: number | null
          sku: string
        }
        Update: {
          first_po_at?: string | null
          first_po_name?: string | null
          loaded_at?: string | null
          product_id?: number | null
          sku?: string
        }
        Relationships: []
      }
      odoo_fodc_adjust_moves: {
        Row: {
          at: string | null
          by_user: string | null
          loaded_at: string | null
          location_dest_id: number | null
          location_id: number | null
          move_id: number
          product: string | null
          product_id: number | null
          qty_change: number | null
          sku: string | null
        }
        Insert: {
          at?: string | null
          by_user?: string | null
          loaded_at?: string | null
          location_dest_id?: number | null
          location_id?: number | null
          move_id: number
          product?: string | null
          product_id?: number | null
          qty_change?: number | null
          sku?: string | null
        }
        Update: {
          at?: string | null
          by_user?: string | null
          loaded_at?: string | null
          location_dest_id?: number | null
          location_id?: number | null
          move_id?: number
          product?: string | null
          product_id?: number | null
          qty_change?: number | null
          sku?: string | null
        }
        Relationships: []
      }
      odoo_fodc_pickings: {
        Row: {
          created_at: string | null
          done_at: string | null
          kind: string | null
          loaded_at: string | null
          name: string | null
          origin: string | null
          picking_id: number
          picking_type: string | null
          scheduled_at: string | null
          state: string | null
        }
        Insert: {
          created_at?: string | null
          done_at?: string | null
          kind?: string | null
          loaded_at?: string | null
          name?: string | null
          origin?: string | null
          picking_id: number
          picking_type?: string | null
          scheduled_at?: string | null
          state?: string | null
        }
        Update: {
          created_at?: string | null
          done_at?: string | null
          kind?: string | null
          loaded_at?: string | null
          name?: string | null
          origin?: string | null
          picking_id?: number
          picking_type?: string | null
          scheduled_at?: string | null
          state?: string | null
        }
        Relationships: []
      }
      odoo_fodc_sale_orders: {
        Row: {
          client_order_ref: string | null
          created_at: string | null
          date_order: string | null
          loaded_at: string | null
          name: string | null
          order_id: number
          state: string | null
        }
        Insert: {
          client_order_ref?: string | null
          created_at?: string | null
          date_order?: string | null
          loaded_at?: string | null
          name?: string | null
          order_id: number
          state?: string | null
        }
        Update: {
          client_order_ref?: string | null
          created_at?: string | null
          date_order?: string | null
          loaded_at?: string | null
          name?: string | null
          order_id?: number
          state?: string | null
        }
        Relationships: []
      }
      odoo_product_costs: {
        Row: {
          active: boolean | null
          loaded_at: string | null
          name: string | null
          product_id: number
          sku: string | null
          standard_price: number | null
        }
        Insert: {
          active?: boolean | null
          loaded_at?: string | null
          name?: string | null
          product_id: number
          sku?: string | null
          standard_price?: number | null
        }
        Update: {
          active?: boolean | null
          loaded_at?: string | null
          name?: string | null
          product_id?: number
          sku?: string | null
          standard_price?: number | null
        }
        Relationships: []
      }
      odoo_stock_fixes: {
        Row: {
          after: number | null
          before: number | null
          created_at: string | null
          id: number
          location_id: number | null
          product: string | null
          reason: string | null
          sku: string | null
        }
        Insert: {
          after?: number | null
          before?: number | null
          created_at?: string | null
          id?: number
          location_id?: number | null
          product?: string | null
          reason?: string | null
          sku?: string | null
        }
        Update: {
          after?: number | null
          before?: number | null
          created_at?: string | null
          id?: number
          location_id?: number | null
          product?: string | null
          reason?: string | null
          sku?: string | null
        }
        Relationships: []
      }
      odoo_till_check: {
        Row: {
          code: string | null
          customer: string | null
          expect_ok: boolean | null
          family: string | null
          id: number
          message: string | null
          pass: boolean | null
          program: string | null
          reward_products: number | null
          run_at: string | null
          till_ok: boolean | null
        }
        Insert: {
          code?: string | null
          customer?: string | null
          expect_ok?: boolean | null
          family?: string | null
          id?: number
          message?: string | null
          pass?: boolean | null
          program?: string | null
          reward_products?: number | null
          run_at?: string | null
          till_ok?: boolean | null
        }
        Update: {
          code?: string | null
          customer?: string | null
          expect_ok?: boolean | null
          family?: string | null
          id?: number
          message?: string | null
          pass?: boolean | null
          program?: string | null
          reward_products?: number | null
          run_at?: string | null
          till_ok?: boolean | null
        }
        Relationships: []
      }
      odoo_webkul_examples: {
        Row: {
          id: number
          name: string | null
          reward_id: number | null
          saved_at: string
          snapshot: Json | null
        }
        Insert: {
          id?: never
          name?: string | null
          reward_id?: number | null
          saved_at?: string
          snapshot?: Json | null
        }
        Update: {
          id?: never
          name?: string | null
          reward_id?: number | null
          saved_at?: string
          snapshot?: Json | null
        }
        Relationships: []
      }
      order_requests: {
        Row: {
          cancelled: boolean | null
          created_at: string | null
          edited: boolean | null
          event_id: string
          fulfilled: boolean | null
          kind: string | null
          order_name: string | null
          order_products: string | null
          products: string[] | null
          request: string | null
          shopify_url: string | null
        }
        Insert: {
          cancelled?: boolean | null
          created_at?: string | null
          edited?: boolean | null
          event_id: string
          fulfilled?: boolean | null
          kind?: string | null
          order_name?: string | null
          order_products?: string | null
          products?: string[] | null
          request?: string | null
          shopify_url?: string | null
        }
        Update: {
          cancelled?: boolean | null
          created_at?: string | null
          edited?: boolean | null
          event_id?: string
          fulfilled?: boolean | null
          kind?: string | null
          order_name?: string | null
          order_products?: string | null
          products?: string[] | null
          request?: string | null
          shopify_url?: string | null
        }
        Relationships: []
      }
      pos_sync_days: {
        Row: {
          checked_at: string | null
          day: string
          issues: number | null
          matched: number | null
          odoo_orders: number | null
          odoo_total: number | null
          odoo_with_customer: number | null
          odoo_with_customer_total: number | null
          shopify_orders: number | null
          shopify_total: number | null
        }
        Insert: {
          checked_at?: string | null
          day: string
          issues?: number | null
          matched?: number | null
          odoo_orders?: number | null
          odoo_total?: number | null
          odoo_with_customer?: number | null
          odoo_with_customer_total?: number | null
          shopify_orders?: number | null
          shopify_total?: number | null
        }
        Update: {
          checked_at?: string | null
          day?: string
          issues?: number | null
          matched?: number | null
          odoo_orders?: number | null
          odoo_total?: number | null
          odoo_with_customer?: number | null
          odoo_with_customer_total?: number | null
          shopify_orders?: number | null
          shopify_total?: number | null
        }
        Relationships: []
      }
      pos_sync_issues: {
        Row: {
          created_at: string | null
          day: string
          detail: string | null
          id: number
          kind: string
          odoo_total: number | null
          odoo_url: string | null
          order_time: string | null
          pos_ref: string | null
          shopify_order: string | null
          shopify_total: number | null
          shopify_url: string | null
        }
        Insert: {
          created_at?: string | null
          day: string
          detail?: string | null
          id?: number
          kind: string
          odoo_total?: number | null
          odoo_url?: string | null
          order_time?: string | null
          pos_ref?: string | null
          shopify_order?: string | null
          shopify_total?: number | null
          shopify_url?: string | null
        }
        Update: {
          created_at?: string | null
          day?: string
          detail?: string | null
          id?: number
          kind?: string
          odoo_total?: number | null
          odoo_url?: string | null
          order_time?: string | null
          pos_ref?: string | null
          shopify_order?: string | null
          shopify_total?: number | null
          shopify_url?: string | null
        }
        Relationships: []
      }
      product_setup_log: {
        Row: {
          at: string
          changes: Json
          dry: boolean
          error: string | null
          id: number
          missing: string[]
          name: string | null
          needs_look: string | null
          odoo_created: string | null
          product_type: string | null
          resolved_at: string | null
          shopify_product_id: number | null
          sku: string | null
          status: string
          target: string
          template_id: number | null
          vendor: string | null
        }
        Insert: {
          at?: string
          changes?: Json
          dry?: boolean
          error?: string | null
          id?: number
          missing?: string[]
          name?: string | null
          needs_look?: string | null
          odoo_created?: string | null
          product_type?: string | null
          resolved_at?: string | null
          shopify_product_id?: number | null
          sku?: string | null
          status: string
          target?: string
          template_id?: number | null
          vendor?: string | null
        }
        Update: {
          at?: string
          changes?: Json
          dry?: boolean
          error?: string | null
          id?: number
          missing?: string[]
          name?: string | null
          needs_look?: string | null
          odoo_created?: string | null
          product_type?: string | null
          resolved_at?: string | null
          shopify_product_id?: number | null
          sku?: string | null
          status?: string
          target?: string
          template_id?: number | null
          vendor?: string | null
        }
        Relationships: []
      }
      product_setup_queue: {
        Row: {
          done_at: string | null
          gave_up_at: string | null
          last_try_at: string | null
          note: string | null
          queued_at: string
          shopify_product_id: number
          skus: string[]
          title: string | null
          topic: string | null
          tries: number
        }
        Insert: {
          done_at?: string | null
          gave_up_at?: string | null
          last_try_at?: string | null
          note?: string | null
          queued_at?: string
          shopify_product_id: number
          skus?: string[]
          title?: string | null
          topic?: string | null
          tries?: number
        }
        Update: {
          done_at?: string | null
          gave_up_at?: string | null
          last_try_at?: string | null
          note?: string | null
          queued_at?: string
          shopify_product_id?: number
          skus?: string[]
          title?: string | null
          topic?: string | null
          tries?: number
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          month_highlight: string
          next_month_bullets: string[]
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          month_highlight: string
          next_month_bullets?: string[]
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          month_highlight?: string
          next_month_bullets?: string[]
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      scratch_peek: {
        Row: {
          body: Json | null
          id: number
        }
        Insert: {
          body?: Json | null
          id: number
        }
        Update: {
          body?: Json | null
          id?: number
        }
        Relationships: []
      }
      shop_inv_adjustments: {
        Row: {
          adj_count: number | null
          app: string | null
          at_local: string | null
          change: number | null
          location: string | null
          reason: string | null
          ref_uri: string | null
          row_no: number
          sku: string | null
          source_file: string
          staff: string | null
          state: string | null
          variant_title: string | null
        }
        Insert: {
          adj_count?: number | null
          app?: string | null
          at_local?: string | null
          change?: number | null
          location?: string | null
          reason?: string | null
          ref_uri?: string | null
          row_no: number
          sku?: string | null
          source_file: string
          staff?: string | null
          state?: string | null
          variant_title?: string | null
        }
        Update: {
          adj_count?: number | null
          app?: string | null
          at_local?: string | null
          change?: number | null
          location?: string | null
          reason?: string | null
          ref_uri?: string | null
          row_no?: number
          sku?: string | null
          source_file?: string
          staff?: string | null
          state?: string | null
          variant_title?: string | null
        }
        Relationships: []
      }
      shop_po_reference: {
        Row: {
          at_local: string | null
          destination: string | null
          ordered_qty: number | null
          po_id: string | null
          po_name: string | null
          po_ref: string | null
          product_title: string | null
          row_no: number
          sku: string | null
          source_file: string
          supplier: string | null
          variant_title: string | null
        }
        Insert: {
          at_local?: string | null
          destination?: string | null
          ordered_qty?: number | null
          po_id?: string | null
          po_name?: string | null
          po_ref?: string | null
          product_title?: string | null
          row_no: number
          sku?: string | null
          source_file: string
          supplier?: string | null
          variant_title?: string | null
        }
        Update: {
          at_local?: string | null
          destination?: string | null
          ordered_qty?: number | null
          po_id?: string | null
          po_name?: string | null
          po_ref?: string | null
          product_title?: string | null
          row_no?: number
          sku?: string | null
          source_file?: string
          supplier?: string | null
          variant_title?: string | null
        }
        Relationships: []
      }
      shop_product_dates: {
        Row: {
          loaded_at: string | null
          product_created_at: string | null
          product_id: number | null
          product_title: string | null
          sku: string | null
          status: string | null
          variant_created_at: string | null
          variant_id: number
          variant_title: string | null
        }
        Insert: {
          loaded_at?: string | null
          product_created_at?: string | null
          product_id?: number | null
          product_title?: string | null
          sku?: string | null
          status?: string | null
          variant_created_at?: string | null
          variant_id: number
          variant_title?: string | null
        }
        Update: {
          loaded_at?: string | null
          product_created_at?: string | null
          product_id?: number | null
          product_title?: string | null
          sku?: string | null
          status?: string | null
          variant_created_at?: string | null
          variant_id?: number
          variant_title?: string | null
        }
        Relationships: []
      }
      shop_received_items: {
        Row: {
          at_local: string | null
          destination: string | null
          po_id: string | null
          po_name: string | null
          po_ref: string | null
          received_items: number | null
          received_qty: number | null
          received_type: string | null
          row_no: number
          sku: string | null
          source_file: string
          transfer_name: string | null
          transfer_ref: string | null
          variant_title: string | null
        }
        Insert: {
          at_local?: string | null
          destination?: string | null
          po_id?: string | null
          po_name?: string | null
          po_ref?: string | null
          received_items?: number | null
          received_qty?: number | null
          received_type?: string | null
          row_no: number
          sku?: string | null
          source_file: string
          transfer_name?: string | null
          transfer_ref?: string | null
          variant_title?: string | null
        }
        Update: {
          at_local?: string | null
          destination?: string | null
          po_id?: string | null
          po_name?: string | null
          po_ref?: string | null
          received_items?: number | null
          received_qty?: number | null
          received_type?: string | null
          row_no?: number
          sku?: string | null
          source_file?: string
          transfer_name?: string | null
          transfer_ref?: string | null
          variant_title?: string | null
        }
        Relationships: []
      }
      shop_upload_log: {
        Row: {
          expected_rows: number | null
          loaded_rows: number | null
          source_file: string
          updated_at: string | null
        }
        Insert: {
          expected_rows?: number | null
          loaded_rows?: number | null
          source_file: string
          updated_at?: string | null
        }
        Update: {
          expected_rows?: number | null
          loaded_rows?: number | null
          source_file?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      shopify_customers: {
        Row: {
          amount_spent_jod: number
          created_at: string
          customer_created_at: string | null
          display_name: string | null
          email_consent: string | null
          first_order_channel: string | null
          first_order_date: string | null
          has_email: boolean
          has_phone: boolean
          id: string
          is_house_account: boolean
          last_order_date: string | null
          loyalty_enrolled: boolean | null
          loyalty_enrolled_at: string | null
          loyalty_points: number | null
          loyalty_tier: string | null
          orders_lifetime: number
          revenue_jod: number | null
          second_order_date: string | null
          shopify_customer_id: string
          sms_consent: string | null
          synced_at: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          amount_spent_jod?: number
          created_at?: string
          customer_created_at?: string | null
          display_name?: string | null
          email_consent?: string | null
          first_order_channel?: string | null
          first_order_date?: string | null
          has_email?: boolean
          has_phone?: boolean
          id?: string
          is_house_account?: boolean
          last_order_date?: string | null
          loyalty_enrolled?: boolean | null
          loyalty_enrolled_at?: string | null
          loyalty_points?: number | null
          loyalty_tier?: string | null
          orders_lifetime?: number
          revenue_jod?: number | null
          second_order_date?: string | null
          shopify_customer_id: string
          sms_consent?: string | null
          synced_at?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          amount_spent_jod?: number
          created_at?: string
          customer_created_at?: string | null
          display_name?: string | null
          email_consent?: string | null
          first_order_channel?: string | null
          first_order_date?: string | null
          has_email?: boolean
          has_phone?: boolean
          id?: string
          is_house_account?: boolean
          last_order_date?: string | null
          loyalty_enrolled?: boolean | null
          loyalty_enrolled_at?: string | null
          loyalty_points?: number | null
          loyalty_tier?: string | null
          orders_lifetime?: number
          revenue_jod?: number | null
          second_order_date?: string | null
          shopify_customer_id?: string
          sms_consent?: string | null
          synced_at?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      shopify_daily_sales: {
        Row: {
          channel: string
          created_at: string
          date: string
          id: string
          klaviyo_attributed_revenue_jod: number
          orders: number
          people_reached: number
          source_name: string
          sub_channel: string
          top_order_values: number[]
          total_online_revenue_jod: number
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          date: string
          id?: string
          klaviyo_attributed_revenue_jod?: number
          orders?: number
          people_reached?: number
          source_name: string
          sub_channel: string
          top_order_values?: number[]
          total_online_revenue_jod?: number
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          date?: string
          id?: string
          klaviyo_attributed_revenue_jod?: number
          orders?: number
          people_reached?: number
          source_name?: string
          sub_channel?: string
          top_order_values?: number[]
          total_online_revenue_jod?: number
          updated_at?: string
        }
        Relationships: []
      }
      shopify_margin_monthly: {
        Row: {
          created_at: string
          gross_profit_jod: number
          id: string
          month: string
          net_sales_jod: number
          source_channels: string[]
          sub_channel: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gross_profit_jod?: number
          id?: string
          month: string
          net_sales_jod?: number
          source_channels?: string[]
          sub_channel: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gross_profit_jod?: number
          id?: string
          month?: string
          net_sales_jod?: number
          source_channels?: string[]
          sub_channel?: string
          updated_at?: string
        }
        Relationships: []
      }
      shopify_orders: {
        Row: {
          cancelled_at: string | null
          order_id: string
          ordered_at: string
          ordered_on: string
          revenue_jod: number
          shopify_customer_id: string | null
          source_name: string | null
          sub_channel: string
          synced_at: string
        }
        Insert: {
          cancelled_at?: string | null
          order_id: string
          ordered_at: string
          ordered_on: string
          revenue_jod?: number
          shopify_customer_id?: string | null
          source_name?: string | null
          sub_channel: string
          synced_at?: string
        }
        Update: {
          cancelled_at?: string | null
          order_id?: string
          ordered_at?: string
          ordered_on?: string
          revenue_jod?: number
          shopify_customer_id?: string | null
          source_name?: string | null
          sub_channel?: string
          synced_at?: string
        }
        Relationships: []
      }
      sync_log: {
        Row: {
          created_at: string
          duration_ms: number | null
          id: string
          message: string | null
          range_end: string | null
          range_start: string | null
          rows_written: number
          source: string
          status: string
          synced_at: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          message?: string | null
          range_end?: string | null
          range_start?: string | null
          rows_written?: number
          source: string
          status?: string
          synced_at?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          message?: string | null
          range_end?: string | null
          range_start?: string | null
          rows_written?: number
          source?: string
          status?: string
          synced_at?: string
        }
        Relationships: []
      }
      till_code_guard: {
        Row: {
          action: string | null
          at: string | null
          code: string | null
          detail: Json | null
          done: boolean | null
          error: string | null
          id: number
          node_id: string | null
          pos_order: string | null
          used_at: string | null
        }
        Insert: {
          action?: string | null
          at?: string | null
          code?: string | null
          detail?: Json | null
          done?: boolean | null
          error?: string | null
          id?: number
          node_id?: string | null
          pos_order?: string | null
          used_at?: string | null
        }
        Update: {
          action?: string | null
          at?: string | null
          code?: string | null
          detail?: Json | null
          done?: boolean | null
          error?: string | null
          id?: number
          node_id?: string | null
          pos_order?: string | null
          used_at?: string | null
        }
        Relationships: []
      }
      tmp_b2b_open: {
        Row: {
          c: Json | null
        }
        Insert: {
          c?: Json | null
        }
        Update: {
          c?: Json | null
        }
        Relationships: []
      }
      tmp_btg: {
        Row: {
          active: boolean | null
          boms: number | null
          name: string | null
          pos: boolean | null
          sku: string | null
        }
        Insert: {
          active?: boolean | null
          boms?: number | null
          name?: string | null
          pos?: boolean | null
          sku?: string | null
        }
        Update: {
          active?: boolean | null
          boms?: number | null
          name?: string | null
          pos?: boolean | null
          sku?: string | null
        }
        Relationships: []
      }
      tmp_resolved_check: {
        Row: {
          c: Json | null
        }
        Insert: {
          c?: Json | null
        }
        Update: {
          c?: Json | null
        }
        Relationships: []
      }
      tmp_stuck_class: {
        Row: {
          counted_after: number | null
          kind: string | null
          kit_lines: number | null
          lines: number | null
          picking: string | null
          service_lines: number | null
          shopify_order: string | null
          shopify_status: string | null
          since: string | null
          so: string | null
          state: string | null
        }
        Insert: {
          counted_after?: number | null
          kind?: string | null
          kit_lines?: number | null
          lines?: number | null
          picking?: string | null
          service_lines?: number | null
          shopify_order?: string | null
          shopify_status?: string | null
          since?: string | null
          so?: string | null
          state?: string | null
        }
        Update: {
          counted_after?: number | null
          kind?: string | null
          kit_lines?: number | null
          lines?: number | null
          picking?: string | null
          service_lines?: number | null
          shopify_order?: string | null
          shopify_status?: string | null
          since?: string | null
          so?: string | null
          state?: string | null
        }
        Relationships: []
      }
      tmp_stuck_exclude: {
        Row: {
          checked_at: string | null
          reason: string | null
          shopify_order: string
        }
        Insert: {
          checked_at?: string | null
          reason?: string | null
          shopify_order: string
        }
        Update: {
          checked_at?: string | null
          reason?: string | null
          shopify_order?: string
        }
        Relationships: []
      }
      tmp_stuck_lines: {
        Row: {
          delivered: number | null
          product: string | null
          product_id: number | null
          qty: number | null
          so: string | null
        }
        Insert: {
          delivered?: number | null
          product?: string | null
          product_id?: number | null
          qty?: number | null
          so?: string | null
        }
        Update: {
          delivered?: number | null
          product?: string | null
          product_id?: number | null
          qty?: number | null
          so?: string | null
        }
        Relationships: []
      }
      wk_odoo_products: {
        Row: {
          active: boolean | null
          loaded_at: string | null
          name: string | null
          odoo_variant_id: number
          pos: boolean | null
          qty_fodc: number | null
          sale_ok: boolean | null
          sku: string | null
          type: string | null
        }
        Insert: {
          active?: boolean | null
          loaded_at?: string | null
          name?: string | null
          odoo_variant_id: number
          pos?: boolean | null
          qty_fodc?: number | null
          sale_ok?: boolean | null
          sku?: string | null
          type?: string | null
        }
        Update: {
          active?: boolean | null
          loaded_at?: string | null
          name?: string | null
          odoo_variant_id?: number
          pos?: boolean | null
          qty_fodc?: number | null
          sale_ok?: boolean | null
          sku?: string | null
          type?: string | null
        }
        Relationships: []
      }
      wk_product_map: {
        Row: {
          inventory_item_id: number | null
          loaded_at: string | null
          name: string | null
          odoo_product_id: number | null
          odoo_variant_id: number | null
          shopify_product_id: number | null
          shopify_variant_id: number
          sku: string | null
        }
        Insert: {
          inventory_item_id?: number | null
          loaded_at?: string | null
          name?: string | null
          odoo_product_id?: number | null
          odoo_variant_id?: number | null
          shopify_product_id?: number | null
          shopify_variant_id: number
          sku?: string | null
        }
        Update: {
          inventory_item_id?: number | null
          loaded_at?: string | null
          name?: string | null
          odoo_product_id?: number | null
          odoo_variant_id?: number | null
          shopify_product_id?: number | null
          shopify_variant_id?: number
          sku?: string | null
        }
        Relationships: []
      }
      wk_shop_variants: {
        Row: {
          inventory_item_id: number | null
          loaded_at: string | null
          product_id: number | null
          product_type: string | null
          sku: string | null
          status: string | null
          title: string | null
          tracked: boolean | null
          variant_id: number
        }
        Insert: {
          inventory_item_id?: number | null
          loaded_at?: string | null
          product_id?: number | null
          product_type?: string | null
          sku?: string | null
          status?: string | null
          title?: string | null
          tracked?: boolean | null
          variant_id: number
        }
        Update: {
          inventory_item_id?: number | null
          loaded_at?: string | null
          product_id?: number | null
          product_type?: string | null
          sku?: string | null
          status?: string | null
          title?: string | null
          tracked?: boolean | null
          variant_id?: number
        }
        Relationships: []
      }
    }
    Views: {
      cust_odoo_k: {
        Row: {
          active: boolean | null
          create_date: string | null
          customer_rank: number | null
          email: string | null
          email_k: string | null
          id: number | null
          is_company: boolean | null
          loaded_at: string | null
          loyalty_cards: number | null
          mobile: string | null
          name: string | null
          parent_id: number | null
          phone: string | null
          phone_k: string | null
          ref: string | null
          shopify_id: string | null
        }
        Insert: {
          active?: boolean | null
          create_date?: string | null
          customer_rank?: number | null
          email?: string | null
          email_k?: never
          id?: number | null
          is_company?: boolean | null
          loaded_at?: string | null
          loyalty_cards?: number | null
          mobile?: string | null
          name?: string | null
          parent_id?: number | null
          phone?: string | null
          phone_k?: never
          ref?: string | null
          shopify_id?: string | null
        }
        Update: {
          active?: boolean | null
          create_date?: string | null
          customer_rank?: number | null
          email?: string | null
          email_k?: never
          id?: number | null
          is_company?: boolean | null
          loaded_at?: string | null
          loyalty_cards?: number | null
          mobile?: string | null
          name?: string | null
          parent_id?: number | null
          phone?: string | null
          phone_k?: never
          ref?: string | null
          shopify_id?: string | null
        }
        Relationships: []
      }
      cust_shopify_k: {
        Row: {
          addr_phone: string | null
          created_at: string | null
          email: string | null
          email_k: string | null
          email_marketing: string | null
          first_name: string | null
          full_name: string | null
          id: string | null
          last_name: string | null
          loaded_at: string | null
          note: string | null
          num_id: string | null
          orders: number | null
          phone: string | null
          phone_k: string | null
          sms_marketing: string | null
          spent: number | null
          state: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          addr_phone?: string | null
          created_at?: string | null
          email?: string | null
          email_k?: never
          email_marketing?: string | null
          first_name?: string | null
          full_name?: never
          id?: string | null
          last_name?: string | null
          loaded_at?: string | null
          note?: string | null
          num_id?: never
          orders?: number | null
          phone?: string | null
          phone_k?: never
          sms_marketing?: string | null
          spent?: number | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          addr_phone?: string | null
          created_at?: string | null
          email?: string | null
          email_k?: never
          email_marketing?: string | null
          first_name?: string | null
          full_name?: never
          id?: string | null
          last_name?: string | null
          loaded_at?: string | null
          note?: string | null
          num_id?: never
          orders?: number | null
          phone?: string | null
          phone_k?: never
          sms_marketing?: string | null
          spent?: number | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      data_coverage: {
        Row: {
          covers_from: string | null
          covers_to: string | null
          kind: string | null
          rows: number | null
          source: string | null
        }
        Relationships: []
      }
      excluded_accounts: {
        Row: {
          category: string | null
          classified_by: string | null
          display_name: string | null
          shopify_customer_id: string | null
          tags: string[] | null
        }
        Insert: {
          category?: never
          classified_by?: never
          display_name?: string | null
          shopify_customer_id?: string | null
          tags?: string[] | null
        }
        Update: {
          category?: never
          classified_by?: never
          display_name?: string | null
          shopify_customer_id?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      inv_product_dates: {
        Row: {
          first_po_at: string | null
          first_received_at_local: string | null
          odoo_first_po: string | null
          odoo_first_po_at: string | null
          product_created_at: string | null
          product_title: string | null
          shopify_first_po: string | null
          shopify_first_po_at_local: string | null
          sku: string | null
          variant_created_at: string | null
        }
        Relationships: []
      }
      klaviyo_attributed_daily_net: {
        Row: {
          date: string | null
          orders: number | null
          revenue_jod: number | null
        }
        Relationships: []
      }
      klaviyo_order_influence_net: {
        Row: {
          created_at: string | null
          date: string | null
          hours_since_click: number | null
          id: string | null
          order_id: string | null
          ordered_at: string | null
          revenue_jod: number | null
          sub_channel: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      loyalty_redemption_monthly: {
        Row: {
          active_members: number | null
          month: string | null
          redeemers: number | null
          redeemers_in_base: number | null
        }
        Relationships: []
      }
      revenue_by_acquisition: {
        Row: {
          acquisition_channel: string | null
          is_first_order: boolean | null
          month: string | null
          order_channel: string | null
          orders: number | null
          revenue_jod: number | null
        }
        Relationships: []
      }
      shopify_daily_sales_net: {
        Row: {
          channel: string | null
          date: string | null
          orders: number | null
          source_name: string | null
          sub_channel: string | null
          top_order_values: number[] | null
          total_online_revenue_jod: number | null
        }
        Relationships: []
      }
      source_volume_check: {
        Row: {
          date: string | null
          is_anomaly: boolean | null
          pct_of_typical: number | null
          rows_today: number | null
          source: string | null
          typical_for_weekday: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _ss_cron: { Args: { p_job: string }; Returns: Json }
      _ss_days: { Args: { p_cron: Json; p_found: Json }; Returns: Json }
      _ss_every: { Args: { p_gap_min: number }; Returns: string }
      _ss_gap: { Args: { p_schedule: string }; Returns: string }
      _ss_lts: {
        Args: { p_from: number; p_to: number }
        Returns: {
          created_at: string
          product_name: string
          removed: boolean
          sku: string
          tag_name: string
        }[]
      }
      _ss_product_setup: { Args: never; Returns: Json }
      _ss_row: {
        Args: {
          p_cron: Json
          p_details: Json
          p_found_days: Json
          p_group: string
          p_key: string
          p_last_ok?: string
          p_last_run?: string
          p_sentence: string
          p_status: string
          p_title: string
        }
        Returns: Json
      }
      _ss_when: { Args: { p_ts: string }; Returns: string }
      app_has_module: { Args: { m: string }; Returns: boolean }
      app_is_owner: { Args: never; Returns: boolean }
      app_marketing_modules: { Args: never; Returns: string[] }
      app_my_access: { Args: never; Returns: Json }
      btg_claim_next: {
        Args: { gap_seconds: number; stuck_minutes: number }
        Returns: number
      }
      inv_can_view: { Args: never; Returns: boolean }
      inv_compare_trend: {
        Args: never
        Returns: {
          mismatched: number
          real_mismatched: number
          taken_at: string
        }[]
      }
      inv_delete_issues: {
        Args: { ids: string[]; reason?: string }
        Returns: number
      }
      inv_excluded_skus: { Args: never; Returns: string[] }
      inv_health_refresh: { Args: never; Returns: number }
      inv_hidden_skus: { Args: never; Returns: string[] }
      inv_is_admin: { Args: never; Returns: boolean }
      inv_issue_flags: {
        Args: never
        Returns: {
          flags: number
          id: string
        }[]
      }
      inv_issue_story: { Args: { p_id: string }; Returns: Json }
      inv_issue_values: {
        Args: never
        Returns: {
          id: string
          missing_value: number
        }[]
      }
      inv_missing_stock: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          counted_at: string
          employee: string
          id: string
          issue_ref: string
          missing: number
          product: string
          resolution_summary: string
          resolved_at: string
          sku: string
          status: string
          unit_cost: number
          value: number
        }[]
      }
      inv_purge_test_data: { Args: never; Returns: number }
      inv_recently_resolved: {
        Args: { p_test?: boolean }
        Returns: {
          by: string
          issue_ref: string
          product: string
          reported_at: string
          resolved_at: string
        }[]
      }
      inv_refresh_story: { Args: { p_id: string }; Returns: number }
      inv_set_resolution_note: {
        Args: { p_id: string; p_note: string }
        Returns: undefined
      }
      inv_shopify_skus: { Args: never; Returns: string[] }
      inventory_health: { Args: never; Returns: Json }
      is_dashboard_viewer: { Args: never; Returns: boolean }
      klaviyo_reach_counts: {
        Args: { p_from: string; p_to: string }
        Returns: {
          email_campaigns: number
          email_flows: number
          flows_all: number
          push_all: number
          total_sends: number
          total_unique: number
        }[]
      }
      order_watch_checked_at: { Args: never; Returns: string }
      phone_key: { Args: { p: string }; Returns: string }
      reach_coverage: {
        Args: never
        Returns: {
          covers_from: string
          covers_to: string
          rows: number
        }[]
      }
      system_status: {
        Args: never
        Returns: {
          days: Json
          details: Json
          grp: string
          key: string
          last_ok: string
          last_run: string
          sentence: string
          sort: number
          status: string
          title: string
        }[]
      }
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
    Enums: {},
  },
} as const
