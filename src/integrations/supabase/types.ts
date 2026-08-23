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
      ads: {
        Row: {
          active: boolean
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          link_url: string | null
          priority: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          priority?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          priority?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      anon_responses: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          survey_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          survey_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anon_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "anon_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      anon_surveys: {
        Row: {
          created_at: string
          id: string
          prompt: string | null
          slug: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          prompt?: string | null
          slug?: string
          title?: string
        }
        Update: {
          created_at?: string
          id?: string
          prompt?: string | null
          slug?: string
          title?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: number
          theme: Json
          updated_at: string
        }
        Insert: {
          id?: number
          theme?: Json
          updated_at?: string
        }
        Update: {
          id?: number
          theme?: Json
          updated_at?: string
        }
        Relationships: []
      }
      campaign_claims: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_claims_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "reward_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_groups: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_support: boolean
          last_message_at: string
          name: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_support?: boolean
          last_message_at?: string
          name: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_support?: boolean
          last_message_at?: string
          name?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          body: string | null
          contact: string | null
          created_at: string
          id: string
          image_url: string | null
          kind: string
          location: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          location?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          location?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_unlocks: {
        Row: {
          amount: number
          created_at: string
          id: string
          listing_id: string | null
          order_id: string | null
          seller_id: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          listing_id?: string | null
          order_id?: string | null
          seller_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          listing_id?: string | null
          order_id?: string | null
          seller_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_unlocks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_unlocks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      daily_bonus_claims: {
        Row: {
          claim_date: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          claim_date?: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          claim_date?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      dating_profiles: {
        Row: {
          age: number | null
          bio: string | null
          created_at: string
          display_name: string
          gender: string | null
          id: string
          interests: string | null
          is_active: boolean
          looking_for: string | null
          photo_url: string | null
          photos: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: number | null
          bio?: string | null
          created_at?: string
          display_name: string
          gender?: string | null
          id?: string
          interests?: string | null
          is_active?: boolean
          looking_for?: string | null
          photo_url?: string | null
          photos?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number | null
          bio?: string | null
          created_at?: string
          display_name?: string
          gender?: string | null
          id?: string
          interests?: string | null
          is_active?: boolean
          looking_for?: string | null
          photo_url?: string | null
          photos?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dating_reactions: {
        Row: {
          created_at: string
          id: string
          profile_user_id: string
          reaction: string
          reactor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_user_id: string
          reaction: string
          reactor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_user_id?: string
          reaction?: string
          reactor_id?: string
        }
        Relationships: []
      }
      group_messages: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          listing_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          listing_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          category: Database["public"]["Enums"]["listing_category"]
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          location: string | null
          photos: string[]
          price: number
          subcategory: string | null
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["listing_category"]
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          location?: string | null
          photos?: string[]
          price?: number
          subcategory?: string | null
          title: string
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["listing_category"]
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          location?: string | null
          photos?: string[]
          price?: number
          subcategory?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          amount_usd: number | null
          buyer_id: string
          checkout_request_id: string | null
          created_at: string
          id: string
          kind: string
          listing_id: string | null
          location: string | null
          merchant_request_id: string | null
          mpesa_receipt: string | null
          paypal_order_id: string | null
          pesapal_tracking_id: string | null
          phone: string | null
          pickup_station: string | null
          provider: string
          quantity: number
          raw_callback: Json | null
          result_code: number | null
          result_desc: string | null
          seller_id: string | null
          status: string
          delivery_method: string
          delivery_address: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          amount_usd?: number | null
          buyer_id: string
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          listing_id?: string | null
          location?: string | null
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          paypal_order_id?: string | null
          pesapal_tracking_id?: string | null
          phone?: string | null
          pickup_station?: string | null
          provider?: string
          quantity?: number
          raw_callback?: Json | null
          result_code?: number | null
          result_desc?: string | null
          seller_id?: string | null
          status?: string
          delivery_method?: string
          delivery_address?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_usd?: number | null
          buyer_id?: string
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          listing_id?: string | null
          location?: string | null
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          paypal_order_id?: string | null
          pesapal_tracking_id?: string | null
          phone?: string | null
          pickup_station?: string | null
          provider?: string
          quantity?: number
          raw_callback?: Json | null
          result_code?: number | null
          result_desc?: string | null
          seller_id?: string | null
          status?: string
          delivery_method?: string
          delivery_address?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_otps: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          phone: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at?: string
          id?: string
          phone: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          avatar_url: string | null
          contact_access: boolean
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
          username: string | null
          suspended: boolean
          updated_at: string
        }
        Insert: {
          approved?: boolean
          avatar_url?: string | null
          contact_access?: boolean
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          phone?: string | null
          username?: string | null
          suspended?: boolean
          updated_at?: string
        }
        Update: {
          approved?: boolean
          avatar_url?: string | null
          contact_access?: boolean
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          username?: string | null
          suspended?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          user_id: string
          email_enabled: boolean
          sms_enabled: boolean
          push_enabled: boolean
          order_updates: boolean
          delivery_alerts: boolean
          updated_at: string
        }
        Insert: {
          user_id: string
          email_enabled?: boolean
          sms_enabled?: boolean
          push_enabled?: boolean
          order_updates?: boolean
          delivery_alerts?: boolean
          updated_at?: string
        }
        Update: {
          email_enabled?: boolean
          sms_enabled?: boolean
          push_enabled?: boolean
          order_updates?: boolean
          delivery_alerts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          amount: number
          code: string
          created_at: string
          expires_at: string | null
          id: string
          max_uses: number
          used_count: number
        }
        Insert: {
          active?: boolean
          amount: number
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number
          used_count?: number
        }
        Update: {
          active?: boolean
          amount?: number
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number
          used_count?: number
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          code_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          code_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          reel_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          reel_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "reel_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reel_comments_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_likes: {
        Row: {
          created_at: string
          reel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reel_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_likes_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_saves: {
        Row: {
          created_at: string
          reel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reel_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_saves_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reels: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string
          id: string
          source_type: string
          thumbnail_url: string | null
          video_url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by: string
          id?: string
          source_type?: string
          thumbnail_url?: string | null
          video_url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string
          id?: string
          source_type?: string
          thumbnail_url?: string | null
          video_url?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referee_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          referee_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          referee_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          listing_id: string | null
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          rating?: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_campaigns: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          title: string
        }
        Insert: {
          active?: boolean
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          title: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          title?: string
        }
        Relationships: []
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
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          is_cash: boolean
          ref_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          id?: string
          is_cash?: boolean
          ref_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          is_cash?: boolean
          ref_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          cash_balance: number
          created_at: string
          frozen: boolean
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          cash_balance?: number
          created_at?: string
          frozen?: boolean
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          cash_balance?: number
          created_at?: string
          frozen?: boolean
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_cash_adjust: {
        Args: { _amount: number; _note?: string; _uid: string }
        Returns: number
      }
      admin_freeze_wallet: {
        Args: { _frozen: boolean; _uid: string }
        Returns: undefined
      }
      admin_approve_cash_withdrawal: {
        Args: { _note?: string; _request_id: string }
        Returns: undefined
      }
      admin_list_cash_withdrawals: {
        Args: never
        Returns: {
          amount: number
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          note: string | null
          phone: string
          status: string
          user_id: string
        }[]
      }
      admin_reject_cash_withdrawal: {
        Args: { _note?: string; _request_id: string }
        Returns: undefined
      }
      admin_wallet_adjust: {
        Args: { _amount: number; _note?: string; _uid: string }
        Returns: number
      }
      advance_music: { Args: never; Returns: undefined }
      apply_referral: { Args: { _referrer: string }; Returns: number }
      claim_campaign: { Args: { _cid: string }; Returns: number }
      claim_daily_bonus: { Args: never; Returns: number }
      ensure_wallet: { Args: { _uid: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_suspended: { Args: { _user_id: string }; Returns: boolean }
      redeem_promo: { Args: { _code: string }; Returns: number }
      tier_for: { Args: { _bal: number }; Returns: string }
      wallet_cash_credit: {
        Args: {
          _amount: number
          _desc?: string
          _ref?: string
          _type: string
          _uid: string
        }
        Returns: number
      }
      wallet_cash_debit: {
        Args: {
          _amount: number
          _desc?: string
          _ref?: string
          _type: string
          _uid: string
        }
        Returns: number
      }
      wallet_cash_transfer: {
        Args: { _amount: number; _note?: string; _to: string }
        Returns: number
      }
      wallet_credit: {
        Args: {
          _amount: number
          _desc?: string
          _ref?: string
          _type: string
          _uid: string
        }
        Returns: number
      }
      wallet_debit: {
        Args: {
          _amount: number
          _desc?: string
          _ref?: string
          _type: string
          _uid: string
        }
        Returns: number
      }
      wallet_transfer: {
        Args: { _amount: number; _note?: string; _to: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user"
      listing_category: "marketplace" | "housing"
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
      app_role: ["admin", "user"],
      listing_category: ["marketplace", "housing"],
    },
  },
} as const
