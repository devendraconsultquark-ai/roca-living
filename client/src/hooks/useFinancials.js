import { useMemo, useState } from "react";
import { usePropertyContext } from "../context/PropertyContext";
import { filterByProperty } from "../utilities/propertyFilter";
import { downloadBlob } from "../utilities/download";
import { useStatements } from "./useStatements";
import { useTransactions } from "./useTransactions";
import { useInvoices } from "./useInvoices";

/**
 * useFinancials — owns all Financials-page state, data and derivation so the
 * page component stays presentation-only.
 *
 * Responsibilities:
 *  - fetch statements + transactions + invoices (and expose combined loading/error)
 *  - compute the summary stats, invoice stats and monthly chart data (memoised)
 *  - map raw API transactions into render-ready rows with a running balance
 *  - own tab + pagination state, and reset the page when the property/tab change
 *
 * It deliberately returns *semantic* fields (type / isPayout / amount …). The
 * icon and colour for each row are presentation and are derived in the page.
 */

// Only tabs with real content — Transactions live on Overview and Statements
// have their own page in the nav.
const TABS = ["Overview", "Invoices"];
const PAGE_SIZE = 10;

const CATEGORY_BY_TYPE = {
  rent_in: "Rental Income",
  landlord_payout: "Payouts",
  deduction: "Management Fees",
  mgmt_fee: "Management Fees",
  contractor_cost: "Maintenance",
};

const toTransactionRow = (t) => {
  const isIncome = t.type === "rent_in";
  const isPayout = t.type === "landlord_payout";
  return {
    property_id: t.property_id,
    date: t.transaction_date
      ? new Date(t.transaction_date).toLocaleDateString("en-GB")
      : "—",
    desc: t.description || "Transaction",
    detail: t.statement_id ? `Statement STMT-${t.statement_id}` : "",
    category: CATEGORY_BY_TYPE[t.type] || "Other",
    type: isIncome ? "Income" : "Expense",
    isPayout,
    amount: isIncome ? parseFloat(t.amount) : -parseFloat(t.amount),
    balance: 0.0, // Filled in below with a running total (oldest → newest).
  };
};

