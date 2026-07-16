import { useState } from "react";
import {
  Wrench,
  ShieldCheck,
  Clock,
  AlertCircle,
  Plus,
  ChevronRight,
  Info,
  Settings,
  MoreVertical,
} from "lucide-react";
import { useMaintenance } from "../hooks/useMaintenance";
import { PortalMetricCard } from "../components/UI/PortalMetricCard";
import { Button } from "../components/UI/Button";
import { FilterRibbon } from "../components/UI/FilterRibbon";
import { Pagination } from "../components/UI/Pagination";
import { TableEmptyState } from "../components/UI/TableEmptyState";
import { DonutChart } from "../components/UI/DonutChart";
import { StatusPill } from "../components/UI/StatusPill";
import { Skeleton } from "../components/UI/Skeleton";
import { useToast } from "../components/UI/ToastContext";
import { usePropertyContext } from "../context/PropertyContext";
import { filterByProperty } from "../utilities/propertyFilter";

export const Maintenance = () => {
  const { tickets, ticketsLoading, error } = useMaintenance();
  const { addToast } = useToast();
  const comingSoon = () => addToast("This feature is coming soon.", "info");

  const { selectedProperty } = usePropertyContext();
  // Scope to the globally-selected property (no-op when "All Properties").
  const scopedTickets = filterByProperty(tickets, selectedProperty);

  // Filter states
  const [filterProperty, setFilterProperty] = useState("All Properties");
  const [filterStatus, setFilterStatus] = useState("All Statuses");
  const [filterPriority, setFilterPriority] = useState("All Priorities");

  const clearFilters = () => {
    setFilterProperty("All Properties");
    setFilterStatus("All Statuses");
    setFilterPriority("All Priorities");
  };

  // Dynamic statistics calculations
  const totalCount = scopedTickets.length;
  const completedCount = scopedTickets.filter((t) => t.status === "complete").length;
  const completedPct = totalCount
    ? Math.round((completedCount / totalCount) * 100)
    : 0;

  const inProgressCount = scopedTickets.filter((t) =>
    ["triaged", "awaiting_approval", "in_progress"].includes(t.status),
  ).length;
  const inProgressPct = totalCount
    ? Math.round((inProgressCount / totalCount) * 100)
    : 0;

  const overdueCount = scopedTickets.filter((t) => t.status === "new").length;
  const overduePct = totalCount
    ? Math.round((overdueCount / totalCount) * 100)
    : 0;

  const pendingCount =
    totalCount - completedCount - inProgressCount - overdueCount;
  const pendingPct = totalCount
    ? Math.round((pendingCount / totalCount) * 100)
    : 0;

  // Priority mapping values
  const getPriorityInfo = (urgency) => {
    if (urgency === "emergency") {
      return {
        label: "High",
        style: "text-status-danger bg-status-danger-bg border-status-danger/15",
      };
    } else {
      return {
        label: "Medium",
        style:
          "text-status-warning bg-status-warning/10 border-status-warning/15",
      };
    }
  };

  // Status label mapping
  const getStatusInfo = (status) => {
    switch (status) {
      case "complete":
        return {
          label: "Completed",
          style:
            "text-status-success bg-status-success-bg border-status-success/15",
        };
      case "new":
        return {
          label: "Pending",
          style: "text-gray-400 bg-surface-hover border-card-border",
        };
      case "cancelled":
        return {
          label: "Cancelled",
          style:
            "text-status-danger bg-status-danger-bg border-status-danger/15",
        };
      default:
        return {
          label: "In Progress",
          style: "text-status-info bg-status-info-bg border-status-info/15",
        };
    }
  };

  const formattedRequests = scopedTickets.map((t) => {
    const priority = getPriorityInfo(t.urgency);
    const status = getStatusInfo(t.status);

    return {
      id: t.id,
      ref: `Ref: MAI-${String(t.id).padStart(5, "0")}`,
      item: t.title || "Maintenance Request",
      property: t.property_address || "—",
      category: t.urgency === "emergency" ? "Emergency" : "Routine",
      priority: priority.label,
      priorityColor: priority.style,
      status: status.label,
      statusColor: status.style,
      created: t.created_at
        ? new Date(t.created_at).toLocaleDateString("en-GB")
        : "—",
      updated: t.updated_at
        ? new Date(t.updated_at).toLocaleDateString("en-GB")
        : "—",
      action: "View Details",
      icon: Wrench,
      color: "bg-status-info-bg text-status-info",
    };
  });

  // Filter options derived from the real data — every option maps to a row.
  const propertyOptions = [
    { value: "All Properties", label: "All Properties" },
    ...[
      ...new Set(
        formattedRequests.map((r) => r.property).filter((p) => p && p !== "—"),
      ),
    ]
      .sort()
      .map((p) => ({ value: p, label: p })),
  ];
  const statusOptions = [
    { value: "All Statuses", label: "All Statuses" },
    ...[...new Set(formattedRequests.map((r) => r.status).filter(Boolean))]
      .sort()
      .map((s) => ({ value: s, label: s })),
  ];
  const priorityOptions = [
    { value: "All Priorities", label: "All Priorities" },
    ...[...new Set(formattedRequests.map((r) => r.priority).filter(Boolean))]
      .sort()
      .map((p) => ({ value: p, label: p })),
  ];

  const filteredRequests = formattedRequests.filter((r) => {
    if (filterProperty !== "All Properties" && r.property !== filterProperty)
      return false;
    if (filterStatus !== "All Statuses" && r.status !== filterStatus)
      return false;
    if (filterPriority !== "All Priorities" && r.priority !== filterPriority)
      return false;
    return true;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset to page 1 when the data or the active filters change (render-time
  // pattern — avoids setState-in-effect).
  const [prevReset, setPrevReset] = useState({
    tickets,
    selectedProperty,
    filterProperty,
    filterStatus,
    filterPriority,
  });
  if (
    prevReset.tickets !== tickets ||
    prevReset.selectedProperty !== selectedProperty ||
    prevReset.filterProperty !== filterProperty ||
    prevReset.filterStatus !== filterStatus ||
    prevReset.filterPriority !== filterPriority
  ) {
    setPrevReset({
      tickets,
      selectedProperty,
      filterProperty,
      filterStatus,
      filterPriority,
    });
    setCurrentPage(1);
  }

  const totalItems = filteredRequests.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
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
    {
      label: "Filter by Priority",
      value: filterPriority,
      onChange: setFilterPriority,
      options: priorityOptions,
      width: "w-32",
    },
  ];

  const actionConfig = {
    label: "New Maintenance Request",
    icon: Plus,
    onClick: comingSoon,
  };

  if (ticketsLoading) {
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
    <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 font-sans text-brand-primary">
      {error && (
        <div className="border border-status-danger bg-status-danger/5 rounded-card p-4 text-center text-status-danger font-semibold">
          {error}
        </div>
      )}

      {/* Metric Cards Grid (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 animate-fade-in">
        <PortalMetricCard
          label="Total Requests"
          value={ticketsLoading ? "..." : totalCount}
          icon={Wrench}
          variant="info"
          actionText="View All"
          onActionClick={clearFilters}
        />
        <PortalMetricCard
          label="Completed"
          value={
            ticketsLoading ? "..." : `${completedCount} (${completedPct}%)`
          }
          icon={ShieldCheck}
          variant="success"
          actionText="View Completed"
          onActionClick={() => setFilterStatus("Completed")}
        />
        <PortalMetricCard
          label="In Progress"
          value={
            ticketsLoading ? "..." : `${inProgressCount} (${inProgressPct}%)`
          }
          icon={Clock}
          variant="warning"
          actionText="View In Progress"
          onActionClick={() => setFilterStatus("In Progress")}
        />
        <PortalMetricCard
          label="Overdue"
          value={ticketsLoading ? "..." : `${overdueCount} (${overduePct}%)`}
          icon={AlertCircle}
          variant="danger"
          actionText="View Overdue"
          onActionClick={() => setFilterStatus("Pending")}
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
                    <th className="py-3 px-2">Request</th>
                    <th className="py-3 px-2">Property</th>
                    <th className="py-3 px-2">Category</th>
                    <th className="py-3 px-2">Priority</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2">Created</th>
                    <th className="py-3 px-2">Updated</th>
                    <th className="py-3 px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedRequests.length === 0 ? (
                    <TableEmptyState
                      colSpan={8}
                      loading={ticketsLoading}
                      loadingText="Loading requests..."
                      emptyText="No maintenance requests match the selected filters."
                    />
                  ) : (
                    paginatedRequests.map((row, idx) => (
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
                          {row.category}
                        </td>
                        <td className="py-3 px-2">
                          <StatusPill
                            status={row.priority}
                            size="sm"
                            rounded="sm"
                            showIcon={false}
                          />
                        </td>
                        <td className="py-3 px-2">
                          <StatusPill
                            status={row.status}
                            size="sm"
                            rounded="sm"
                            showIcon={false}
                          />
                        </td>
                        <td className="py-3 px-2 font-medium text-gray-400 leading-tight">
                          {row.created}
                        </td>
                        <td className="py-3 px-2 font-medium text-gray-400 leading-tight">
                          {row.updated}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="secondary"
                              className="!py-0.5 !px-2.5 text-2xs font-bold card-bg"
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

            {/* Pagination footer */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalItems}
              pageSize={pageSize}
              itemLabel="requests"
            />
          </div>

          {/* Stay on Top of Maintenance banner */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex gap-4 items-center mt-1 select-none text-left">
            <div className="w-10 h-10 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
              <Info size={16} />
            </div>
            <div className="flex flex-col">
              <h4 className="text-xs-portal font-bold text-brand-primary uppercase tracking-wider leading-none">
                Stay on Top of Maintenance
              </h4>
              <p className="text-2xs text-gray-400 font-semibold mt-2.5 leading-none">
                Timely maintenance helps protect your property and keeps your
                tenants happy.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Sidebar Panels (3 Columns) */}
        <div className="lg:col-span-3 flex flex-col gap-6 select-none">
          {/* Maintenance Overview (Donut Chart) */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-4">
            <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider pb-2 border-b border-card-border">
              Maintenance Overview
            </h3>

            <div className="flex items-center gap-6 mt-2">
              <DonutChart
                segments={[
                  { value: completedCount, colorClass: "stroke-status-info" },
                  {
                    value: inProgressCount,
                    colorClass: "stroke-status-warning",
                  },
                  { value: overdueCount, colorClass: "stroke-status-danger" },
                ]}
                total={totalCount}
              />
              <div className="flex flex-col gap-1.5 text-2xs font-bold text-status-muted">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-info shrink-0" />
                  <span>Completed</span>
                  <span className="text-brand-primary font-extrabold ml-1">
                    {completedCount} ({completedPct}%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-warning shrink-0" />
                  <span>In Progress</span>
                  <span className="text-brand-primary font-extrabold ml-1">
                    {inProgressCount} ({inProgressPct}%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                  <span>Pending</span>
                  <span className="text-brand-primary font-extrabold ml-1">
                    {pendingCount} ({pendingPct}%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-danger shrink-0" />
                  <span>Overdue</span>
                  <span className="text-brand-primary font-extrabold ml-1">
                    {overdueCount} ({overduePct}%)
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant="link"
              className="text-xs-portal font-bold text-status-info hover:underline text-left mt-2 flex items-center gap-0.5 cursor-pointer"
              onClick={comingSoon}
            >
              View Full Report <ChevronRight size={10} />
            </Button>
          </div>

          {/* Top Maintenance Categories */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-4">
            <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider pb-2 border-b border-card-border">
              Top Maintenance Categories
            </h3>

            <div className="flex flex-col gap-3 mt-1">
              <div className="text-xs-portal text-gray-400 font-semibold py-2">
                No category data available
              </div>
            </div>

            <Button
              variant="link"
              className="text-xs-portal font-bold text-status-info hover:underline text-left mt-1 flex items-center gap-0.5 cursor-pointer"
              onClick={comingSoon}
            >
              View All Categories <ChevronRight size={10} />
            </Button>
          </div>

          {/* Need to Report an Issue? */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-4">
            <div className="flex gap-3.5 items-start">
              <div className="w-8 h-8 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
                <Wrench size={15} />
              </div>
              <div className="flex flex-col text-left">
                <h4 className="text-xs-portal font-bold text-brand-primary uppercase tracking-wider">
                  Need to Report an Issue?
                </h4>
                <p className="text-2xs text-gray-400 font-semibold mt-2.5 leading-relaxed">
                  Submit a new maintenance request and our team will take care
                  of the rest.
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={ChevronRight}
              iconPosition="right"
              className="w-full font-bold card-bg text-xs-portal"
              onClick={comingSoon}
            >
              Report an Issue
            </Button>
          </div>

          {/* Maintenance Settings Button */}
          <Button
            variant="secondary"
            size="sm"
            icon={Settings}
            iconPosition="left"
            className="w-full font-bold card-bg text-xs-portal h-9"
            onClick={() => {}}
          >
            Maintenance Settings
          </Button>
        </div>
      </div>
    </div>
  );
};
