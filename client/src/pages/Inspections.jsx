import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  ShieldCheck,
  Calendar,
  AlertCircle,
  ChevronRight,
  X,
} from "lucide-react";
import { useInspections } from "../hooks/useInspections";
import { PortalMetricCard } from "../components/UI/PortalMetricCard";
import { Button } from "../components/UI/Button";
import { FilterRibbon } from "../components/UI/FilterRibbon";
import { Pagination } from "../components/UI/Pagination";
import { TableEmptyState } from "../components/UI/TableEmptyState";
import { StatusPill } from "../components/UI/StatusPill";
import { Skeleton } from "../components/UI/Skeleton";
import { usePropertyContext } from "../context/PropertyContext";
import { filterByProperty } from "../utilities/propertyFilter";

export const Inspections = () => {
  const navigate = useNavigate();
  const { inspections, loading, error } = useInspections();

  // Row-level "View Report / View Details" opens this inspection in a modal.
  const [detailInspection, setDetailInspection] = useState(null);

  const { selectedProperty } = usePropertyContext();
  // Scope to the globally-selected property (no-op when "All Properties").
  const scopedInspections = filterByProperty(inspections, selectedProperty);

  // Filter states
  const [filterProperty, setFilterProperty] = useState("All Properties");
  const [filterType, setFilterType] = useState("All Types");
  const [filterStatus, setFilterStatus] = useState("All Statuses");

  const clearFilters = () => {
    setFilterProperty("All Properties");
    setFilterType("All Types");
    setFilterStatus("All Statuses");
  };

  // Compute stats dynamically from real inspections data
  const totalCount = scopedInspections.length;

  // A completed inspection is one where inspected_at or rating has been input
  const completedCount = scopedInspections.filter(
    (i) => i.date && i.date !== "—",
  ).length;
  const completedPct = totalCount
    ? Math.round((completedCount / totalCount) * 100)
    : 0;

  // Scheduled inspections have a next_due in the future and aren't completed
  const scheduledCount = scopedInspections.filter((i) => {
    if (!i.next_inspection_due) return false;
    const isFuture = new Date(i.next_inspection_due) >= new Date();
    // If not completed yet or has an upcoming target
    return isFuture;
  }).length;
  const scheduledPct = totalCount
    ? Math.round((scheduledCount / totalCount) * 100)
    : 0;

  // Overdue inspections have a next_due in the past
  const overdueCount = scopedInspections.filter((i) => {
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
  const formattedInspections = scopedInspections.map((i) => {
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
      rating: i.rating,
      comments: i.comments,
      nextDue: i.next_inspection_due
        ? new Date(i.next_inspection_due).toLocaleDateString("en-GB")
        : "—",
    };
  });

  // Filter options derived from the real data — every option maps to a row.
  const propertyOptions = [
    { value: "All Properties", label: "All Properties" },
    ...[
      ...new Set(
        formattedInspections.map((i) => i.property).filter((p) => p && p !== "—"),
      ),
    ]
      .sort()
      .map((p) => ({ value: p, label: p })),
  ];
  const typeOptions = [
    { value: "All Types", label: "All Types" },
    ...[...new Set(formattedInspections.map((i) => i.type).filter(Boolean))]
      .sort()
      .map((t) => ({ value: t, label: t })),
  ];
  const statusOptions = [
    { value: "All Statuses", label: "All Statuses" },
    ...[...new Set(formattedInspections.map((i) => i.status).filter(Boolean))]
      .sort()
      .map((s) => ({ value: s, label: s })),
  ];

  const filteredInspections = formattedInspections.filter((i) => {
    if (filterProperty !== "All Properties" && i.property !== filterProperty)
      return false;
    if (filterType !== "All Types" && i.type !== filterType) return false;
    if (filterStatus !== "All Statuses" && i.status !== filterStatus)
      return false;
    return true;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset to page 1 when the data or the active filters change (render-time
  // pattern — avoids setState-in-effect).
  const [prevReset, setPrevReset] = useState({
    inspections,
    selectedProperty,
    filterProperty,
    filterType,
    filterStatus,
  });
  if (
    prevReset.inspections !== inspections ||
    prevReset.selectedProperty !== selectedProperty ||
    prevReset.filterProperty !== filterProperty ||
    prevReset.filterType !== filterType ||
    prevReset.filterStatus !== filterStatus
  ) {
    setPrevReset({
      inspections,
      selectedProperty,
      filterProperty,
      filterType,
      filterStatus,
    });
    setCurrentPage(1);
  }

  const totalItems = filteredInspections.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedInspections = filteredInspections.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // Sidebar collections (from the full list, independent of the table filters)
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
      options: propertyOptions,
      width: "w-44",
    },
    {
      label: "Filter by Inspection Type",
      value: filterType,
      onChange: setFilterType,
      options: typeOptions,
      width: "w-32",
    },
    {
      label: "Filter by Status",
      value: filterStatus,
      onChange: setFilterStatus,
      options: statusOptions,
      width: "w-32",
    },
  ];

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
            <Skeleton className="h-[150px]" />
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
          onActionClick={clearFilters}
        />
        <PortalMetricCard
          label="Completed"
          value={loading ? "..." : `${completedCount} (${completedPct}%)`}
          icon={ShieldCheck}
          variant="success"
          actionText="View Completed"
          onActionClick={() => setFilterStatus("Completed")}
        />
        <PortalMetricCard
          label="Scheduled"
          value={loading ? "..." : `${scheduledCount} (${scheduledPct}%)`}
          icon={Calendar}
          variant="warning"
          actionText="View Scheduled"
          onActionClick={() => setFilterStatus("Scheduled")}
        />
        <PortalMetricCard
          label="Overdue"
          value={loading ? "..." : `${overdueCount} (${overduePct}%)`}
          icon={AlertCircle}
          variant="danger"
          actionText="View Overdue"
          onActionClick={() => setFilterStatus("Overdue")}
        />
      </div>

      {/* Main Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Table & Filter Ribbon (9 Columns) */}
        <div className="lg:col-span-9 flex flex-col gap-5">
          {/* Ribbon Filters */}
          <FilterRibbon filters={filtersConfig} />

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
                  {paginatedInspections.length === 0 ? (
                    <TableEmptyState
                      colSpan={7}
                      loading={loading}
                      loadingText="Loading inspections..."
                      emptyText="No inspections match the selected filters."
                    />
                  ) : (
                    paginatedInspections.map((row, idx) => {
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
                                onClick={() => setDetailInspection(row)}
                              >
                                {row.action}
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
              onClick={() => setFilterStatus("Scheduled")}
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
                onClick={() => setFilterStatus("Overdue")}
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
                  Contact your property manager to arrange an inspection for
                  your property or communal areas.
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={ChevronRight}
              iconPosition="right"
              className="w-full font-bold card-bg text-xs-portal"
              onClick={() => navigate("/support")}
            >
              Contact Support
            </Button>
          </div>
        </div>
      </div>

      {/* Inspection detail / report modal */}
      {detailInspection && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-bg rounded-card p-6 w-full max-w-lg shadow-premium border border-card-border max-h-[90vh] overflow-y-auto text-left">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-base-portal font-bold text-brand-primary">
                {detailInspection.item}
              </h3>
              <button
                onClick={() => setDetailInspection(null)}
                className="text-gray-400 hover:text-brand-primary cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-2xs text-gray-400 font-semibold mb-4">
              {detailInspection.ref} • {detailInspection.property}
            </p>

            <div className="flex items-center gap-2 mb-4">
              <StatusPill
                status={detailInspection.status}
                size="sm"
                rounded="sm"
                showIcon={false}
              />
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs-portal mb-4">
              <div className="flex flex-col">
                <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider">
                  Inspector
                </span>
                <span className="font-bold text-brand-primary mt-1">
                  {detailInspection.inspector}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider">
                  {detailInspection.status === "Completed"
                    ? "Inspected On"
                    : "Scheduled For"}
                </span>
                <span className="font-bold text-brand-primary mt-1">
                  {detailInspection.date}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider">
                  Rating
                </span>
                <span className="font-bold text-brand-primary mt-1">
                  {detailInspection.rating || "—"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider">
                  Next Inspection Due
                </span>
                <span className="font-bold text-brand-primary mt-1">
                  {detailInspection.nextDue}
                </span>
              </div>
            </div>

            <div className="flex flex-col mb-5">
              <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider">
                Inspector Notes
              </span>
              <p className="text-xs-portal font-semibold text-brand-primary mt-1.5 leading-relaxed whitespace-pre-wrap">
                {detailInspection.comments}
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDetailInspection(null)}
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
