DROP INDEX "industry_benchmarks_lookup_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "industry_benchmarks_industry_metric_uq" ON "industry_benchmarks" USING btree ("industry","metric_key");