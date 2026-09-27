CREATE TYPE "public"."access_status" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TYPE "public"."bid_status" AS ENUM('Submitted', 'Countered', 'Backup', 'Accepted', 'Rejected', 'Expired', 'Withdrawn');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('AED', 'USD');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('info_pack', 'transfer_agreement', 'register_extract', 'completion_certificate');--> statement-breakpoint
CREATE TYPE "public"."escrow_kind" AS ENUM('wire_sent', 'funded', 'released', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."holding_status" AS ENUM('Unverified', 'PendingCompany', 'Verified', 'Rejected');--> statement-breakpoint
CREATE TYPE "public"."incorporation" AS ENUM('ADGM', 'DIFC');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'done', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('Draft', 'InReview', 'Rejected', 'Live', 'Withdrawn', 'Closed', 'Negotiating', 'Allocated', 'Expired', 'Completed');--> statement-breakpoint
CREATE TYPE "public"."org_kind" AS ENUM('company', 'investor', 'operator');--> statement-breakpoint
CREATE TYPE "public"."persona" AS ENUM('buyer_a', 'buyer_b', 'seller', 'company_admin', 'operator');--> statement-breakpoint
CREATE TYPE "public"."rofr_mode" AS ENUM('waive', 'exercise');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('seller', 'buyer', 'company_admin', 'operator');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('AwaitingDocs', 'RofrPending', 'RofrExercised', 'AwaitingFunds', 'Funded', 'TransferPending', 'Settled', 'Cancelled', 'Disputed');--> statement-breakpoint
CREATE TABLE "access_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"status" "access_status" NOT NULL,
	"nda_version" text NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "access_grants_buyer_unique" UNIQUE("company_id","buyer_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"sandbox_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"actor_id" text NOT NULL,
	"actor_role" text NOT NULL,
	"simulated" boolean NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL,
	CONSTRAINT "audit_log_sandbox_id_seq_pk" PRIMARY KEY("sandbox_id","seq")
);
--> statement-breakpoint
CREATE TABLE "automation_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"kind" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event" text,
	"party_user_id" uuid NOT NULL,
	"status" "job_status" NOT NULL,
	"result_code" text,
	"created_at" timestamp with time zone NOT NULL,
	"executed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "beneficial_owners" (
	"sandbox_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	CONSTRAINT "beneficial_owners_user_id_org_id_pk" PRIMARY KEY("user_id","org_id")
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"buyer_org_id" uuid NOT NULL,
	"price_minor" bigint NOT NULL,
	"quantity" bigint NOT NULL,
	"min_fill" bigint NOT NULL,
	"rationale" text NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"amended_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"counter_price_minor" bigint,
	"counter_expires_at" timestamp with time zone,
	"counter_outcome" text,
	"allocated_qty" bigint,
	"rejection_reason" text,
	"idempotency_key" text NOT NULL,
	"status" "bid_status" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "bids_idempotency_unique" UNIQUE("buyer_id","idempotency_key"),
	CONSTRAINT "bids_values_check" CHECK ("bids"."price_minor">0 AND "bids"."quantity">0 AND "bids"."min_fill">0 AND "bids"."min_fill"<="bids"."quantity")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sector" text NOT NULL,
	"stage" text NOT NULL,
	"incorporation" "incorporation" NOT NULL,
	"currency" "currency" NOT NULL,
	"description" text NOT NULL,
	"last_round_name" text NOT NULL,
	"last_round_price_minor" bigint,
	"last_round_date" timestamp with time zone,
	"last_round_post_money_minor" bigint,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("sandbox_id","slug")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"company_id" uuid,
	"trade_id" uuid,
	"kind" "document_kind" NOT NULL,
	"title" text NOT NULL,
	"file_label" text NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escrow_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"trade_id" uuid NOT NULL,
	"kind" "escrow_kind" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" "currency" NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"share_class_id" uuid NOT NULL,
	"quantity" bigint NOT NULL,
	"reserved_qty" bigint NOT NULL,
	"sold_qty" bigint NOT NULL,
	"acquired_at" timestamp with time zone NOT NULL,
	"status" "holding_status" NOT NULL,
	"rejection_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "holdings_quantity_check" CHECK ("holdings"."quantity" > 0 AND "holdings"."reserved_qty" >= 0 AND "holdings"."sold_qty" >= 0 AND "holdings"."reserved_qty" + "holdings"."sold_qty" <= "holdings"."quantity")
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"holding_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"share_class_id" uuid NOT NULL,
	"currency" "currency" NOT NULL,
	"ref" text NOT NULL,
	"quantity" bigint NOT NULL,
	"min_fill" bigint NOT NULL,
	"reserve_price_minor" bigint NOT NULL,
	"window_days" integer NOT NULL,
	"window_opens_at" timestamp with time zone,
	"window_closes_at" timestamp with time zone,
	"counters_sent" integer NOT NULL,
	"status" "listing_status" NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "listings_ref_unique" UNIQUE("sandbox_id","ref"),
	CONSTRAINT "listings_values_check" CHECK ("listings"."quantity">0 AND "listings"."min_fill">0 AND "listings"."min_fill"<="listings"."quantity" AND "listings"."reserve_price_minor">0 AND "listings"."counters_sent" BETWEEN 0 AND 3 AND "listings"."window_days" IN (3,5,7))
);
--> statement-breakpoint
CREATE TABLE "mandates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sectors" text[] NOT NULL,
	"stages" text[] NOT NULL,
	"currency" "currency" NOT NULL,
	"min_ticket_minor" bigint NOT NULL,
	"max_ticket_minor" bigint NOT NULL,
	"max_price_minor" bigint,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_threads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"trade_id" uuid,
	"listing_id" uuid,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body_redacted" text NOT NULL,
	"flagged" boolean NOT NULL,
	"found" text[] NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"template" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"kind" "org_kind" NOT NULL,
	"name" text NOT NULL,
	"jurisdiction" text,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"question" text NOT NULL,
	"asked_by" uuid NOT NULL,
	"asked_at" timestamp with time zone NOT NULL,
	"answer" text,
	"answered_by" uuid,
	"answered_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"sandbox_id" uuid NOT NULL,
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "rate_limits_sandbox_id_key_window_start_pk" PRIMARY KEY("sandbox_id","key","window_start")
);
--> statement-breakpoint
CREATE TABLE "sandboxes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"clock_offset_ms" bigint DEFAULT 0 NOT NULL,
	"persona" "persona" DEFAULT 'buyer_a' NOT NULL,
	"autopilot" boolean DEFAULT true NOT NULL,
	"rofr_mode" "rofr_mode" DEFAULT 'waive' NOT NULL,
	"audit_head_seq" integer DEFAULT 0 NOT NULL,
	"audit_head_hash" text DEFAULT '0000000000000000000000000000000000000000000000000000000000000000' NOT NULL,
	"next_ref" integer DEFAULT 3000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_classes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"seniority" integer NOT NULL,
	"shares" bigint NOT NULL,
	"original_price_minor" bigint NOT NULL,
	"pref_multiple_bps" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "share_classes_seniority_unique" UNIQUE("company_id","seniority")
);
--> statement-breakpoint
CREATE TABLE "trade_prints" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"share_class_id" uuid NOT NULL,
	"price_minor" bigint NOT NULL,
	"quantity" bigint NOT NULL,
	"executed_at" timestamp with time zone NOT NULL,
	"related_party" boolean NOT NULL,
	"trade_id" uuid
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"holding_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"share_class_id" uuid NOT NULL,
	"currency" "currency" NOT NULL,
	"ref" text NOT NULL,
	"quantity" bigint NOT NULL,
	"price_minor" bigint NOT NULL,
	"seller_signed_at" timestamp with time zone,
	"buyer_signed_at" timestamp with time zone,
	"rofr_deadline" timestamp with time zone,
	"funding_deadline" timestamp with time zone,
	"wire_sent_at" timestamp with time zone,
	"funded_at" timestamp with time zone,
	"register_updated_at" timestamp with time zone,
	"release_approvals" uuid[] NOT NULL,
	"backup_bid_id" uuid,
	"escrow_ref" text NOT NULL,
	"dispute_reason" text,
	"disputed_from" text,
	"cancel_reason" text,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"status" "trade_status" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "trades_ref_unique" UNIQUE("sandbox_id","ref"),
	CONSTRAINT "trades_values_check" CHECK ("trades"."quantity">0 AND "trades"."price_minor">0)
);
--> statement-breakpoint
CREATE TABLE "transfer_policies" (
	"sandbox_id" uuid NOT NULL,
	"company_id" uuid PRIMARY KEY NOT NULL,
	"rofr_days" integer NOT NULL,
	"funding_days" integer NOT NULL,
	"min_lot" bigint NOT NULL,
	"lockup_months" integer NOT NULL,
	"blackout_windows" jsonb NOT NULL,
	"allowed_buyer_types" text[] NOT NULL,
	"blocked_org_ids" uuid[] NOT NULL,
	"price_visibility" text NOT NULL,
	"yearly_cap_bps" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"org_id" uuid,
	"role" "role" NOT NULL,
	"persona_key" "persona",
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"subtitle" text NOT NULL,
	"investor_type" text,
	"kyc_status" text NOT NULL,
	"professional_verified" boolean NOT NULL,
	"simulated_only" boolean NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "users_persona_unique" UNIQUE("sandbox_id","persona_key")
);
--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_jobs" ADD CONSTRAINT "automation_jobs_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_jobs" ADD CONSTRAINT "automation_jobs_party_user_id_users_id_fk" FOREIGN KEY ("party_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficial_owners" ADD CONSTRAINT "beneficial_owners_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficial_owners" ADD CONSTRAINT "beneficial_owners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficial_owners" ADD CONSTRAINT "beneficial_owners_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_buyer_org_id_organizations_id_fk" FOREIGN KEY ("buyer_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_events" ADD CONSTRAINT "escrow_events_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_events" ADD CONSTRAINT "escrow_events_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_share_class_id_share_classes_id_fk" FOREIGN KEY ("share_class_id") REFERENCES "public"."share_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holdings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_share_class_id_share_classes_id_fk" FOREIGN KEY ("share_class_id") REFERENCES "public"."share_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_entries" ADD CONSTRAINT "qa_entries_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_entries" ADD CONSTRAINT "qa_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_entries" ADD CONSTRAINT "qa_entries_asked_by_users_id_fk" FOREIGN KEY ("asked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_entries" ADD CONSTRAINT "qa_entries_answered_by_users_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_classes" ADD CONSTRAINT "share_classes_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_classes" ADD CONSTRAINT "share_classes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_prints" ADD CONSTRAINT "trade_prints_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_prints" ADD CONSTRAINT "trade_prints_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_prints" ADD CONSTRAINT "trade_prints_share_class_id_share_classes_id_fk" FOREIGN KEY ("share_class_id") REFERENCES "public"."share_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_prints" ADD CONSTRAINT "trade_prints_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holdings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_share_class_id_share_classes_id_fk" FOREIGN KEY ("share_class_id") REFERENCES "public"."share_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_backup_bid_id_bids_id_fk" FOREIGN KEY ("backup_bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_policies" ADD CONSTRAINT "transfer_policies_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_policies" ADD CONSTRAINT "transfer_policies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_grants_sandbox_idx" ON "access_grants" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "audit_log_sandbox_idx" ON "audit_log" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "automation_jobs_sandbox_idx" ON "automation_jobs" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "automation_jobs_due_idx" ON "automation_jobs" USING btree ("sandbox_id","status","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_jobs_pending_unique" ON "automation_jobs" USING btree ("entity_id","event","party_user_id") WHERE "automation_jobs"."status"='pending';--> statement-breakpoint
CREATE INDEX "beneficial_owners_sandbox_idx" ON "beneficial_owners" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "bids_sandbox_idx" ON "bids" USING btree ("sandbox_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bids_active_unique" ON "bids" USING btree ("listing_id","buyer_id") WHERE "bids"."status" IN ('Submitted','Countered','Backup');--> statement-breakpoint
CREATE INDEX "companies_sandbox_idx" ON "companies" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "documents_sandbox_idx" ON "documents" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "escrow_events_sandbox_idx" ON "escrow_events" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "holdings_sandbox_idx" ON "holdings" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "listings_sandbox_idx" ON "listings" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "mandates_sandbox_idx" ON "mandates" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "message_threads_sandbox_idx" ON "message_threads" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "messages_sandbox_idx" ON "messages" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "notifications_sandbox_idx" ON "notifications" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("recipient_id","read_at");--> statement-breakpoint
CREATE INDEX "organizations_sandbox_idx" ON "organizations" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "qa_entries_sandbox_idx" ON "qa_entries" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "rate_limits_sandbox_idx" ON "rate_limits" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "share_classes_sandbox_idx" ON "share_classes" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "trade_prints_sandbox_idx" ON "trade_prints" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "trades_sandbox_idx" ON "trades" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "transfer_policies_sandbox_idx" ON "transfer_policies" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "users_sandbox_idx" ON "users" USING btree ("sandbox_id");