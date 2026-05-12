CREATE TABLE "agent_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"agent" varchar(32) NOT NULL,
	"model" varchar(64),
	"confidence" double precision,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analysis_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"company_display_name" text NOT NULL,
	"stock_code" varchar(20),
	"industry" varchar(64),
	"status" varchar(24) DEFAULT 'queued' NOT NULL,
	"risk_score" double precision,
	"summary_json" jsonb,
	"report_blob_url" text,
	"heatmap_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anomaly_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"title" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_trail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"action" varchar(128) NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_code" varchar(20) NOT NULL,
	"display_name" text NOT NULL,
	"industry" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"run_id" uuid,
	"fiscal_year" integer,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"source" varchar(64) NOT NULL,
	"content" text NOT NULL,
	"embedding" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"fiscal_year" integer NOT NULL,
	"account_key" varchar(64) NOT NULL,
	"value" double precision NOT NULL,
	"unit" varchar(16) DEFAULT 'KRW',
	"source" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "industry_benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"industry" varchar(64) NOT NULL,
	"metric_key" varchar(64) NOT NULL,
	"mean_value" double precision NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratio_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"fiscal_year" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"kind" varchar(32) NOT NULL,
	"blob_url" text NOT NULL,
	"original_name" text NOT NULL,
	"checksum" varchar(128),
	"size_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_outputs" ADD CONSTRAINT "agent_outputs_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anomaly_findings" ADD CONSTRAINT "anomaly_findings_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_trail" ADD CONSTRAINT "audit_trail_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_memory" ADD CONSTRAINT "company_memory_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_memory" ADD CONSTRAINT "company_memory_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_facts" ADD CONSTRAINT "financial_facts_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratio_snapshots" ADD CONSTRAINT "ratio_snapshots_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_outputs_run_agent_idx" ON "agent_outputs" USING btree ("run_id","agent");--> statement-breakpoint
CREATE INDEX "analysis_runs_status_idx" ON "analysis_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "anomaly_findings_run_idx" ON "anomaly_findings" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "audit_trail_run_idx" ON "audit_trail" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "company_memory_company_idx" ON "company_memory" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "document_chunks_run_idx" ON "document_chunks" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "financial_facts_run_year_idx" ON "financial_facts" USING btree ("run_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "financial_facts_run_key_idx" ON "financial_facts" USING btree ("run_id","account_key");--> statement-breakpoint
CREATE INDEX "industry_benchmarks_lookup_idx" ON "industry_benchmarks" USING btree ("industry","metric_key");--> statement-breakpoint
CREATE INDEX "ratio_snapshots_run_idx" ON "ratio_snapshots" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "uploaded_files_run_idx" ON "uploaded_files" USING btree ("run_id");