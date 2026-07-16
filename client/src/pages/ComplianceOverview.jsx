import { useState } from "react";
import {
  ShieldCheck,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  User,
  Building,
  MoreVertical,
} from "lucide-react";
import { PortalMetricCard } from "../components/UI/PortalMetricCard";
import { Button } from "../components/UI/Button";
import { FilterRibbon } from "../components/UI/FilterRibbon";
import { RadialGauge } from "../components/UI/RadialGauge";
import { TableEmptyState } from "../components/UI/TableEmptyState";
import { StatusPill } from "../components/UI/StatusPill";
import { Skeleton } from "../components/UI/Skeleton";
import { useComplianceOverview } from "../hooks/useComplianceOverview";
import { useToast } from "../components/UI/ToastContext";

export const ComplianceOverview = () => {
  // All data + derivations (certificate lists, compliance stats, tenant
  // compliance rows) live in the hook; this component only renders.
  const {
    loading,
    error,
    stats,
    landlordChecklist,
    moveInCompliance,
    ongoingTenantCompliance,
    essentialCertificates,
    propertyManagement,
  } = useComplianceOverview();

  const { addToast } = useToast();
  const comingSoon = () => addToast("This feature is coming soon.", "info");

  // Filter states
  const [filterProperty, setFilterProperty] = useState("All Properties");
  const [filterStatus, setFilterStatus] = useState("All Statuses");

  const clearFilters = () => {
    setFilterProperty("All Properties");
    setFilterStatus("All Statuses");
  };

  // Options built from the real data. Status spans every list; property comes
  // from the certificate lists (the tenant lists aren't property-scoped).
  const allStatuses = [
    ...landlordChecklist,
    ...moveInCompliance,
    ...ongoingTenantCompliance,
    ...essentialCertificates,
    ...propertyManagement,
  ].map((r) => r.status);
  const statusOptions = [
    { value: "All Statuses", label: "All Statuses" },
    ...[...new Set(allStatuses.filter(Boolean))]
      .sort()
      .map((s) => ({ value: s, label: s })),
  ];
  const propertyOptions = [
    { value: "All Properties", label: "All Properties" },
    ...[
      ...new Set(
        [...essentialCertificates, ...propertyManagement]
          .map((r) => r.property)
          .filter((p) => p && p !== "—"),
      ),
    ]
      .sort()
      .map((p) => ({ value: p, label: p })),
  ];

  const byStatus = (row) =>
    filterStatus === "All Statuses" || row.status === filterStatus;
  const byProperty = (row) =>
    filterProperty === "All Properties" || row.property === filterProperty;

  // Status filter applies to every list; property filter only to the
  // certificate lists that carry a property.
  const filteredChecklist = landlordChecklist.filter(byStatus);
  const filteredMoveIn = moveInCompliance.filter(byStatus);
  const filteredOngoing = ongoingTenantCompliance.filter(byStatus);
  const filteredEssential = essentialCertificates.filter(
    (r) => byStatus(r) && byProperty(r),
  );
  const filteredPropertyManagement = propertyManagement.filter(
    (r) => byStatus(r) && byProperty(r),
  );

  const filtersConfig = [
    {
      label: "Filter by Property",
      value: filterProperty,
      onChange: setFilterProperty,
      options: propertyOptions,
      width: "w-44",
    },
    {
      label: "Filter by Status",
      value: filterStatus,
      onChange: setFilterStatus,
      options: statusOptions,
      width: "w-32",
    },
  ];

  const actionConfig = {
    label: "Review Compliance Checklist",
    icon: ChevronRight,
    iconPosition: "right",
    onClick: comingSoon,
  };

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8">
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} radius="card" className="h-20" />
          ))}
        </div>
        {/* Filter Bar Skeleton */}
        <Skeleton radius="bar" className="h-10" />
        {/* Main Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-[80px]" />
            <Skeleton className="h-[280px]" />
            <Skeleton className="h-[280px]" />
          </div>
          <div className="flex flex-col gap-6">
            <Skeleton className="h-[80px]" />
            <Skeleton className="h-[280px]" />
            <Skeleton className="h-[280px]" />
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
          label="Overall Compliance"
          value={loading ? "..." : `${stats.overall}%`}
          icon={ShieldCheck}
          variant="success"
          actionText="View Overview"
          onActionClick={clearFilters}
        />
        <PortalMetricCard
          label="Action Required"
          value={
            loading
              ? "..."
              : stats.actionRequired > 0
                ? `${stats.actionRequired} Items`
                : "0 Items"
          }
          icon={AlertCircle}
          variant={stats.actionRequired > 0 ? "danger" : "success"}
          actionText="View All"
          onActionClick={() => setFilterStatus("Expired")}
        />
        <PortalMetricCard
          label="Expiring Soon"
          value={loading ? "..." : `${stats.expiringSoon} Items`}
          subText="Within 90 Days"
          icon={Calendar}
          variant="warning"
          actionText="View Expiring"
          onActionClick={comingSoon}
        />
        <PortalMetricCard
          label="Up to Date"
          value={loading ? "..." : `${stats.upToDate} Items`}
          icon={CheckCircle2}
          variant="info"
          actionText="View All"
          onActionClick={() => setFilterStatus("Valid")}
        />
      </div>

      {/* Main Grid area */}
      <div className="flex flex-col gap-6">
        {/* Filters ribbon */}
        <FilterRibbon filters={filtersConfig} action={actionConfig} />

        {/* 2 Column Grid: Tenant Compliance vs Landlord Compliance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Tenant Compliance */}
          <div className="flex flex-col gap-6">
            {/* Header Panel */}
            <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3.5 min-w-0 text-left">
                <div className="w-10 h-10 rounded-full bg-status-success-bg text-status-success flex items-center justify-center shrink-0">
                  <User size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-sm-portal font-bold text-brand-primary leading-tight">
                    Tenant Compliance
                  </h3>
                  <span className="text-2xs text-gray-400 leading-none mt-1.5 font-semibold">
                    Move-in compliance and ongoing tenant/tenancy requirements.
                  </span>
                </div>
              </div>
              <RadialGauge
                percentage={stats.tenantCompliance}
                color="stroke-status-success"
              />
            </div>

            {/* Tables Checklist Card */}
            <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-6">
              {/* Move In Compliance Section */}
              <div>
                <h4 className="text-xs-portal font-extrabold text-brand-primary tracking-tight border-b border-card-border pb-2">
                  Move-In Compliance Check
                </h4>
                <div className="overflow-x-auto w-full mt-2 select-none">
                  <table className="w-full text-left border-collapse text-xs-portal">
                    <thead>
                      <tr className="text-2xs text-gray-400 font-bold uppercase tracking-wider border-b border-card-border">
                        <th className="py-2 px-1">Item</th>
                        <th className="py-2 px-1">Status</th>
                        <th className="py-2 px-1">Completed Date</th>
                        <th className="py-2 px-1 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredMoveIn.length === 0 ? (
                        <TableEmptyState
                          colSpan={4}
                          loading={loading}
                          loadingText="Loading..."
                          emptyText="No move-in compliance items match the filters."
                          className="py-6 text-center text-gray-400 font-bold"
                        />
                      ) : (
                        filteredMoveIn.map((row, idx) => (
                          <tr key={idx} className="hover:bg-surface-light/50">
                            <td className="py-2.5 px-1">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${row.color}`}
                                >
                                  <row.icon size={11} />
                                </div>
                                <div className="flex flex-col text-left">
                                  <span className="font-bold text-brand-primary leading-tight truncate max-w-[140px]">
                                    {row.item}
                                  </span>
                                  <span className="text-2xs text-gray-400 mt-0.5 leading-none truncate max-w-[140px]">
                                    {row.detail}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-1">
                              <StatusPill
                                status={row.status}
                                size="sm"
                                showIcon={false}
                              />
                            </td>
                            <td className="py-2.5 px-1 font-semibold text-brand-primary">
                              {row.completed}
                            </td>
                            <td className="py-2.5 px-1">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="secondary"
                                  className="!py-0.5 !px-2 text-2xs font-bold card-bg"
                                  onClick={comingSoon}
                                >
                                  {row.action}
                                </Button>
                                <Button
                                  variant="icon-only"
                                  size="sm"
                                  className="p-0.5 text-sidebar-text-muted hover:text-brand-primary cursor-pointer"
                                  onClick={comingSoon}
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
              </div>

              {/* Ongoing Tenancy Compliance Section */}
              <div>
                <h4 className="text-xs-portal font-extrabold text-brand-primary tracking-tight border-b border-card-border pb-2">
                  Ongoing Tenancy Requirements
                </h4>
                <div className="overflow-x-auto w-full mt-2 select-none">
                  <table className="w-full text-left border-collapse text-xs-portal">
                    <thead>
                      <tr className="text-2xs text-gray-400 font-bold uppercase tracking-wider border-b border-card-border">
                        <th className="py-2 px-1">Item</th>
                        <th className="py-2 px-1">Status</th>
                        <th className="py-2 px-1">Next Review</th>
                        <th className="py-2 px-1 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredOngoing.length === 0 ? (
                        <TableEmptyState
                          colSpan={4}
                          loading={loading}
                          loadingText="Loading..."
                          emptyText="No ongoing tenancy items match the filters."
                          className="py-6 text-center text-gray-400 font-bold"
                        />
                      ) : (
                        filteredOngoing.map((row, idx) => (
                          <tr key={idx} className="hover:bg-surface-light/50">
                            <td className="py-2.5 px-1">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${row.color}`}
                                >
                                  <row.icon size={11} />
                                </div>
                                <div className="flex flex-col text-left">
                                  <span className="font-bold text-brand-primary leading-tight truncate max-w-[140px]">
                                    {row.item}
                                  </span>
                                  <span className="text-2xs text-gray-400 mt-0.5 leading-none truncate max-w-[140px]">
                                    {row.detail}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-1">
                              <StatusPill
                                status={row.status}
                                size="sm"
                                showIcon={false}
                              />
                            </td>
                            <td className="py-2.5 px-1 font-semibold text-brand-primary">
                              {row.nextDue}
                            </td>
                            <td className="py-2.5 px-1">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="secondary"
                                  className="!py-0.5 !px-2 text-2xs font-bold card-bg"
                                  onClick={comingSoon}
                                >
                                  {row.action}
                                </Button>
                                <Button
                                  variant="icon-only"
                                  size="sm"
                                  className="p-0.5 text-sidebar-text-muted hover:text-brand-primary cursor-pointer"
                                  onClick={comingSoon}
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
              </div>
            </div>
          </div>

          {/* RIGHT: Landlord Compliance */}
          <div className="flex flex-col gap-6">
            {/* Header Panel */}
            <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3.5 min-w-0 text-left">
                <div className="w-10 h-10 rounded-full bg-status-success-bg text-status-success flex items-center justify-center shrink-0">
                  <Building size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-sm-portal font-bold text-brand-primary leading-tight">
                    Landlord Compliance
                  </h3>
                  <span className="text-2xs text-gray-400 leading-none mt-1.5 font-semibold">
                    Property ownership and management compliance.
                  </span>
                </div>
              </div>
              <RadialGauge
                percentage={stats.landlordCompliance}
                color="stroke-status-success"
              />
            </div>

            {/* Tables Certificates List */}
            <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-6">
              {/* Landlord Account Compliance Section */}
              <div>
                <h4 className="text-xs-portal font-extrabold text-brand-primary tracking-tight border-b border-card-border pb-2">
                  Landlord Account Compliance
                </h4>
                <div className="overflow-x-auto w-full mt-2 select-none">
                  <table className="w-full text-left border-collapse text-xs-portal">
                    <thead>
                      <tr className="text-2xs text-gray-400 font-bold uppercase tracking-wider border-b border-card-border">
                        <th className="py-2 px-1">Item</th>
                        <th className="py-2 px-1">Status</th>
                        <th className="py-2 px-1">Verified Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredChecklist.length === 0 ? (
                        <TableEmptyState
                          colSpan={3}
                          loading={loading}
                          loadingText="Loading..."
                          emptyText="No account compliance items match the filters."
                          className="py-6 text-center text-gray-400 font-bold"
                        />
                      ) : (
                        filteredChecklist.map((row, idx) => (
                          <tr key={idx} className="hover:bg-surface-light/50">
                            <td className="py-2.5 px-1">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${row.color}`}
                                >
                                  <row.icon size={11} />
                                </div>
                                <div className="flex flex-col text-left">
                                  <span className="font-bold text-brand-primary leading-tight truncate max-w-[180px]">
                                    {row.item}
                                  </span>
                                  <span className="text-2xs text-gray-400 mt-0.5 leading-none truncate max-w-[180px]">
                                    {row.detail}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-1">
                              <StatusPill
                                status={row.status}
                                size="sm"
                                showIcon={false}
                              />
                            </td>
                            <td className="py-2.5 px-1 font-semibold text-brand-primary">
                              {row.completed}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Essential Certificates Section */}
              <div>
                <h4 className="text-xs-portal font-extrabold text-brand-primary tracking-tight border-b border-card-border pb-2">
                  Essential Certificates & Compliance
                </h4>
                <div className="overflow-x-auto w-full mt-2 select-none">
                  <table className="w-full text-left border-collapse text-xs-portal">
                    <thead>
                      <tr className="text-2xs text-gray-400 font-bold uppercase tracking-wider border-b border-card-border">
                        <th className="py-2 px-1">Item</th>
                        <th className="py-2 px-1">Status</th>
                        <th className="py-2 px-1">Next Due</th>
                        <th className="py-2 px-1 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredEssential.length === 0 ? (
                        <TableEmptyState
                          colSpan={4}
                          loading={loading}
                          loadingText="Loading..."
                          emptyText="No certifications match the filters."
                          className="py-6 text-center text-gray-400 font-bold"
                        />
                      ) : (
                        filteredEssential.map((row, idx) => {
                          return (
                            <tr key={idx} className="hover:bg-surface-light/50">
                              <td className="py-2.5 px-1">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${row.color}`}
                                  >
                                    <row.icon size={11} />
                                  </div>
                                  <span className="font-bold text-brand-primary leading-tight truncate max-w-[150px] sm:max-w-xs">
                                    {row.item}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-1">
                                <StatusPill
                                  status={row.status}
                                  size="sm"
                                  showIcon={false}
                                />
                              </td>
                              <td className="py-2.5 px-1">
                                <div className="flex flex-col leading-tight">
                                  <span className="font-semibold text-brand-primary">
                                    {row.nextDue}
                                  </span>
                                  {row.subtext && (
                                    <span
                                      className={`text-2xs font-bold mt-0.5 leading-none ${row.subtextColor}`}
                                    >
                                      {row.subtext}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-1">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="secondary"
                                    className="!py-0.5 !px-2 text-2xs font-bold card-bg"
                                    onClick={comingSoon}
                                  >
                                    {row.action}
                                  </Button>
                                  <Button
                                    variant="icon-only"
                                    size="sm"
                                    className="p-0.5 text-sidebar-text-muted hover:text-brand-primary cursor-pointer"
                                    onClick={comingSoon}
                                  >
                                    <MoreVertical size={13} />
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
              </div>

              {/* Property & Management Compliance */}
              <div>
                <h4 className="text-xs-portal font-extrabold text-brand-primary tracking-tight border-b border-card-border pb-2">
                  Property & Management Compliance
                </h4>
                <div className="overflow-x-auto w-full mt-2 select-none">
                  <table className="w-full text-left border-collapse text-xs-portal">
                    <thead>
                      <tr className="text-2xs text-gray-400 font-bold uppercase tracking-wider border-b border-card-border">
                        <th className="py-2 px-1">Item</th>
                        <th className="py-2 px-1">Status</th>
                        <th className="py-2 px-1">Next Due</th>
                        <th className="py-2 px-1 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredPropertyManagement.length === 0 ? (
                        <TableEmptyState
                          colSpan={4}
                          loading={loading}
                          loadingText="Loading..."
                          emptyText="No management items match the filters."
                          className="py-6 text-center text-gray-400 font-bold"
                        />
                      ) : (
                        filteredPropertyManagement.map((row, idx) => {
                          return (
                            <tr key={idx} className="hover:bg-surface-light/50">
                              <td className="py-2.5 px-1">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${row.color}`}
                                  >
                                    <row.icon size={11} />
                                  </div>
                                  <span className="font-bold text-brand-primary leading-tight truncate max-w-[150px] sm:max-w-xs">
                                    {row.item}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-1">
                                <StatusPill
                                  status={row.status}
                                  size="sm"
                                  showIcon={false}
                                />
                              </td>
                              <td className="py-2.5 px-1">
                                <div className="flex flex-col leading-tight">
                                  <span className="font-semibold text-brand-primary">
                                    {row.nextDue}
                                  </span>
                                  {row.subtext && (
                                    <span
                                      className={`text-2xs font-bold mt-0.5 leading-none ${row.subtextColor}`}
                                    >
                                      {row.subtext}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-1">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="secondary"
                                    className="!py-0.5 !px-2 text-2xs font-bold card-bg"
                                    onClick={comingSoon}
                                  >
                                    {row.action}
                                  </Button>
                                  <Button
                                    variant="icon-only"
                                    size="sm"
                                    className="p-0.5 text-sidebar-text-muted hover:text-brand-primary cursor-pointer"
                                    onClick={comingSoon}
                                  >
                                    <MoreVertical size={13} />
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
