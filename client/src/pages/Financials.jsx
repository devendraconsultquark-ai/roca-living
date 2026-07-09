import React, { useState } from "react";
import { usePropertyContext } from "../context/PropertyContext";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  ArrowDown,
  ArrowUp,
  Calendar,
  Download,
  Filter,
  MoreVertical,
  Wrench,
  ChevronRight,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { PortalCard } from "../components/UI/PortalCard";
import { Button } from "../components/UI/Button";
import { Dropdown } from "../components/UI/Dropdown";
import { Tabs } from "../components/UI/Tabs";
import { useStatements } from "../hooks/useStatements";
import { useTransactions } from "../hooks/useTransactions";
import { TableEmptyState } from "../components/UI/TableEmptyState";
import { Pagination } from "../components/UI/Pagination";

export const Financials = () => {
  const { selectedProperty } = usePropertyContext();
  const navigate = useNavigate();
  const {
    statements,
    loading: statementsLoading,
    error: statementsError,
  } = useStatements();
  const { transactions: apiTransactions, loading: transactionsLoading } =
    useTransactions();
  const loading = statementsLoading || transactionsLoading;

  const [activeTab, setActiveTab] = useState("Overview");
  const [statementPeriod, setStatementPeriod] = useState("June 2026");
  const [currentPage, setCurrentPage] = useState(1);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedProperty, activeTab]);

  // local filter states for custom dropdowns
  const [summaryFilter, setSummaryFilter] = useState("This Month");
  const [chartFilter, setChartFilter] = useState("This Year");
  const [invoiceFilter, setInvoiceFilter] = useState("This Month");

  // Compute stats dynamically from statements
  const totalIncome = statements.reduce((sum, s) => sum + (s.invoiced || 0), 0);
  const totalExpenses = statements.reduce((sum, s) => sum + (s.fees || 0), 0);
  const netPaid = statements.reduce((sum, s) => sum + (s.payout || 0), 0);
  const ytdNet = statements.reduce((sum, s) => sum + (s.payout || 0), 0);

  const stats = {
    totalIncome,
    totalExpenses,
    netPaid,
    ytdNet,
    heldPayments: 0,
    unpaidInvoices: 0,
    pendingTrans: 0,
  };

  const tabs = [
    "Overview",
    "Transactions",
    "Statements",
    "Payouts",
    "Invoices",
  ];

  // Map real database transactions from hook
  const transactions =
    apiTransactions.length > 0
      ? apiTransactions.map((t) => {
          const isIncome = t.type === "rent_in";
          const isPayout = t.type === "landlord_payout";
          
          let category = "Other";
          if (isIncome) category = "Rental Income";
          else if (isPayout) category = "Payouts";
          else if (t.type === "deduction" || t.type === "mgmt_fee") category = "Management Fees";

          return {
            date: t.transaction_date
              ? new Date(t.transaction_date).toLocaleDateString("en-GB")
              : "—",
            desc: t.description || "Transaction",
            detail: t.statement_id ? `Statement STMT-${t.statement_id}` : "",
            category,
            type: isIncome ? "Income" : "Expense",
            amount: isIncome ? parseFloat(t.amount) : -parseFloat(t.amount),
            balance: 0.0, // Backend doesn't store running balance currently
            icon: isPayout ? CheckCircle2 : Wallet,
            color: isIncome || isPayout
              ? "text-status-success bg-status-success-bg"
              : "text-status-info bg-status-info-bg",
          };
        })
      : [];

  // Pagination logic
  const pageSize = 10;
  const totalPages = Math.ceil(transactions.length / pageSize);
  const paginatedTransactions = transactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 animate-pulse">
        {/* Tab placeholder */}
        <div className="h-8 bg-surface-hover rounded-lg w-1/3" />
        {/* First Row Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="h-[180px] bg-surface-hover/60 rounded-2xl" />
            <div className="h-[180px] bg-surface-hover/60 rounded-2xl" />
          </div>
          <div className="lg:col-span-5 h-[380px] bg-surface-hover/60 rounded-2xl" />
        </div>
        {/* Second Row Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-[300px] bg-surface-hover/60 rounded-2xl" />
          <div className="lg:col-span-4 h-[300px] bg-surface-hover/60 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 font-sans text-brand-primary">
      {statementsError && (
        <div className="border border-status-danger bg-status-danger/5 rounded-card p-4 text-center text-status-danger font-semibold">
          {statementsError}
        </div>
      )}

      {/* Subtabs Bar */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === "Overview" ? (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* First Row (2 Columns: Left Stats & Balance, Right Chart) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Side: Summary & Account Balance (7 Columns) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              {/* Financial Summary */}
              <PortalCard
                title="Financial Summary"
                headerActions={
                  <Dropdown
                    size="sm"
                    className="w-28"
                    value={summaryFilter}
                    onChange={setSummaryFilter}
                    options={[{ value: "This Month", label: "This Month" }]}
                  />
                }
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2 select-none text-left">
                  <div className="flex flex-col">
                    <span className="text-2xs text-gray-400 font-bold uppercase tracking-tight">
                      Total Income
                    </span>
                    <span className="text-sm-portal font-extrabold text-brand-primary mt-2 font-mono">
                      £
                      {loading
                        ? "..."
                        : stats.totalIncome.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                    </span>
                    <Button
                      variant="link"
                      className="text-2xs font-bold text-status-info hover:underline text-left mt-2.5"
                    >
                      View Breakdown
                    </Button>
                  </div>

                  <div className="flex flex-col border-l border-card-border pl-4">
                    <span className="text-2xs text-gray-400 font-bold uppercase tracking-tight">
                      Total Expenses
                    </span>
                    <span className="text-sm-portal font-extrabold text-brand-primary mt-2 font-mono">
                      £
                      {loading
                        ? "..."
                        : stats.totalExpenses.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                    </span>
                    <Button
                      variant="link"
                      className="text-2xs font-bold text-status-info hover:underline text-left mt-2.5"
                    >
                      View Breakdown
                    </Button>
                  </div>

                  <div className="flex flex-col border-l border-card-border pl-4">
                    <span className="text-2xs text-gray-400 font-bold uppercase tracking-tight">
                      Net Paid
                    </span>
                    <span className="text-sm-portal font-extrabold text-brand-primary mt-2 font-mono">
                      £
                      {loading
                        ? "..."
                        : stats.netPaid.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                    </span>
                  </div>

                  <div className="flex flex-col border-l border-card-border pl-4">
                    <span className="text-2xs text-gray-400 font-bold uppercase tracking-tight">
                      Year to Date Net
                    </span>
                    <span className="text-sm-portal font-extrabold text-brand-primary mt-2 font-mono">
                      £
                      {loading
                        ? "..."
                        : stats.ytdNet.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                    </span>
                    <Button
                      variant="link"
                      className="text-2xs font-bold text-status-info hover:underline text-left mt-2.5"
                    >
                      View Year to Date
                    </Button>
                  </div>
                </div>
              </PortalCard>

              {/* Account Balance */}
              <PortalCard title="Account Balance">
                <div className="flex flex-col sm:flex-row gap-6 mt-1 items-stretch justify-between text-left">
                  <div className="flex flex-col justify-between py-1 select-none">
                    <div>
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-tight">
                        Current Balance
                      </span>
                      <span className="text-base-portal font-extrabold text-brand-primary mt-2 block font-mono">
                        £
                        {loading
                          ? "..."
                          : stats.netPaid.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                      </span>
                    </div>
                    <span className="text-2xs text-status-success font-bold uppercase tracking-wider mt-2.5 block leading-none">
                      Available to Pay Out
                    </span>
                  </div>

                  <div className="flex flex-col gap-3 min-w-[200px] border-t sm:border-t-0 sm:border-l border-card-border pt-4 sm:pt-0 sm:pl-6 text-xs-portal font-bold text-status-muted justify-center">
                    <div className="flex justify-between items-center">
                      <span>Held Payments</span>
                      <span className="text-text-primary font-extrabold font-mono">
                        £0.00
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-card-border pt-2.5">
                      <span>Unpaid Invoices</span>
                      <span className="text-text-primary font-extrabold font-mono">
                        £0.00
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-card-border pt-2.5">
                      <span>Pending Payouts</span>
                      <span className="text-text-primary font-extrabold font-mono">
                        £0.00
                      </span>
                    </div>
                  </div>
                </div>
              </PortalCard>
            </div>

            {/* Right Side: Visual Graph (5 Columns) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <PortalCard
                title="Income vs Expenses"
                className="h-full"
                headerActions={
                  <Dropdown
                    size="sm"
                    className="w-28"
                    value={chartFilter}
                    onChange={setChartFilter}
                    options={[{ value: "This Year", label: "This Year" }]}
                  />
                }
              >
                {/* Legend */}
                <div className="flex gap-4 justify-end text-2xs font-semibold text-status-muted select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-status-info" />
                    <span>Income</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                    <span>Expenses</span>
                  </div>
                </div>

                {/* Chart body */}
                <div className="flex mt-auto items-stretch relative">
                  {/* Y-Axis Labels */}
                  <div className="flex flex-col justify-between text-2xs text-gray-400 font-bold h-36 pb-4 pr-2 select-none text-right w-10">
                    <span>£1,500</span>
                    <span>£1,000</span>
                    <span>£500</span>
                    <span>£0</span>
                  </div>

                  {/* Main Grid & Bars */}
                  <div className="flex-1 h-36 relative border-b border-card-border">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-[2px]">
                      <div className="w-full border-t border-card-border" />
                      <div className="w-full border-t border-card-border" />
                      <div className="w-full border-t border-card-border" />
                      <div className="w-full" />
                    </div>

                    {/* Bars flex row */}
                    <div className="absolute inset-x-0 -top-2 bottom-0 flex items-stretch justify-between px-2 z-10">
                      {[
                        { month: "Jan", income: 1045, expenses: 250 },
                        { month: "Feb", income: 1120, expenses: 200 },
                        { month: "Mar", income: 1120, expenses: 250 },
                        { month: "Apr", income: 1250, expenses: 200 },
                        { month: "May", income: 1200, expenses: 200 },
                        { month: "Jun", income: 1200, expenses: 150 },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col items-center flex-1 h-full justify-between group"
                        >
                          {/* Bars container */}
                          <div className="flex-1 w-full flex items-end justify-center gap-1.5 pb-1">
                            {/* Income Bar */}
                            <div
                              className="w-2.5 bg-status-info rounded-t-xs hover:opacity-95 transition-opacity"
                              style={{
                                height: `${(item.income / 1500) * 100}%`,
                              }}
                              title={`Income: £${item.income}`}
                            />
                            {/* Expenses Bar */}
                            <div
                              className="w-2.5 bg-gray-300 rounded-t-xs hover:opacity-95 transition-opacity"
                              style={{
                                height: `${(item.expenses / 1500) * 100}%`,
                              }}
                              title={`Expenses: £${item.expenses}`}
                            />
                          </div>
                          {/* X-Axis Label */}
                          <span className="text-2xs text-gray-400 font-bold mt-1 select-none leading-none">
                            {item.month}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </PortalCard>
            </div>
          </div>

          {/* Second Row: Recent Transactions Table & Downloader */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Side: Recent Transactions Table (8 Columns) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <PortalCard
                title="Recent Transactions"
                headerActions={
                  <div className="flex items-center gap-4 text-2xs font-extrabold text-brand-primary">
                    <Button
                      variant="icon-only"
                      size="sm"
                      className="flex items-center gap-1 cursor-pointer hover:underline"
                      p-1
                    >
                      <Filter size={11} /> Filters
                    </Button>
                    <Button
                      variant="icon-only"
                      size="sm"
                      className="flex items-center gap-1 cursor-pointer hover:underline"
                      p-1
                    >
                      <Download size={11} /> Download
                    </Button>
                  </div>
                }
              >
                {/* Table list */}
                <div className="overflow-x-auto w-full mt-1">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-card-border text-2xs text-gray-400 font-bold uppercase tracking-wider">
                        <th className="py-3 px-2">Date</th>
                        <th className="py-3 px-2">Description</th>
                        <th className="py-3 px-2">Category</th>
                        <th className="py-3 px-2">Type</th>
                        <th className="py-3 px-2">Amount</th>
                        <th className="py-3 px-2">Balance</th>
                        <th className="py-3 px-2 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs-portal">
                      {loading || transactions.length === 0 ? (
                        <TableEmptyState
                          colSpan={7}
                          loading={loading}
                          loadingText="Loading transactions..."
                          emptyText="No transactions recorded."
                        />
                      ) : (
                        paginatedTransactions.map((tr, index) => {
                          const isInc = tr.type === "Income";
                          return (
                            <tr
                              key={index}
                              className="hover:bg-surface-light/50 transition-colors"
                            >
                              <td className="py-3 px-2 font-medium text-gray-400">
                                {tr.date}
                              </td>

                              <td className="py-3 px-2">
                                <div className="flex items-center gap-2.5 select-none">
                                  <div
                                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${tr.color}`}
                                  >
                                    <tr.icon size={13} />
                                  </div>
                                  <div className="flex flex-col text-left">
                                    <span className="font-bold text-brand-primary leading-tight">
                                      {tr.desc}
                                    </span>
                                    <span className="text-2xs text-gray-400 mt-0.5 leading-none">
                                      {tr.detail}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-2 font-semibold text-status-muted">
                                {tr.category}
                              </td>

                              <td className="py-3 px-2">
                                <span
                                  className={`inline-flex items-center gap-0.5 font-bold uppercase text-2xs leading-none ${
                                    isInc
                                      ? "text-status-success"
                                      : "text-status-danger"
                                  }}`}
                                >
                                  {isInc ? (
                                    <ArrowDown
                                      size={10}
                                      className="stroke-[3px]"
                                    />
                                  ) : (
                                    <ArrowUp
                                      size={10}
                                      className="stroke-[3px]"
                                    />
                                  )}
                                  {tr.type}
                                </span>
                              </td>

                              <td
                                className={`py-3 px-2 font-extrabold font-mono ${isInc ? "text-status-success" : "text-status-danger"}`}
                              >
                                {isInc ? "£" : "-£"}
                                {Math.abs(tr.amount).toFixed(2)}
                              </td>

                              <td className="py-3 px-2 font-bold font-mono text-brand-primary">
                                £{tr.balance.toFixed(2)}
                              </td>

                              <td className="py-3 px-2 text-center text-sidebar-text-muted">
                                <Button
                                  variant="icon-only"
                                  size="sm"
                                  className="p-1 hover:text-brand-primary rounded cursor-pointer"
                                  p-1
                                >
                                  <MoreVertical size={14} />
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={transactions.length}
                  pageSize={pageSize}
                />
              </PortalCard>
            </div>

            {/* Right Side: Sidebar Download & Invoice Widgets (4 Columns) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Download Statement */}
              <PortalCard title="Download Statement">
                <span className="text-xs-portal text-gray-400 font-semibold leading-relaxed block text-left">
                  Download your financial statement for the selected period.
                </span>

                <div className="mt-4 flex flex-col gap-4 text-left">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                      Statement Period
                    </span>
                    <div className="flex items-center justify-between border border-card-border rounded-card p-3 text-xs-portal font-bold text-brand-primary select-none card-bg cursor-pointer hover:border-gray-300">
                      <span>{statementPeriod}</span>
                      <Calendar size={14} className="text-gray-400" />
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    icon={Download}
                    iconPosition="right"
                    className="w-full"
                  >
                    Download Statement
                  </Button>
                </div>
              </PortalCard>

              {/* Invoice Summary */}
              <PortalCard
                title="Invoice Summary"
                headerActions={
                  <Dropdown
                    size="sm"
                    className="w-28"
                    value={invoiceFilter}
                    onChange={setInvoiceFilter}
                    options={[{ value: "This Month", label: "This Month" }]}
                  />
                }
              >
                <div className="grid grid-cols-2 gap-y-4 gap-x-6 mt-1 pb-4 border-b border-card-border text-left select-none">
                  <div className="flex flex-col">
                    <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider">
                      Outstanding Invoices
                    </span>
                    <span className="text-sm-portal font-extrabold text-status-success font-mono mt-1 leading-none">
                      £0.00
                    </span>
                  </div>
                  <div className="flex flex-col border-l border-card-border pl-4">
                    <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider">
                      Overdue
                    </span>
                    <span className="text-sm-portal font-extrabold text-status-danger font-mono mt-1 leading-none">
                      £0.00
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider">
                      Paid Invoices
                    </span>
                    <span className="text-sm-portal font-extrabold text-status-success font-mono mt-1 leading-none">
                      £0.00
                    </span>
                  </div>
                  <div className="flex flex-col border-l border-card-border pl-4">
                    <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider">
                      Total Invoices
                    </span>
                    <span className="text-sm-portal font-bold text-gray-400 font-mono mt-1 leading-none">
                      0
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-1 flex justify-center">
                  <Button className="w-full flex items-center justify-between border border-card-border hover:border-gray-300 rounded-card py-2 px-4 text-xs-portal font-bold text-text-primary cursor-pointer card-bg">
                    <span>View Invoices</span>
                    <ChevronRight size={12} />
                  </Button>
                </div>
              </PortalCard>
            </div>
          </div>
        </div>
      ) : (
        <div className="card-bg border border-card-border rounded-card p-12 text-center text-gray-400 select-none">
          {activeTab} module will load here.
        </div>
      )}
    </div>
  );
};
