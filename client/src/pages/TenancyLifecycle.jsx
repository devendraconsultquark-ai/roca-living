import React from "react";
import { usePropertyContext } from "../context/PropertyContext";
import { useNavigate } from "react-router-dom";
import {
  Users,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Info,
  Calendar,
  Settings,
  MoreVertical,
  RefreshCw,
  LogOut,
  Home,
  FileText,
  Check,
} from "lucide-react";
import { useTenancy } from "../hooks/useTenancy";
import { PortalMetricCard } from "../components/UI/PortalMetricCard";
import { Button } from "../components/UI/Button";
import { DonutChart } from "../components/UI/DonutChart";
import { TableEmptyState } from "../components/UI/TableEmptyState";

export const TenancyLifecycle = () => {
  const { selectedProperty } = usePropertyContext();
  const navigate = useNavigate();
  const { tenancies, loading, error } = useTenancy();

  // Dynamic statistics calculations
  const totalCount = tenancies.length;

  // Active
  const activeCount = tenancies.filter((t) => t.status === "active").length;
  const activePct = totalCount
    ? Math.round((activeCount / totalCount) * 100)
    : 0;

  // Pending Move-ins (status is pending or start date is in the future)
  const pendingMoveInCount = tenancies.filter(
    (t) =>
      t.status === "pending" ||
      (t.start_date && new Date(t.start_date) > new Date()),
  ).length;
  const pendingMoveInPct = totalCount
    ? Math.round((pendingMoveInCount / totalCount) * 100)
    : 0;

  // Upcoming Renewals (end date approaching within next 90 days)
  const renewals = tenancies.filter((t) => {
    if (!t.end_date) return false;
    const diff = new Date(t.end_date) - new Date();
    return diff > 0 && diff <= 90 * 24 * 60 * 60 * 1000;
  });
  const renewalsCount = renewals.length;
  const renewalsPct = totalCount
    ? Math.round((renewalsCount / totalCount) * 100)
    : 0;

  // Move-outs (end date in current month or status is ended/closed)
  const moveOutsCount = tenancies.filter(
    (t) => t.status === "ended" || t.status === "closed",
  ).length;
  const moveOutsPct = totalCount
    ? Math.round((moveOutsCount / totalCount) * 100)
    : 0;

  // Map approaching renewals to table layout
  const formattedRenewals = renewals.map((t) => {
    const diff = new Date(t.end_date) - new Date();
    const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));

    return {
      tenancy: `TEN-${String(t.id).padStart(5, "0")}`,
      property: t.address_line1
        ? `${t.address_line1}, ${t.city}`
        : `Property #${t.property_id}`,
      tenant: t.lead_tenant_name || "—",
      date: t.end_date ? new Date(t.end_date).toLocaleDateString("en-GB") : "—",
      countdown: `In ${diffDays} Days`,
      statusColor:
        "text-status-warning bg-status-warning/10 border-status-warning/15",
    };
  });

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 animate-pulse">
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-surface-hover rounded-xl" />
          ))}
        </div>
        {/* Main Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="h-[250px] bg-surface-hover/60 rounded-2xl" />
            <div className="h-[350px] bg-surface-hover/60 rounded-2xl" />
          </div>
          <div className="lg:col-span-4 h-[450px] bg-surface-hover/60 rounded-2xl" />
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
          onActionClick={() => {}}
        />
        <PortalMetricCard
          label="Move Ins (This Month)"
          value={loading ? "..." : pendingMoveInCount}
          icon={ArrowUpRight}
          variant="success"
          actionText="View Move Ins"
          onActionClick={() => {}}
        />
        <PortalMetricCard
          label="Upcoming Renewals"
          value={loading ? "..." : renewalsCount}
          icon={RefreshCw}
          variant="warning"
          actionText="View Renewals"
          onActionClick={() => {}}
        />
        <PortalMetricCard
          label="Move Outs (This Month)"
          value={loading ? "..." : moveOutsCount}
          icon={LogOut}
          variant="danger"
          actionText="View Move Outs"
          onActionClick={() => {}}
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
          {/* Upcoming Renewals Table */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col justify-between overflow-hidden min-h-[300px]">
            <div className="flex justify-between items-center pb-3 border-b border-card-border select-none">
              <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider">
                Upcoming Renewals
              </h3>
              <Button
                variant="link"
                className="text-xs-portal font-bold text-status-info hover:underline cursor-pointer"
              >
                View All Renewals
              </Button>
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
                            >
                              Review Renewal
                            </Button>
                            <Button
                              variant="icon-only"
                              size="sm"
                              className="p-0.5 text-sidebar-text-muted hover:text-brand-primary cursor-pointer"
                            >
                              <MoreVertical size={13} />
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
                Showing 1 to {formattedRenewals.length} of {renewalsCount}{" "}
                renewals
              </span>
              <Button
                variant="link"
                className="text-xs-portal font-bold text-status-info hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                View All Renewals <ChevronRight size={12} />
              </Button>
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

            <Button
              variant="link"
              className="text-xs-portal font-bold text-status-info hover:underline text-left mt-2 flex items-center gap-0.5 cursor-pointer"
            >
              View Full Report <ChevronRight size={10} />
            </Button>
          </div>

          {/* Tasks & Actions */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-4">
            <div className="flex justify-between items-baseline border-b border-card-border pb-2">
              <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider">
                Tasks & Actions
              </h3>
              <Button
                variant="link"
                className="text-xs-portal font-bold text-status-info hover:underline cursor-pointer"
              >
                View All Tasks
              </Button>
            </div>

            <div className="flex flex-col gap-3 mt-1">
              <div className="text-xs-portal text-gray-400 font-semibold py-2">
                No pending tasks or actions
              </div>
            </div>
          </div>

          {/* Tenancy Lifecycle Settings */}
          <Button
            variant="secondary"
            size="sm"
            icon={Settings}
            iconPosition="left"
            className="w-full font-bold card-bg text-xs-portal h-9"
            onClick={() => {}}
          >
            Tenancy Lifecycle Settings
          </Button>
        </div>
      </div>
    </div>
  );
};
