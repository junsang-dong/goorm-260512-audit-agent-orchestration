import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  stockCode: varchar("stock_code", { length: 20 }).notNull(),
  displayName: text("display_name").notNull(),
  industry: varchar("industry", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const analysisRuns = pgTable(
  "analysis_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    companyDisplayName: text("company_display_name").notNull(),
    stockCode: varchar("stock_code", { length: 20 }),
    industry: varchar("industry", { length: 64 }),
    status: varchar("status", { length: 24 }).notNull().default("queued"),
    riskScore: doublePrecision("risk_score"),
    summaryJson: jsonb("summary_json").$type<Record<string, unknown>>(),
    reportBlobUrl: text("report_blob_url"),
    heatmapJson: jsonb("heatmap_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("analysis_runs_status_idx").on(t.status)],
);

export const uploadedFiles = pgTable(
  "uploaded_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 32 }).notNull(),
    blobUrl: text("blob_url").notNull(),
    originalName: text("original_name").notNull(),
    checksum: varchar("checksum", { length: 128 }),
    sizeBytes: integer("size_bytes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("uploaded_files_run_idx").on(t.runId)],
);

export const financialFacts = pgTable(
  "financial_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    fiscalYear: integer("fiscal_year").notNull(),
    accountKey: varchar("account_key", { length: 64 }).notNull(),
    value: doublePrecision("value").notNull(),
    unit: varchar("unit", { length: 16 }).default("KRW"),
    source: varchar("source", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("financial_facts_run_year_idx").on(t.runId, t.fiscalYear),
    index("financial_facts_run_key_idx").on(t.runId, t.accountKey),
  ],
);

export const ratioSnapshots = pgTable(
  "ratio_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    fiscalYear: integer("fiscal_year").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("ratio_snapshots_run_idx").on(t.runId)],
);

export const anomalyFindings = pgTable(
  "anomaly_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    severity: varchar("severity", { length: 16 }).notNull(),
    title: text("title").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("anomaly_findings_run_idx").on(t.runId)],
);

export const agentOutputs = pgTable(
  "agent_outputs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    agent: varchar("agent", { length: 32 }).notNull(),
    model: varchar("model", { length: 64 }),
    confidence: doublePrecision("confidence"),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("agent_outputs_run_agent_idx").on(t.runId, t.agent)],
);

export const auditTrail = pgTable(
  "audit_trail",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 128 }).notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("audit_trail_run_idx").on(t.runId)],
);

export const industryBenchmarks = pgTable(
  "industry_benchmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    industry: varchar("industry", { length: 64 }).notNull(),
    metricKey: varchar("metric_key", { length: 64 }).notNull(),
    meanValue: doublePrecision("mean_value").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("industry_benchmarks_industry_metric_uq").on(
      t.industry,
      t.metricKey,
    ),
  ],
);

/** RAG: embedding stored as JSON array; Neon pgvector migration optional */
export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    source: varchar("source", { length: 64 }).notNull(),
    content: text("content").notNull(),
    embedding: jsonb("embedding").$type<number[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("document_chunks_run_idx").on(t.runId)],
);

export const companyMemory = pgTable(
  "company_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => analysisRuns.id, {
      onDelete: "set null",
    }),
    fiscalYear: integer("fiscal_year"),
    snapshot: jsonb("snapshot").notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("company_memory_company_idx").on(t.companyId)],
);

export const companiesRelations = relations(companies, ({ many }) => ({
  runs: many(analysisRuns),
  memory: many(companyMemory),
}));

export const analysisRunsRelations = relations(
  analysisRuns,
  ({ one, many }) => ({
    company: one(companies, {
      fields: [analysisRuns.companyId],
      references: [companies.id],
    }),
    files: many(uploadedFiles),
    facts: many(financialFacts),
    ratios: many(ratioSnapshots),
    anomalies: many(anomalyFindings),
    agents: many(agentOutputs),
    trails: many(auditTrail),
    chunks: many(documentChunks),
  }),
);
