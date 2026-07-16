import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  ArrowDown,
  Wallet,
  Calendar,
  ChevronRight,
  Info,
  MoreVertical,
} from "lucide-react";
import { PortalCard } from "../components/UI/PortalCard";
import { PortalMetricCard } from "../components/UI/PortalMetricCard";
import { Button } from "../components/UI/Button";
import { Dropdown } from "../components/UI/Dropdown";
import { DatePicker } from "../components/UI/DatePicker";
import { useStatements } from "../hooks/useStatements";
import { CirclePoundIcon } from "../components/UI/CirclePoundIcon";
import { Pagination } from "../components/UI/Pagination";
import { Skeleton } from "../components/UI/Skeleton";
import { TableEmptyState } from "../components/UI/TableEmptyState";
import { StatusPill } from "../components/UI/StatusPill";
import { useToast } from "../components/UI/ToastContext";
import { usePropertyContext } from "../context/PropertyContext";
import { filterByProperty } from "../utilities/propertyFilter";

export const Statements = () => {
  const navigate = useNavigate();
  const { statements, loading, error, handleDownloadPDF } = useStatements();

  const { addToast } = useToast();
  const comingSoon = () => addToast("This feature is coming soon.", "info");

  const { selectedProperty } = usePropertyContext();
  // Scope to the globally-selected property (no-op when "All Properties").
  const scopedStatements = filterByProperty(statements, selectedProperty);

  const [filterPeriod, setFilterPeriod] = useState("All Periods");
  const [fromDate, setFromDate] = useState("2025-01-01");
  const [toDate, setToDate] = useState("2026-06-14");

  const [appliedPeriod, setAppliedPeriod] = useState("All Periods");
  const [appliedFromDate, setAppliedFromDate] = useState("2025-01-01");
  const [appliedToDate, setAppliedToDate] = useState("2026-06-14");

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset to page 1 when the data or the applied filters change (render-time
  // pattern — avoids setState-in-effect).
  const [prevStmtReset, setPrevStmtReset] = useState({
    statements,
    selectedProperty,
    appliedPeriod,
    appliedFromDate,
    appliedToDate,
  });
  if (
    prevStmtReset.statements !== statements ||
    prevStmtReset.selectedProperty !== selectedProperty ||
    prevStmtReset.appliedPeriod !== appliedPeriod ||
    prevStmtReset.appliedFromDate !== appliedFromDate ||
    prevStmtReset.appliedToDate !== appliedToDate
  ) {
    setPrevStmtReset({
      statements,
      selectedProperty,
      appliedPeriod,
      appliedFromDate,
      appliedToDate,
    });
    setCurrentPage(1);
  }

  const handlePeriodChange = (val) => {
    setFilterPeriod(val);
    const today = new Date();
    const currentYear = today.getFullYear();
    if (val === "Current Year") {
      setFromDate(`${currentYear}-01-01`);
      setToDate(`${currentYear}-12-31`);
    } else if (val === "Last Year") {
      setFromDate(`${currentYear - 1}-01-01`);
      setToDate(`${currentYear - 1}-12-31`);
    }
  };

  const handleApplyFilters = () => {
    setAppliedPeriod(filterPeriod);
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    setCurrentPage(1);
  };

  // Filter statements dynamically based on applied dates
  const filteredStatements = scopedStatements.filter((s) => {
    if (appliedPeriod === "All Periods") {
      return true;
    }
    
    if (s.rawStartDate && s.rawEndDate) {
      const start = new Date(s.rawStartDate);
      const end = new Date(s.rawEndDate);
      const filterFrom = new Date(appliedFromDate);
      const filterTo = new Date(appliedToDate);

      // Filter: check if statement period overlaps or falls within range
      if (start < filterFrom || end > filterTo) {
        return false;
      }
    }
    return true;
  });

  const totalItems = filteredStatements.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedStatements = filteredStatements.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // Compute dynamic stats from filtered statements list
  const totalIncome = filteredStatements.reduce(
    (sum, s) => sum + (s.invoiced || 0),
    0,
  );
  const totalExpenses = filteredStatements.reduce(
    (sum, s) => sum + (s.fees || 0),
    0,
  );
  const netIncome = filteredStatements.reduce(
    (sum, s) => sum + (s.payout || 0),
    0,
  );
  const lastStatement = filteredStatements[0]?.period || "—";

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8">
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} radius="card" className="h-20" />
          ))}
        </div>
        {/* Main Layout Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-9 h-[400px]" />
          <div className="lg:col-span-3 flex flex-col gap-6">
            <Skeleton className="h-[200px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 font-sans text-brand-primary">
      {error && (
        <div className="border border-status-danger bg-status-danger/5 rounded-card p-4 text-center text-status-danger font-semibold">
          {error}
        </div>
      )}

      {/* Metric Cards Grid (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 animate-fade-in">
        <PortalMetricCard
          label="Total Income (This Year)"
          value={
            loading
              ? "..."
              : `£${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
          }
          icon={CirclePoundIcon}
          variant="success"
          actionText="View Breakdown"
          onActionClick={comingSoon}
        />
        <PortalMetricCard
          label="Total Expenses (This Year)"
          value={
            loading
              ? "..."
              : `£${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
          }
          icon={ArrowDown}
          variant="danger"
          actionText="View Breakdown"
          onActionClick={comingSoon}
        />
        <PortalMetricCard
          label="Net Income (This Year)"
          value={
            loading
              ? "..."
              : `£${netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
          }
          icon={Wallet}
          variant="info"
          actionText="View Breakdown"
          onActionClick={comingSoon}
        />
        <PortalMetricCard
          label="Last Statement"
          value={loading ? "..." : lastStatement}
          icon={Calendar}
          variant="warning"
          actionText="Download Statement"
          onActionClick={comingSoon}
        />
      </div>

      {/* Main Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
        {/* Left Side: Table & Filters (9 Columns) */}
        <div className="lg:col-span-9 flex flex-col gap-5">
          {/* Calendar Filter Ribbon */}
          <div className="card-bg border border-card-border rounded-card p-4 shadow-xs flex flex-wrap items-center justify-between gap-4 select-none">
            <div className="flex flex-wrap items-center gap-6 text-xs-portal font-bold text-brand-primary">
              <div className="flex items-center gap-2">
                <span className="text-xs-portal text-status-muted font-semibold">
                  Statement Period
                </span>
                <Dropdown
                  value={filterPeriod}
                  onChange={handlePeriodChange}
                  options={[
                    { value: "All Periods", label: "All Periods" },
                    { value: "Current Year", label: "Current Year" },
                    { value: "Last Year", label: "Last Year" },
                  ]}
                  size="sm"
                  className="min-w-[140px]"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs-portal text-status-muted font-semibold">
                  From
                </span>
                <DatePicker
                  value={fromDate}
                  onChange={setFromDate}
                  size="sm"
                  className="w-36"
                />
                <span className="text-gray-400 text-xs-portal font-semibold">
                  to
                </span>
                <DatePicker
                  value={toDate}
                  onChange={setToDate}
                  size="sm"
                  className="w-36"
                />
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              className="font-bold text-xs-portal h-8 px-5 rounded-md"
              onClick={handleApplyFilters}
            >
              Apply
            </Button>
          </div>

          {/* Table Container Card */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col justify-between overflow-hidden min-h-[300px]">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-card-border text-2xs text-gray-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-2">Statement Period</th>
                    <th className="py-3 px-2">Income</th>
                    <th className="py-3 px-2">Expenses</th>
                    <th className="py-3 px-2">Net Income</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2">Date Generated</th>
                    <th className="py-3 px-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs-portal">
                  {loading || statements.length === 0 ? (
                    <TableEmptyState
                      colSpan={7}
                      loading={loading}
                      loadingText="Loading rent statements..."
                      emptyText="No statements generated for this property yet."
                    />
                  ) : (
                    paginatedStatements.map((row, index) => {
                      return (
                        <tr
                          key={index}
                          className="hover:bg-surface-light/50 transition-colors"
                        >
                          <td className="py-3 px-2">
                            <div className="flex flex-col text-left">
                              <span className="font-bold text-brand-primary leading-tight">
                                {row.period}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2 font-bold font-mono text-brand-primary">
                            £
                            {row.invoiced.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-3 px-2 font-semibold font-mono text-status-muted">
                            £
                            {row.fees.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-3 px-2 font-extrabold font-mono text-status-success">
                            £
                            {row.payout.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-3 px-2">
                            <StatusPill
                              status={row.status}
                              size="sm"
                              showIcon={false}
                            />
                          </td>
                          <td className="py-3 px-2 font-medium text-gray-400">
                            {row.date}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!py-1 !px-2.5 text-2xs font-bold text-status-info hover:bg-status-info/5 border border-transparent hover:border-card-border flex items-center gap-1 cursor-pointer"
                                onClick={() =>
                                  handleDownloadPDF(row.id, row.period)
                                }
                              >
                                <span>Download</span>
                                <Download size={11} className="shrink-0" />
                              </Button>
                              <Button
                                variant="icon-only"
                                size="sm"
                                className="p-1 hover:text-brand-primary rounded cursor-pointer text-sidebar-text-muted"
                                onClick={comingSoon}
                              >
                                <MoreVertical size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>

        {/* Right Side: Sidebar Panels (3 Columns) */}
        <div className="lg:col-span-3 flex flex-col gap-6 select-none animate-fade-in">
          {/* Statement Summary */}
          <PortalCard title="Statement Summary" subtitle="(This Year)">
            <div className="flex flex-col gap-3.5 text-xs-portal font-bold text-status-muted text-left">
              <div className="flex justify-between items-center">
                <span>Total Income</span>
                <span className="text-brand-primary font-extrabold font-mono">
                  £
                  {loading
                    ? "..."
                    : totalIncome.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-card-border pt-3">
                <span>Total Expenses</span>
                <span className="text-brand-primary font-extrabold font-mono">
                  £
                  {loading
                    ? "..."
                    : totalExpenses.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-card-border pt-3 text-xs-portal text-brand-primary">
                <span>Net Income</span>
                <span className="text-status-success font-black font-mono">
                  £
                  {loading
                    ? "..."
                    : netIncome.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                </span>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={ChevronRight}
              iconPosition="right"
              className="w-full mt-4 font-bold card-bg text-xs-portal h-9 border border-card-border"
              onClick={() => navigate("/financials")}
            >
              View Financial Overview
            </Button>
          </PortalCard>

          {/* About Your Statements */}
          <PortalCard>
            <div className="flex gap-3 text-left">
              <div className="w-8 h-8 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
                <Info size={14} />
              </div>
              <div className="flex flex-col">
                <h4 className="text-sm-portal font-bold text-brand-primary capitalize tracking-wider leading-none">
                  About Your Statements
                </h4>
                <p className="text-2xs text-gray-400 font-semibold mt-3 leading-relaxed">
                  Statements are generated monthly, and include all income,
                  expenses, and payments for the selected period.
                </p>
                <p className="text-2xs text-gray-400 font-semibold mt-2.5 leading-relaxed">
                  If you have any questions about your statements, please
                  contact your property manager.
                </p>
              </div>
            </div>
          </PortalCard>

          {/* Download All Statements */}
          <PortalCard>
            <div className="flex flex-col gap-4 text-left">
              <div className="flex gap-3.5 items-start">
                <div className="w-8 h-8 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
                  <Download size={15} />
                </div>
                <div className="flex flex-col">
                  <h4 className="text-sm-portal font-bold text-brand-primary capitalize tracking-wider">
                    Download All Statements
                  </h4>
                  <p className="text-2xs text-gray-400 font-semibold mt-2.5 leading-normal">
                    Download all available statements as a single ZIP file.
                  </p>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                icon={Download}
                iconPosition="right"
                className="w-full font-bold card-bg text-xs-portal h-9 border border-card-border"
                onClick={() =>
                  addToast(
                    "Downloading all statements as a ZIP file...",
                    "success",
                  )
                }
              >
                Download All
              </Button>
            </div>
          </PortalCard>
        </div>
      </div>
    </div>
  );
};
