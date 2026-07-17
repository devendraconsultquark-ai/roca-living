import { useState } from "react";
import {
  Wrench,
  ShieldCheck,
  Clock,
  AlertCircle,
  Plus,
  ChevronRight,
  Info,
  X,
  Upload,
} from "lucide-react";
import { useMaintenance } from "../hooks/useMaintenance";
import { PortalMetricCard } from "../components/UI/PortalMetricCard";
import { Button } from "../components/UI/Button";
import { Input } from "../components/UI/Input";
import { Dropdown } from "../components/UI/Dropdown";
import { FilterRibbon } from "../components/UI/FilterRibbon";
import { Pagination } from "../components/UI/Pagination";
import { TableEmptyState } from "../components/UI/TableEmptyState";
import { DonutChart } from "../components/UI/DonutChart";
import { StatusPill } from "../components/UI/StatusPill";
import { Skeleton } from "../components/UI/Skeleton";
import { usePropertyContext } from "../context/PropertyContext";
import { filterByProperty } from "../utilities/propertyFilter";

export const Maintenance = () => {
  const {
    tickets,
    ticketsLoading,
    error,
    quotes,
    myProperties,
    property,
    setProperty,
    title,
    setTitle,
    description,
    setDescription,
    picture,
    setPicture,
    errors,
    loading: submitLoading,
    handleQuoteAction,
    handleFileInputChange,
    handleSubmitIssue,
    getTicketImages,
  } = useMaintenance();

  // Report-issue modal
  const [isReportOpen, setIsReportOpen] = useState(false);

  const submitReport = async (e) => {
    const ok = await handleSubmitIssue(e);
    if (ok) setIsReportOpen(false);
  };

  // Ticket detail modal
  const [detailTicket, setDetailTicket] = useState(null);
  const [detailImages, setDetailImages] = useState([]);

  const openDetail = async (row) => {
    setDetailTicket(row);
    setDetailImages([]);
    try {
      setDetailImages(await getTicketImages(row.id));
    } catch {
      // No photos (or fetch failed) — the section stays empty.
    }
  };

  const closeDetail = () => {
    detailImages.forEach((img) => { if (img.url) window.URL.revokeObjectURL(img.url); });
    setDetailTicket(null);
    setDetailImages([]);
  };

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
      raw: t,
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
    onClick: () => setIsReportOpen(true),
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
                              onClick={() => openDetail(row)}
                            >
                              {row.action}
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
          {/* Quotes Awaiting Approval */}
          {quotes.length > 0 && (
            <div className="card-bg border border-status-warning/30 rounded-card p-5 shadow-xs flex flex-col gap-4">
              <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider pb-2 border-b border-card-border">
                Quotes Awaiting Approval
              </h3>
              <div className="flex flex-col gap-4">
                {quotes.map((q) => (
                  <div key={q.id} className="flex flex-col gap-2 pb-3 border-b border-card-border/60 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs-portal font-bold text-brand-primary leading-tight">{q.property}</span>
                      <span className="text-xs-portal font-extrabold text-brand-primary whitespace-nowrap">
                        £{q.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-2xs text-gray-400 font-semibold leading-snug">{q.description}</p>
                    <p className="text-2xs text-gray-400 font-semibold">Contractor: {q.contractor}</p>
                    <div className="flex gap-2 mt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        className="!py-1 !px-3 text-2xs font-bold flex-1"
                        onClick={() => handleQuoteAction(q.id, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="!py-1 !px-3 text-2xs font-bold flex-1 text-status-danger"
                        onClick={() => handleQuoteAction(q.id, "decline")}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              onClick={() => setIsReportOpen(true)}
            >
              Report an Issue
            </Button>
          </div>
        </div>
      </div>

      {/* Report Issue Modal */}
      {isReportOpen && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-bg rounded-card p-6 w-full max-w-lg shadow-premium border border-card-border max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base-portal font-bold text-brand-primary">Report a Maintenance Issue</h3>
              <button onClick={() => setIsReportOpen(false)} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitReport} className="flex flex-col gap-4">
              <Dropdown
                label="Property"
                id="report-property"
                placeholder="Select property..."
                options={myProperties}
                value={property}
                onChange={setProperty}
                error={errors.property}
              />
              <Input
                label="Title"
                id="report-title"
                required
                placeholder="e.g. Boiler not heating"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={errors.title}
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="report-description" className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                  Description <span className="text-status-danger">*</span>
                </label>
                <textarea
                  id="report-description"
                  rows={3}
                  placeholder="Describe the issue in detail..."
                  className={`w-full text-xs-portal bg-white border border-card-border rounded-card py-2.5 px-3 transition-all focus:outline-none focus:ring-2 focus:ring-status-info/20 focus:border-status-info ${errors.description ? "border-status-danger" : ""}`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                {errors.description && <span className="text-2xs text-status-danger font-bold">{errors.description}</span>}
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="report-photo" className="text-2xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Upload size={11} /> Photo (optional)
                </label>
                <input
                  id="report-photo"
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp"
                  onChange={handleFileInputChange}
                  className="text-xs-portal text-status-muted file:mr-3 file:px-3 file:py-1.5 file:rounded-card file:border file:border-card-border file:bg-surface-light file:text-brand-primary file:font-bold file:text-2xs file:cursor-pointer cursor-pointer"
                />
                {picture && (
                  <div className="flex items-center gap-2 text-2xs text-status-muted font-semibold mt-1">
                    <span className="truncate">{picture.name}</span>
                    <button type="button" onClick={() => setPicture(null)} className="text-status-danger font-bold cursor-pointer hover:underline">
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end mt-1">
                <Button type="button" variant="secondary" onClick={() => setIsReportOpen(false)} disabled={submitLoading}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitLoading}>
                  {submitLoading ? "Submitting…" : "Submit Request"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      {detailTicket && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-bg rounded-card p-6 w-full max-w-lg shadow-premium border border-card-border max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-base-portal font-bold text-brand-primary">{detailTicket.item}</h3>
              <button onClick={closeDetail} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <p className="text-2xs text-gray-400 font-semibold mb-4">{detailTicket.ref} • {detailTicket.property}</p>

            <div className="flex items-center gap-2 mb-4">
              <StatusPill status={detailTicket.status} size="sm" rounded="sm" showIcon={false} />
              <StatusPill status={detailTicket.priority} size="sm" rounded="sm" showIcon={false} />
            </div>

            <p className="text-xs-portal text-status-muted leading-relaxed mb-4 bg-surface-light border border-card-border rounded-card p-3">
              {detailTicket.raw.description}
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs-portal mb-4">
              <div>
                <p className="text-2xs text-gray-400 font-bold uppercase tracking-wider">Reported</p>
                <p className="font-bold text-brand-primary mt-0.5">{detailTicket.created}</p>
              </div>
              <div>
                <p className="text-2xs text-gray-400 font-bold uppercase tracking-wider">Last Updated</p>
                <p className="font-bold text-brand-primary mt-0.5">{detailTicket.updated}</p>
              </div>
              <div>
                <p className="text-2xs text-gray-400 font-bold uppercase tracking-wider">Contractor</p>
                <p className="font-bold text-brand-primary mt-0.5">{detailTicket.raw.contractor_company || "Not yet assigned"}</p>
              </div>
              <div>
                <p className="text-2xs text-gray-400 font-bold uppercase tracking-wider">Quote</p>
                <p className="font-bold text-brand-primary mt-0.5">
                  {detailTicket.raw.quote_amount && parseFloat(detailTicket.raw.quote_amount) > 0
                    ? `£${parseFloat(detailTicket.raw.quote_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : "—"}
                </p>
              </div>
            </div>

            {detailImages.length > 0 && (
              <div className="flex flex-col gap-2 mb-4">
                <p className="text-2xs text-gray-400 font-bold uppercase tracking-wider">Photos ({detailImages.length})</p>
                <div className="grid grid-cols-3 gap-2">
                  {detailImages.map((img) => (
                    img.url ? (
                      <a key={img.id} href={img.url} target="_blank" rel="noreferrer">
                        <img src={img.url} alt={img.original_name || `Ticket photo ${img.id}`} className="w-full h-20 object-cover rounded-card border border-card-border hover:opacity-90 transition-opacity" />
                      </a>
                    ) : (
                      <div key={img.id} className="w-full h-20 rounded-card border border-dashed border-card-border flex items-center justify-center text-2xs text-gray-400">
                        Unavailable
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {quotes.some((q) => q.id === detailTicket.id) && (
              <div className="flex gap-2 mb-4">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={async () => { await handleQuoteAction(detailTicket.id, "approve"); closeDetail(); }}
                >
                  Approve Quote
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 text-status-danger"
                  onClick={async () => { await handleQuoteAction(detailTicket.id, "decline"); closeDetail(); }}
                >
                  Decline Quote
                </Button>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="secondary" onClick={closeDetail}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
