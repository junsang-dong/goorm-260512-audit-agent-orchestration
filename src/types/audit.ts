export type UploadFileKind =
  | "business_report_pdf"
  | "fs_xlsx"
  | "dart_csv"
  | "ir_pdf";

export type RunStatus = "queued" | "running" | "done" | "failed";

/** Normalized account keys for ratio / scoring engines */
export type FinancialAccountKey =
  | "revenue"
  | "cogs"
  | "gross_profit"
  | "operating_income"
  | "ebit"
  | "net_income"
  | "accounts_receivable"
  | "inventory"
  | "current_assets"
  | "current_liabilities"
  | "total_assets"
  | "total_liabilities"
  | "total_equity"
  | "ppe"
  | "retained_earnings"
  | "operating_cash_flow"
  | "investing_cash_flow"
  | "capex"
  | "depreciation"
  | "sales_gna_expense"
  | "long_term_debt"
  | "market_cap";

export type FactsByYear = Record<number, Partial<Record<FinancialAccountKey, number>>>;

export interface RatioYearResult {
  fiscalYear: number;
  revenueYoY?: number;
  grossMargin?: number;
  operatingMargin?: number;
  netMargin?: number;
  dsoDays?: number;
  inventoryTurnover?: number;
  debtRatio?: number;
  cfoToNetIncome?: number;
  fcf?: number;
  arYoY?: number;
  inventoryYoY?: number;
}

export interface HeatmapRow {
  label: string;
  level: "LOW" | "MEDIUM" | "HIGH";
  score: number;
}
