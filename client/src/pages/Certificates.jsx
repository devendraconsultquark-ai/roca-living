import React, { useState, useEffect } from "react";
import { usePropertyContext } from "../context/PropertyContext";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Calendar,
  AlertCircle,
  ShieldCheck,
  Download,
  ChevronRight,
  Info,
  PlusCircle,
  MoreVertical,
} from "lucide-react";
import { useProperties } from "../hooks/useProperties";
import { useDocuments } from "../hooks/useDocuments";
import { PortalMetricCard } from "../components/UI/PortalMetricCard";
import { Button } from "../components/UI/Button";
import { FilterRibbon } from "../components/UI/FilterRibbon";
import { Pagination } from "../components/UI/Pagination";
import { TableEmptyState } from "../components/UI/TableEmptyState";
import { StatusPill } from "../components/UI/StatusPill";

export const Certificates = () => {
  const { selectedProperty } = usePropertyContext();
  const navigate = useNavigate();
  const { properties } = useProperties();
  const { documents, loading, error } = useDocuments();

  // Filter states
  const [filterProperty, setFilterProperty] = useState("All Properties");
  const [filterType, setFilterType] = useState("All Types");
  const [filterStatus, setFilterStatus] = useState("All Statuses");
  const [filterDue, setFilterDue] = useState("All Time");

  // Sidebar filter states
  const [sidebarType, setSidebarType] = useState("All Types");
  const [sidebarStatus, setSidebarStatus] = useState("All Statuses");
  const [sidebarDue, setSidebarDue] = useState("All Time");

  // Derive certificates from actual document records
  const certificatesData = [];
  
  if (documents) {
    documents
      .filter((doc) => doc.category === "Certificates" || doc.category === "Compliance")
      .forEach((doc) => {
        const isExpired = doc.status === "Expired";
        certificatesData.push({
          item: doc.item || "Certificate",
          ref: `Ref: ${doc.id}`,
          type: doc.category || "Safety",
          property: doc.related?.length > 0 ? doc.related[0] : "—",
          issued: doc.uploaded || "—",
          expires: "—", // Backend doesn't support document expiry yet
          countdown: isExpired ? "Expired" : "Active",
          countdownColor: isExpired ? "text-status-danger font-bold" : "text-status-muted",
          status: isExpired ? "Expired" : "Valid",
          action: "View Certificate",
          icon: ShieldCheck,
          color: isExpired ? "bg-red-50 text-red-500" : "bg-status-success-bg text-status-success",
        });
      });
  }

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [documents]);

  const totalItems = certificatesData.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedCertificates = certificatesData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // Calculate stats dynamically
  const totalCount = certificatesData.length;
  const compliantCount = certificatesData.filter(
    (c) => c.status === "Valid",
  ).length;
  const expiredCount = certificatesData.filter(
    (c) => c.status === "Expired",
  ).length;
  const expiringSoonCount = 0; // Not tracked via static API dates

  const filtersConfig = [
    {
      label: "Filter by Property",
      value: filterProperty,
      onChange: setFilterProperty,
      options: [{ value: "All Properties", label: "All Properties" }],
      width: "w-44",
    },
    {
      label: "Filter by Type",
      value: filterType,
      onChange: setFilterType,
      options: [
        { value: "All Types", label: "All Types" },
        { value: "Gas Safety", label: "Gas Safety" },
        { value: "EPC", label: "EPC" },
        { value: "Electrical Safety", label: "Electrical Safety" },
      ],
      width: "w-32",
    },
    {
      label: "Filter by Status",
      value: filterStatus,
      onChange: setFilterStatus,
      options: [
        { value: "All Statuses", label: "All Statuses" },
        { value: "Valid", label: "Valid" },
        { value: "Expired", label: "Expired" },
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
    label: "Request Certificate",
    icon: PlusCircle,
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
        {/* Main layout skeleton */}
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
          label="Total Certificates"
          value={loading ? "..." : totalCount}
          icon={FileText}
          variant="info"
          actionText="View All"
          onActionClick={() => {}}
        />
        <PortalMetricCard
          label="Compliant"
          value={loading ? "..." : compliantCount}
          icon={ShieldCheck}
          variant="success"
          actionText="View Compliant"
          onActionClick={() => {}}
        />
        <PortalMetricCard
          label="Expiring Soon"
          value={loading ? "..." : expiringSoonCount}
          icon={Calendar}
          variant="warning"
          actionText="View Expiring"
          onActionClick={() => {}}
        />
        <PortalMetricCard
          label="Expired"
          value={loading ? "..." : expiredCount}
          icon={AlertCircle}
          variant="danger"
          actionText="View Expired"
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
                    <th className="py-3 px-2">Certificate Name</th>
                    <th className="py-3 px-2">Property</th>
                    <th className="py-3 px-2">Type</th>
                    <th className="py-3 px-2">Issued Date</th>
                    <th className="py-3 px-2">Expiry Date</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading || certificatesData.length === 0 ? (
                    <TableEmptyState
                      colSpan={7}
                      loading={loading}
                      loadingText="Loading certificates..."
                      emptyText="No property compliance certificates found."
                    />
                  ) : (
                    paginatedCertificates.map((row, idx) => {
                      const isCompliant = row.status === "Compliant";
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
                          <td className="py-3 px-2 font-medium text-gray-400">
                            {row.issued}
                          </td>
                          <td className="py-3 px-2 font-medium text-gray-400">
                            <div className="flex flex-col leading-tight">
                              <span>{row.expires}</span>
                              <span
                                className={`text-2xs mt-0.5 leading-none ${row.countdownColor}`}
                              >
                                {row.countdown}
                              </span>
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
              itemLabel="certificates"
            />
          </div>
        </div>

        {/* Right Side: Sidebar Panels (3 Columns) */}
        <div className="lg:col-span-3 flex flex-col gap-6 select-none">
          {/* Certificate Expiry Warnings */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-4">
            <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider border-b border-card-border pb-2">
              Expiry Warnings
            </h3>

            <div className="flex flex-col gap-3">
              {loading ? (
                <div className="text-xs-portal text-gray-400 font-semibold py-2">
                  Loading...
                </div>
              ) : expiredCount === 0 ? (
                <div className="text-xs-portal text-gray-400 font-semibold py-2">
                  No certificates expired or expiring soon
                </div>
              ) : (
                certificatesData
                  .filter((c) => c.status === "Expired")
                  .slice(0, 3)
                  .map((item, idx) => (
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
                      <StatusPill
                        status="expired"
                        size="sm"
                        rounded="sm"
                        showIcon={false}
                      />
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Need a New Certificate? */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-4 text-left">
            <div className="flex gap-3.5 items-start">
              <div className="w-8 h-8 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
                <FileText size={15} />
              </div>
              <div className="flex flex-col">
                <h4 className="text-xs-portal font-bold text-text-primary uppercase tracking-wider">
                  Need a New Certificate?
                </h4>
                <p className="text-2xs text-gray-400 font-semibold mt-2.5 leading-relaxed">
                  Request a new compliance inspection and certification for your
                  rental property.
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
              Request Inspection
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
