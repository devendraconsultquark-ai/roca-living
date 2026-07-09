import React, { useState, useEffect } from "react";
import { usePropertyContext } from "../context/PropertyContext";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Plus,
  ChevronRight,
  Info,
  MoreVertical,
} from "lucide-react";
import { useInspections } from "../hooks/useInspections";
import { PortalMetricCard } from "../components/UI/PortalMetricCard";
import { Button } from "../components/UI/Button";
import { FilterRibbon } from "../components/UI/FilterRibbon";
import { Pagination } from "../components/UI/Pagination";
import { TableEmptyState } from "../components/UI/TableEmptyState";
import { StatusPill } from "../components/UI/StatusPill";

export const Inspections = () => {
  const { selectedProperty } = usePropertyContext();
  const navigate = useNavigate();
  const { inspections, loading, error } = useInspections();

  // Filter states
  const [filterProperty, setFilterProperty] = useState("All Properties");
  const [filterType, setFilterType] = useState("All Types");
  const [filterStatus, setFilterStatus] = useState("All Statuses");
  const [filterDue, setFilterDue] = useState("All Time");

  // Compute stats dynamically from real inspections data
  const totalCount = inspections.length;

  // A completed inspection is one where inspected_at or rating has been input
  const completedCount = inspections.filter(
    (i) => i.date && i.date !== "—",
  ).length;
  const completedPct = totalCount
    ? Math.round((completedCount / totalCount) * 100)
    : 0;

  // Scheduled inspections have a next_due in the future and aren't completed
  const scheduledCount = inspections.filter((i) => {
    if (!i.next_inspection_due) return false;
    const isFuture = new Date(i.next_inspection_due) >= new Date();
    // If not completed yet or has an upcoming target
    return isFuture;
  }).length;
  const scheduledPct = totalCount
    ? Math.round((scheduledCount / totalCount) * 100)
    : 0;

  // Overdue inspections have a next_due in the past
  const overdueCount = inspections.filter((i) => {
    if (!i.next_inspection_due) return false;
    const isPast = new Date(i.next_inspection_due) < new Date();
    return isPast;
  }).length;
  const overduePct = totalCount
    ? Math.round((overdueCount / totalCount) * 100)
    : 0;

  // Helper calculations for dynamic text
  const getCountdown = (nextDueStr) => {
    if (!nextDueStr) return null;
    const target = new Date(nextDueStr);
    const today = new Date();
    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Overdue by ${Math.abs(diffDays)} days`, isOverdue: true };
    } else if (diffDays === 0) {
      return { text: "Due today", isOverdue: false };
    } else if (diffDays === 1) {
      return { text: "In 1 day", isOverdue: false };
    } else {
      return { text: `In ${diffDays} days`, isOverdue: false };
    }
  };

  // Convert raw hook list to table presentation array
  const formattedInspections = inspections.map((i, idx) => {
    const countdownInfo = getCountdown(i.next_inspection_due);
    const hasBeenCompleted = i.date && i.date !== "—";
    const isOverdue = countdownInfo?.isOverdue;

    let statusLabel = "Completed";
    if (!hasBeenCompleted) {
      statusLabel = isOverdue ? "Overdue" : "Scheduled";
    }

    return {
      id: i.id,
      ref: `Ref: INSP-${String(i.id).padStart(5, "0")}`,
      item: `${i.rating !== "—" ? i.rating : "Property"} Inspection`,
      property: i.property || "—",
      type: i.rating !== "—" ? `${i.rating} Review` : "Routine",
      inspector: i.inspector || "—",
      date: hasBeenCompleted
        ? i.date
        : i.next_inspection_due
          ? new Date(i.next_inspection_due).toLocaleDateString("en-GB")
          : "—",
      countdown: hasBeenCompleted ? "" : countdownInfo?.text || "",
      countdownColor: isOverdue
        ? "text-status-danger font-bold"
        : "text-status-muted",
      status: statusLabel,
      action: hasBeenCompleted ? "View Report" : "View Details",
      color: hasBeenCompleted
        ? "bg-status-success-bg text-status-success"
        : isOverdue
          ? "bg-status-danger-bg text-status-danger"
          : "bg-status-info-bg text-status-info",
      icon: hasBeenCompleted ? ShieldCheck : isOverdue ? AlertCircle : Calendar,
    };
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [inspections]);

  const totalItems = formattedInspections.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedInspections = formattedInspections.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // Sidebar collections
  const upcomingList = formattedInspections.filter(
    (i) => i.status === "Scheduled",
  );
  const overdueList = formattedInspections.filter(
    (i) => i.status === "Overdue",
  );

  const filtersConfig = [
    {
      label: "Filter by Property",
      value: filterProperty,
      onChange: setFilterProperty,
      options: [{ value: "All Properties", label: "All Properties" }],
      width: "w-44",
    },
    {
      label: "Filter by Inspection Type",
      value: filterType,
      onChange: setFilterType,
      options: [
        { value: "All Types", label: "All Types" },
        { value: "Routine", label: "Routine" },
      ],
      width: "w-32",
    },
    {
      label: "Filter by Status",
      value: filterStatus,
      onChange: setFilterStatus,
      options: [
        { value: "All Statuses", label: "All Statuses" },
        { value: "Scheduled", label: "Scheduled" },
        { value: "Completed", label: "Completed" },
        { value: "Overdue", label: "Overdue" },
      ],
      width: "w-32",
    },
    {
      label: "Due Within",
      value: filterDue,
      onChange: setFilterDue,
      options: [{ value: "All Time", label: "All Time" }],
      width: "w-32",
    },
  ];

  const actionConfig = {
    label: "Schedule Inspection",
    icon: Plus,
    onClick: () => {},
  };

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 animate-pulse">
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-surface-hover rounded-xl" />
          ))}
        </div>
        {/* Main Layout Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-9 h-[400px] bg-surface-hover/60 rounded-2xl" />
          <div className="lg:col-span-3 flex flex-col gap-6">
            <div className="h-[200px] bg-surface-hover/60 rounded-2xl" />
            <div className="h-[150px] bg-surface-hover/60 rounded-2xl" />
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
          label="Total Inspections"
          value={loading ? "..." : totalCount}
          icon={ClipboardList}
          variant="info"
          actionText="View All"
          onActionClick={() => {}}
        />
        <PortalMetricCard
          label="Completed"
          value={loading ? "..." : `${completedCount} (${completedPct}%)`}
          icon={ShieldCheck}
          variant="success"
          actionText="View Completed"
          onActionClick={() => {}}
        />
        <PortalMetricCard
          label="Scheduled"
          value={loading ? "..." : `${scheduledCount} (${scheduledPct}%)`}
          icon={Calendar}
          variant="warning"
          actionText="View Scheduled"
          onActionClick={() => {}}
        />
        <PortalMetricCard
          label="Overdue"
          value={loading ? "..." : `${overdueCount} (${overduePct}%)`}
          icon={AlertCircle}
          variant="danger"
          actionText="View Overdue"
          onActionClick={() => {}}
        />
      </div>

      {/* Main Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Table & Filter Ribbon (9 Columns) */}
        <div className="lg:col-span-9 flex flex-col gap-5">
          {/* Ribbon Filters */}
          <FilterRibbon filters={filtersConfig} action={actionConfig} />

          {/* Table Container Card */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col justify-between overflow-hidden min-h-[300px]">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs-portal">
                <thead>
                  <tr className="border-b border-card-border text-2xs text-gray-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-2">Inspection</th>
                    <th className="py-3 px-2">Property</th>
                    <th className="py-3 px-2">Type</th>
                    <th className="py-3 px-2">Inspector</th>
                    <th className="py-3 px-2">Scheduled Date</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading || formattedInspections.length === 0 ? (
                    <TableEmptyState
                      colSpan={7}
                      loading={loading}
                      loadingText="Loading inspections..."
                      emptyText="No inspections scheduled or completed."
                    />
                  ) : (
                    paginatedInspections.map((row, idx) => {
                      const isScheduled = row.status === "Scheduled";
                      const isCompleted = row.status === "Completed";
                      return (
                        <tr
                          key={idx}
                          className="hover:bg-surface-light/50 transition-colors"
                        >
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${row.color}`}
                              >
                                <row.icon size={11} />
                              </div>
                              <div className="flex flex-col text-left">
                                <span className="font-bold text-brand-primary leading-tight truncate max-w-[150px] sm:max-w-xs">
                                  {row.item}
                                </span>
                                <span className="text-2xs text-gray-400 mt-0.5 leading-none">
                                  {row.ref}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-status-muted font-semibold">
                            {row.property}
                          </td>
                          <td className="py-3 px-2 font-semibold text-status-muted">
                            {row.type}
                          </td>
                          <td className="py-3 px-2 font-semibold text-status-muted leading-tight">
                            {row.inspector}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex flex-col leading-tight">
                              <span className="font-semibold text-text-primary">
                                {row.date}
                              </span>
                              {row.countdown && (
                                <span
                                  className={`text-2xs mt-0.5 leading-none ${row.countdownColor}`}
                                >
                                  {row.countdown}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <StatusPill
                              status={row.status}
                              size="sm"
                              showIcon={false}
                            />
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="secondary"
                                className="!py-0.5 !px-2.5 text-2xs font-bold card-bg"
                              >
                                {row.action}
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
              totalItems={totalItems}
              pageSize={pageSize}
              itemLabel="inspections"
            />
          </div>
        </div>

        {/* Right Side: Sidebar Panels (3 Columns) */}
        <div className="lg:col-span-3 flex flex-col gap-6 select-none">
          {/* Upcoming Inspections */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-4">
            <div className="flex justify-between items-baseline border-b border-card-border pb-2">
              <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider">
                Upcoming Inspections
              </h3>
              <Button
                variant="link"
                className="text-xs-portal font-bold text-status-info hover:underline cursor-pointer"
              >
                View Calendar
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              {loading ? (
                <div className="text-xs-portal text-gray-400 font-semibold py-2">
                  Loading...
                </div>
              ) : upcomingList.length === 0 ? (
                <div className="text-xs-portal text-gray-400 font-semibold py-2">
                  No upcoming inspections
                </div>
              ) : (
                upcomingList.slice(0, 3).map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between gap-3 text-xs-portal ${idx > 0 ? "border-t border-card-border pt-2.5" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
                        <Calendar size={11} />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-brand-primary leading-tight">
                          {item.item}
                        </span>
                        <span className="text-2xs text-gray-400 leading-none mt-0.5 truncate max-w-[120px]">
                          {item.property}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-right leading-none shrink-0">
                      <span className="font-semibold text-brand-primary">
                        {item.date}
                      </span>
                      {item.countdown && (
                        <span className="text-2xs text-status-muted font-bold mt-1">
                          {item.countdown}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              className="w-full font-bold card-bg text-xs-portal mt-1"
              onClick={() => {}}
            >
              View All Scheduled
            </Button>
          </div>

          {/* Overdue Inspections */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-4">
            <div className="flex justify-between items-baseline border-b border-card-border pb-2">
              <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider">
                Overdue Inspections
              </h3>
              <Button
                variant="link"
                className="text-xs-portal font-bold text-status-info hover:underline cursor-pointer"
              >
                View All
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {loading ? (
                <div className="text-xs-portal text-gray-400 font-semibold py-2">
                  Loading...
                </div>
              ) : overdueList.length === 0 ? (
                <div className="text-xs-portal text-gray-400 font-semibold py-2">
                  No overdue inspections
                </div>
              ) : (
                overdueList.slice(0, 3).map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between gap-3 text-xs-portal ${idx > 0 ? "border-t border-card-border pt-2.5" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-status-danger-bg text-status-danger flex items-center justify-center shrink-0">
                        <AlertCircle size={11} />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-brand-primary leading-tight">
                          {item.item}
                        </span>
                        <span className="text-2xs text-gray-400 leading-none mt-0.5 truncate max-w-[120px]">
                          {item.property}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-right leading-none shrink-0">
                      <span className="font-semibold text-brand-primary">
                        {item.date}
                      </span>
                      {item.countdown && (
                        <span className="text-2xs text-status-danger font-bold mt-1">
                          {item.countdown}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Need to Schedule an Inspection? */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-4">
            <div className="flex gap-3.5 items-start">
              <div className="w-8 h-8 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
                <Calendar size={15} />
              </div>
              <div className="flex flex-col text-left">
                <h4 className="text-xs-portal font-bold text-brand-primary uppercase tracking-wider">
                  Need to Schedule an Inspection?
                </h4>
                <p className="text-2xs text-gray-400 font-semibold mt-2.5 leading-relaxed">
                  Schedule a new inspection for your property or communal areas.
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={ChevronRight}
              iconPosition="right"
              className="w-full font-bold card-bg text-xs-portal"
              onClick={() => {}}
            >
              Schedule Inspection
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
