import { useState, useRef } from "react";
import {
  Users,
  ArrowUpRight,
  Info,
  RefreshCw,
  LogOut,
  Home,
  FileText,
  Check,
  X,
} from "lucide-react";
import { useTenancyLifecycle } from "../hooks/useTenancyLifecycle";
import { PortalMetricCard } from "../components/UI/PortalMetricCard";
import { Button } from "../components/UI/Button";
import { DonutChart } from "../components/UI/DonutChart";
import { TableEmptyState } from "../components/UI/TableEmptyState";
import { Skeleton } from "../components/UI/Skeleton";

const TENANCY_STATUS_CHIPS = {
  active: "text-status-success bg-status-success-bg border-status-success/15",
  pending: "text-status-warning bg-status-warning/10 border-status-warning/15",
  notice: "text-status-info bg-status-info-bg border-status-info/15",
  ended: "text-status-muted bg-surface-light border-card-border",
};

// Display labels for the tenancies.status DB enum (matches the admin portal).
const TENANCY_STATUS_LABELS = {
  active: "Active",
  pending: "Pending",
  notice: "Notice Served",
  ended: "Ended",
};

export const TenancyLifecycle = () => {
  // All statistics and the upcoming-renewals table are derived in the hook;
  // this component only renders.
  const {
    loading,
    error,
    totalCount,
    activeCount,
    activePct,
    pendingMoveInCount,
    pendingMoveInPct,
    renewalsCount,
    renewalsPct,
    moveOutsCount,
    moveOutsPct,
    formattedRenewals,
    formattedTenancies,
    deposits,
  } = useTenancyLifecycle();

  // Metric cards filter the tenancies table below and scroll to it.
  const [lifecycleFilter, setLifecycleFilter] = useState("All");
  const [renewalDetail, setRenewalDetail] = useState(null);
  const tenanciesTableRef = useRef(null);

  const applyLifecycleFilter = (value) => {
    setLifecycleFilter(value);
    tenanciesTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const filteredTenancies = formattedTenancies.filter((t) => {
    switch (lifecycleFilter) {
      case "Active":
        return t.isActive;
      case "Move Ins":
        return t.isMoveIn;
      case "Renewals":
        return t.isRenewal;
      case "Move Outs":
        return t.isMoveOut;
      default:
        return true;
    }
  });

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8">
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} radius="card" className="h-20" />
          ))}
        </div>
        {/* Main Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <Skeleton className="h-[250px]" />
            <Skeleton className="h-[350px]" />
          </div>
          <Skeleton className="lg:col-span-4 h-[450px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 font-sans text-brand-primary font-medium">
      {error && (
        <div className="border border-status-danger bg-status-danger/5 rounded-card p-4 text-center text-status-danger font-semibold">
          {error}
        </div>
      )}

      {/* Metric Cards Grid (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 animate-fade-in">
        <PortalMetricCard
          label="Active Tenancies"
          value={loading ? "..." : activeCount}
          icon={Users}
          variant="info"
          actionText="View Tenancies"
          onActionClick={() => applyLifecycleFilter("Active")}
        />
        <PortalMetricCard
          label="Pending Move Ins"
          value={loading ? "..." : pendingMoveInCount}
          icon={ArrowUpRight}
          variant="success"
          actionText="View Move Ins"
          onActionClick={() => applyLifecycleFilter("Move Ins")}
        />
        <PortalMetricCard
          label="Upcoming Renewals"
          value={loading ? "..." : renewalsCount}
          icon={RefreshCw}
          variant="warning"
          actionText="View Renewals"
          onActionClick={() => applyLifecycleFilter("Renewals")}
        />
        <PortalMetricCard
          label="Move Outs"
          value={loading ? "..." : moveOutsCount}
          icon={LogOut}
          variant="danger"
          actionText="View Move Outs"
          onActionClick={() => applyLifecycleFilter("Move Outs")}
        />
      </div>

      {/* Full Width Timeline Card */}
      <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-5 select-none">
        <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider pb-3 border-b border-card-border/50">
          Tenancy Lifecycle Overview
        </h3>

        {/* Timeline Horizontal Layout */}
        <div className="flex flex-col md:flex-row items-stretch justify-between gap-6 py-4 relative">
          {/* Background Connecting Line (Desktop) */}
          <div className="absolute left-[8%] right-[8%] top-[34px] h-0.5 bg-surface-hover hidden md:block z-0" />

          {/* Step 1: Application */}
          <div className="flex flex-col items-center text-center flex-1 relative z-10">
            <div className="w-11 h-11 rounded-full bg-status-success-bg border-2 border-status-success text-status-success flex items-center justify-center relative">
              <FileText size={16} />
              <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-status-success text-white rounded-full flex items-center justify-center border border-white">
                <Check size={9} strokeWidth={4} />
              </div>
            </div>
            <span className="text-xs-portal font-black text-brand-primary mt-3">
              1. Application
            </span>
            <p className="text-2xs text-gray-400 font-semibold mt-1 max-w-[120px] leading-relaxed">
              Tenant applies and is screened.
            </p>
            <span className="text-2xs font-extrabold text-brand-primary mt-2 block bg-surface-light border border-card-border px-2 py-0.5 rounded-sm">
              {loading ? "..." : `${pendingMoveInCount} Applications`}
            </span>
          </div>

          {/* Step 2: Move In */}
          <div className="flex flex-col items-center text-center flex-1 relative z-10">
            <div className="w-11 h-11 rounded-full bg-status-success-bg border-2 border-status-success text-status-success flex items-center justify-center relative">
              <ArrowUpRight size={16} />
              <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-status-success text-white rounded-full flex items-center justify-center border border-white">
                <Check size={9} strokeWidth={4} />
              </div>
            </div>
            <span className="text-xs-portal font-black text-brand-primary mt-3">
              2. Move In
            </span>
            <p className="text-2xs text-gray-400 font-semibold mt-1 max-w-[120px] leading-relaxed">
              Tenancy agreement signed and tenant moves in.
            </p>
            <span className="text-2xs font-extrabold text-brand-primary mt-2 block bg-surface-light border border-card-border px-2 py-0.5 rounded-sm">
              {loading ? "..." : `${pendingMoveInCount} Move Ins`}
            </span>
          </div>

          {/* Step 3: Ongoing Tenancy */}
          <div className="flex flex-col items-center text-center flex-1 relative z-10">
            <div className="w-11 h-11 rounded-full bg-status-info-bg border-2 border-status-info text-status-info flex items-center justify-center">
              <Home size={16} />
            </div>
            <span className="text-xs-portal font-black text-status-info mt-3">
              3. Ongoing Tenancy
            </span>
            <p className="text-2xs text-gray-400 font-semibold mt-1 max-w-[120px] leading-relaxed">
              Tenancy is active and being managed.
            </p>
            <span className="text-2xs font-extrabold text-status-info mt-2 block bg-status-info-bg/40 border border-status-info/10 px-2 py-0.5 rounded-sm">
              {loading ? "..." : `${activeCount} Active Tenancies`}
            </span>
          </div>

          {/* Step 4: Renewal */}
          <div className="flex flex-col items-center text-center flex-1 relative z-10">
            <div className="w-11 h-11 rounded-full card-bg border border-card-border text-gray-400 flex items-center justify-center">
              <RefreshCw size={15} />
            </div>
            <span className="text-xs-portal font-black text-status-muted mt-3">
              4. Renewal
            </span>
            <p className="text-2xs text-gray-400 font-semibold mt-1 max-w-[120px] leading-relaxed">
              Tenancy renewal offered or agreement updated.
            </p>
            <span className="text-2xs font-extrabold text-status-muted mt-2 block bg-surface-light border border-card-border px-2 py-0.5 rounded-sm">
              {loading ? "..." : `${renewalsCount} Upcoming Renewals`}
            </span>
          </div>

          {/* Step 5: Move Out */}
          <div className="flex flex-col items-center text-center flex-1 relative z-10">
            <div className="w-11 h-11 rounded-full card-bg border border-card-border text-gray-400 flex items-center justify-center">
              <LogOut size={15} />
            </div>
            <span className="text-xs-portal font-black text-status-muted mt-3">
              5. Move Out
            </span>
            <p className="text-2xs text-gray-400 font-semibold mt-1 max-w-[120px] leading-relaxed">
              Tenant moves out and tenancy is closed.
            </p>
            <span className="text-2xs font-extrabold text-status-muted mt-2 block bg-surface-light border border-card-border px-2 py-0.5 rounded-sm">
              {loading ? "..." : `${moveOutsCount} Move Outs`}
            </span>
          </div>
        </div>
      </div>

      {/* Main split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column (9 Columns) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Tenancies Table — filtered by the metric cards above */}
          <div
            ref={tenanciesTableRef}
            className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col overflow-hidden scroll-mt-28"
          >
            <div className="flex justify-between items-center pb-3 border-b border-card-border select-none">
              <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider">
                {lifecycleFilter === "All"
                  ? "All Tenancies"
                  : `Tenancies — ${lifecycleFilter}`}
              </h3>
              {lifecycleFilter !== "All" && (
                <Button
                  variant="link"
                  className="text-xs-portal font-bold text-status-info hover:underline cursor-pointer"
                  onClick={() => setLifecycleFilter("All")}
                >
                  View All
                </Button>
              )}
            </div>

            <div className="overflow-x-auto w-full mt-3">
              <table className="w-full text-left border-collapse text-xs-portal">
                <thead>
                  <tr className="border-b border-card-border text-2xs text-gray-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-2">Tenancy</th>
                    <th className="py-3 px-2">Property</th>
                    <th className="py-3 px-2">Tenant</th>
                    <th className="py-3 px-2">Start Date</th>
                    <th className="py-3 px-2">End Date</th>
                    <th className="py-3 px-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading || filteredTenancies.length === 0 ? (
                    <TableEmptyState
                      colSpan={6}
                      loading={loading}
                      loadingText="Loading tenancies..."
                      emptyText={
                        formattedTenancies.length === 0
                          ? "No tenancies found."
                          : "No tenancies in this stage."
                      }
                    />
                  ) : (
                    filteredTenancies.map((row, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-surface-light/50 transition-colors"
                      >
                        <td className="py-3 px-2 font-bold text-brand-primary">
                          {row.ref}
                        </td>
                        <td className="py-3 px-2 text-status-muted font-semibold">
                          {row.property}
                        </td>
                        <td className="py-3 px-2 font-semibold text-status-muted">
                          {row.tenant}
                        </td>
                        <td className="py-3 px-2 font-semibold text-brand-primary">
                          {row.start}
                        </td>
                        <td className="py-3 px-2 font-semibold text-brand-primary">
                          {row.end}
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`px-2 py-0.5 text-2xs font-bold rounded-sm border select-none inline-block capitalize ${TENANCY_STATUS_CHIPS[row.status] || TENANCY_STATUS_CHIPS.ended}`}
                          >
                            {TENANCY_STATUS_LABELS[row.status] || row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upcoming Renewals Table */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col justify-between overflow-hidden min-h-[300px]">
            <div className="flex justify-between items-center pb-3 border-b border-card-border select-none">
              <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider">
                Upcoming Renewals
              </h3>
            </div>

            <div className="overflow-x-auto w-full mt-3">
              <table className="w-full text-left border-collapse text-xs-portal">
                <thead>
                  <tr className="border-b border-card-border text-2xs text-gray-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-2">Tenancy</th>
                    <th className="py-3 px-2">Property</th>
                    <th className="py-3 px-2">Tenant</th>
                    <th className="py-3 px-2">Renewal Date</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading || formattedRenewals.length === 0 ? (
                    <TableEmptyState
                      colSpan={6}
                      loading={loading}
                      loadingText="Loading renewals..."
                      emptyText="No upcoming tenancy renewals found."
                    />
                  ) : (
                    formattedRenewals.map((row, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-surface-light/50 transition-colors"
                      >
                        <td className="py-3 px-2 font-bold text-brand-primary">
                          {row.tenancy}
                        </td>
                        <td className="py-3 px-2 text-status-muted font-semibold">
                          {row.property}
                        </td>
                        <td className="py-3 px-2 font-semibold text-status-muted">
                          {row.tenant}
                        </td>
                        <td className="py-3 px-2 font-semibold text-brand-primary">
                          {row.date}
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`px-2 py-0.5 text-2xs font-bold rounded-sm border select-none inline-block ${row.statusColor}`}
                          >
                            {row.countdown}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="secondary"
                              className="!py-0.5 !px-2.5 text-2xs font-bold card-bg"
                              onClick={() => setRenewalDetail(row)}
                            >
                              Review Renewal
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="border-t border-card-border pt-4 mt-4 flex justify-between items-center select-none text-xs-portal text-gray-400 font-bold">
              <span>
                Showing {formattedRenewals.length} of {renewalsCount} renewals
              </span>
            </div>
          </div>

          {/* Bottom callout */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex gap-4 items-center text-left select-none">
            <div className="w-10 h-10 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
              <Info size={16} />
            </div>
            <div className="flex flex-col">
              <h4 className="text-xs-portal font-bold text-brand-primary uppercase tracking-wider leading-none">
                Streamline Your Tenancy Management
              </h4>
              <p className="text-2xs text-gray-400 font-semibold mt-2.5 leading-none">
                Track every stage of the tenancy lifecycle and stay on top of
                key dates and actions.
              </p>
            </div>
          </div>
        </div>

        {/* Right column (3 Columns) */}
        <div className="lg:col-span-4 flex flex-col gap-6 select-none">
          {/* Tenancy Lifecycle Summary Donut */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-4">
            <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider pb-2 border-b border-card-border">
              Tenancy Lifecycle Summary
            </h3>

            <div className="flex items-center gap-6 mt-2">
              <DonutChart
                segments={[
                  { value: activeCount, colorClass: "stroke-status-info" },
                  {
                    value: pendingMoveInCount,
                    colorClass: "stroke-status-success",
                  },
                  { value: renewalsCount, colorClass: "stroke-status-warning" },
                ]}
                total={totalCount}
              />
              <div className="flex flex-col gap-1.5 text-2xs font-bold text-status-muted">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-info shrink-0" />
                  <span>Active Tenancies</span>
                  <span className="text-brand-primary font-extrabold ml-1">
                    {activeCount} ({activePct}%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-success shrink-0" />
                  <span>Pending Move Ins</span>
                  <span className="text-brand-primary font-extrabold ml-1">
                    {pendingMoveInCount} ({pendingMoveInPct}%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-warning shrink-0" />
                  <span>Upcoming Renewals</span>
                  <span className="text-brand-primary font-extrabold ml-1">
                    {renewalsCount} ({renewalsPct}%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-danger shrink-0" />
                  <span>Pending Move Outs</span>
                  <span className="text-brand-primary font-extrabold ml-1">
                    {moveOutsCount} ({moveOutsPct}%)
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Deposit Protection */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-4">
            <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider pb-2 border-b border-card-border">
              Deposit Protection
            </h3>

            <div className="flex flex-col gap-3 mt-1">
              {deposits.length === 0 ? (
                <div className="text-xs-portal text-gray-400 font-semibold py-2">
                  No deposits held for your tenancies.
                </div>
              ) : (
                deposits.map((dep, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-1.5 border border-card-border rounded-card p-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs-portal font-bold text-brand-primary leading-tight">
                        {dep.property}
                      </span>
                      <span className="text-xs-portal font-extrabold font-mono text-brand-primary shrink-0">
                        £{dep.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-2xs text-gray-400 font-semibold leading-none">
                        {dep.scheme} • {dep.statusDate}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-2xs font-bold rounded-sm border select-none inline-block ${dep.statusColor}`}
                      >
                        {dep.statusLabel}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Renewal review modal */}
      {renewalDetail && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-bg rounded-card p-6 w-full max-w-lg shadow-premium border border-card-border max-h-[90vh] overflow-y-auto text-left">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-base-portal font-bold text-brand-primary">
                Tenancy Renewal
              </h3>
              <button
                onClick={() => setRenewalDetail(null)}
                className="text-gray-400 hover:text-brand-primary cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-2xs text-gray-400 font-semibold mb-4">
              {renewalDetail.tenancy} • {renewalDetail.property}
            </p>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs-portal mb-4">
              <div className="flex flex-col">
                <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider">
                  Tenant
                </span>
                <span className="font-bold text-brand-primary mt-1">
                  {renewalDetail.tenant}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider">
                  Monthly Rent
                </span>
                <span className="font-bold text-brand-primary mt-1 font-mono">
                  {renewalDetail.rent != null
                    ? `£${renewalDetail.rent.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : "—"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider">
                  Tenancy Started
                </span>
                <span className="font-bold text-brand-primary mt-1">
                  {renewalDetail.startDate}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider">
                  Current Term Ends
                </span>
                <span className="font-bold text-brand-primary mt-1">
                  {renewalDetail.date}{" "}
                  <span className="text-status-warning">({renewalDetail.countdown})</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider">
                  Deposit
                </span>
                <span className="font-bold text-brand-primary mt-1">
                  {renewalDetail.depositStatus}
                </span>
              </div>
            </div>

            <p className="text-2xs text-gray-400 font-semibold leading-relaxed mb-5">
              Renewals are arranged by your property manager. If you would like
              to renew, change the terms, or end this tenancy, contact your
              property manager before the current term ends.
            </p>

            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRenewalDetail(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