export const useFinancials = () => {
  const { selectedProperty } = usePropertyContext();
  const {
    statements,
    loading: statementsLoading,
    error,
    handleDownloadPDF: handleDownloadStatementPDF,
  } = useStatements();
  const { transactions: apiTransactions, loading: transactionsLoading } =
    useTransactions();
  const { invoices: apiInvoices, loading: invoicesLoading, handleDownloadPDF } =
    useInvoices();
  const loading = statementsLoading || transactionsLoading || invoicesLoading;

  const [activeTab, setActiveTab] = useState("Overview");
  const [currentPage, setCurrentPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("All");

  // Reset to the first page when the property, tab or filter changes. Done
  // *during render* by comparing against the previous values — React's
  // recommended alternative to a setState-in-useEffect for this kind of derived
  // reset (avoids the extra render pass; see react.dev "You Might Not Need an Effect").
  const [prevReset, setPrevReset] = useState({ selectedProperty, activeTab, typeFilter });
  if (
    prevReset.selectedProperty !== selectedProperty ||
    prevReset.activeTab !== activeTab ||
    prevReset.typeFilter !== typeFilter
  ) {
    setPrevReset({ selectedProperty, activeTab, typeFilter });
    setCurrentPage(1);
  }

  // Scope to the globally-selected property. No-op when "All Properties" — or
  // when the API hasn't started returning property_id on these records yet.
  const scopedStatements = useMemo(
    () => filterByProperty(statements, selectedProperty),
    [statements, selectedProperty],
  );
  const scopedTransactions = useMemo(
    () => filterByProperty(apiTransactions, selectedProperty),
    [apiTransactions, selectedProperty],
  );
  const scopedInvoices = useMemo(
    () => filterByProperty(apiInvoices, selectedProperty),
    [apiInvoices, selectedProperty],
  );

  const invoiceStats = useMemo(() => {
    const sumWhere = (pred) =>
      scopedInvoices
        .filter(pred)
        .reduce((acc, inv) => acc + parseFloat(inv.total_net || 0), 0);
    return {
      outstanding: sumWhere((inv) => inv.status === "draft" || inv.status === "sent"),
      paid: sumWhere((inv) => inv.status === "paid"),
      voided: sumWhere((inv) => inv.status === "voided"),
      count: scopedInvoices.length,
    };
  }, [scopedInvoices]);

  const stats = useMemo(() => {
    const sum = (key) =>
      scopedStatements.reduce((acc, s) => acc + (s[key] || 0), 0);
    const netPaid = sum("payout");
    // Real year-to-date: only statements whose period starts in the current
    // year (netPaid above is all-time — the two are different figures).
    const currentYear = new Date().getFullYear();
    const ytdNet = scopedStatements
      .filter((s) => s.rawStartDate && new Date(s.rawStartDate).getFullYear() === currentYear)
      .reduce((acc, s) => acc + (s.payout || 0), 0);
    const pendingPayouts = scopedStatements
      .filter((s) => s.status !== "Paid")
      .reduce((acc, s) => acc + (s.payout || 0), 0);
    return {
      totalIncome: sum("invoiced"),
      totalExpenses: sum("fees"),
      netPaid,
      ytdNet,
      pendingPayouts,
      unpaidInvoices: invoiceStats.outstanding,
    };
  }, [scopedStatements, invoiceStats]);

  const transactions = useMemo(() => {
    const rows = scopedTransactions.map(toTransactionRow);
    // Running balance, accumulated oldest → newest (the API returns rows
    // newest-first). Income adds, payouts/deductions subtract.
    let running = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      running += rows[i].amount;
      rows[i] = { ...rows[i], balance: running };
    }
    return rows;
  }, [scopedTransactions]);

  // Income vs expenses per month for the last six months — replaces the old
  // hardcoded demo bars. Payouts are transfers, not expenses, so they're
  // excluded from the expense bar.
  const chartData = useMemo(() => {
    const now = new Date();
    const months = [];
    const byKey = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const entry = {
        month: d.toLocaleDateString("en-GB", { month: "short" }),
        income: 0,
        expenses: 0,
      };
      months.push(entry);
      byKey[`${d.getFullYear()}-${d.getMonth()}`] = entry;
    }
    scopedTransactions.forEach((t) => {
      if (!t.transaction_date) return;
      const d = new Date(t.transaction_date);
      const entry = byKey[`${d.getFullYear()}-${d.getMonth()}`];
      if (!entry) return;
      const amount = parseFloat(t.amount || 0);
      if (t.type === "rent_in") entry.income += amount;
      else if (t.type !== "landlord_payout") entry.expenses += amount;
    });
    return months;
  }, [scopedTransactions]);

  const chartMax = useMemo(() => {
    const peak = Math.max(
      ...chartData.map((m) => Math.max(m.income, m.expenses)),
      0,
    );
    // Round the axis up to a clean £500 step so the labels stay readable.
    return Math.max(500, Math.ceil(peak / 500) * 500);
  }, [chartData]);

  // Render-ready invoice rows for the Invoices tab.
  const invoiceRows = useMemo(
    () =>
      scopedInvoices.map((inv) => {
        const periodStart = inv.period_start
          ? new Date(inv.period_start).toLocaleDateString("en-GB")
          : "";
        const periodEnd = inv.period_end
          ? new Date(inv.period_end).toLocaleDateString("en-GB")
          : "";
        return {
          id: inv.id,
          number: inv.invoice_number || `INV-${inv.id}`,
          property: inv.property_address || inv.property_name || "—",
          period: periodStart || periodEnd ? `${periodStart} - ${periodEnd}` : "—",
          date: inv.created_at
            ? new Date(inv.created_at).toLocaleDateString("en-GB")
            : "—",
          net: parseFloat(inv.total_net || 0),
          status: inv.status
            ? inv.status.charAt(0).toUpperCase() + inv.status.slice(1)
            : "Draft",
          raw: inv,
        };
      }),
    [scopedInvoices],
  );

  // The header type filter (All / Income / Expense) narrows the table rows.
  const filteredTransactions = useMemo(
    () =>
      typeFilter === "All"
        ? transactions
        : transactions.filter((r) => r.type === typeFilter),
    [transactions, typeFilter],
  );

  // Client-side CSV export of the (filtered) transaction rows.
  const exportTransactionsCsv = () => {
    const escapeCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Date", "Description", "Detail", "Category", "Type", "Amount", "Balance"];
    const lines = [header.join(",")].concat(
      filteredTransactions.map((r) =>
        [r.date, r.desc, r.detail, r.category, r.type, r.amount.toFixed(2), r.balance.toFixed(2)]
          .map(escapeCell)
          .join(","),
      ),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, "ROCA_Transactions.csv");
  };

  const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE);
  const paginatedTransactions = useMemo(
    () =>
      filteredTransactions.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [filteredTransactions, currentPage],
  );

  return {
    // data
    stats,
    invoiceStats,
    invoiceRows,
    handleDownloadInvoicePDF: handleDownloadPDF,
    statements: scopedStatements,
    handleDownloadStatementPDF,
    transactions,
    filteredTransactions,
    paginatedTransactions,
    exportTransactionsCsv,
    chartData,
    chartMax,
    loading,
    error,
    // filters
    typeFilter,
    setTypeFilter,
    // tabs
    tabs: TABS,
    activeTab,
    setActiveTab,
    // pagination
    currentPage,
    setCurrentPage,
    totalPages,
    pageSize: PAGE_SIZE,
  };
};
