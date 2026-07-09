import { useMemo, useState } from "react";
import { usePropertyContext } from "../context/PropertyContext";
import { useStatements } from "./useStatements";
import { useTransactions } from "./useTransactions";

/**
 * useFinancials — owns all Financials-page state, data and derivation so the
 * page component stays presentation-only.
 *
 * Responsibilities:
 *  - fetch statements + transactions (and expose combined loading/error)
 *  - compute the summary stats (memoised)
 *  - map raw API transactions into render-ready rows (memoised)
 *  - own tab + pagination state, and reset the page when the property/tab change
 *
 * It deliberately returns *semantic* fields (type / isPayout / amount …). The
 * icon and colour for each row are presentation and are derived in the page.
 */

const TABS = ["Overview", "Transactions", "Statements", "Payouts", "Invoices"];
const PAGE_SIZE = 10;

const CATEGORY_BY_TYPE = {
  rent_in: "Rental Income",
  landlord_payout: "Payouts",
  deduction: "Management Fees",
  mgmt_fee: "Management Fees",
};

const toTransactionRow = (t) => {
  const isIncome = t.type === "rent_in";
  const isPayout = t.type === "landlord_payout";
  return {
    date: t.transaction_date
      ? new Date(t.transaction_date).toLocaleDateString("en-GB")
      : "—",
    desc: t.description || "Transaction",
    detail: t.statement_id ? `Statement STMT-${t.statement_id}` : "",
    category: CATEGORY_BY_TYPE[t.type] || "Other",
    type: isIncome ? "Income" : "Expense",
    isPayout,
    amount: isIncome ? parseFloat(t.amount) : -parseFloat(t.amount),
    balance: 0.0, // Backend doesn't store a running balance yet.
  };
};

export const useFinancials = () => {
  const { selectedProperty } = usePropertyContext();
  const {
    statements,
    loading: statementsLoading,
    error,
  } = useStatements();
  const { transactions: apiTransactions, loading: transactionsLoading } =
    useTransactions();
  const loading = statementsLoading || transactionsLoading;

  const [activeTab, setActiveTab] = useState("Overview");
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to the first page when the property or tab changes. Done *during
  // render* by comparing against the previous values — React's recommended
  // alternative to a setState-in-useEffect for this kind of derived reset
  // (avoids the extra render pass; see react.dev "You Might Not Need an Effect").
  const [prevReset, setPrevReset] = useState({ selectedProperty, activeTab });
  if (
    prevReset.selectedProperty !== selectedProperty ||
    prevReset.activeTab !== activeTab
  ) {
    setPrevReset({ selectedProperty, activeTab });
    setCurrentPage(1);
  }

  const stats = useMemo(() => {
    const sum = (key) => statements.reduce((acc, s) => acc + (s[key] || 0), 0);
    const netPaid = sum("payout");
    return {
      totalIncome: sum("invoiced"),
      totalExpenses: sum("fees"),
      netPaid,
      ytdNet: netPaid,
      heldPayments: 0,
      unpaidInvoices: 0,
      pendingTrans: 0,
    };
  }, [statements]);

  const transactions = useMemo(
    () => apiTransactions.map(toTransactionRow),
    [apiTransactions],
  );

  const totalPages = Math.ceil(transactions.length / PAGE_SIZE);
  const paginatedTransactions = useMemo(
    () =>
      transactions.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [transactions, currentPage],
  );

  return {
    // data
    stats,
    transactions,
    paginatedTransactions,
    loading,
    error,
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
