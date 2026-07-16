import { useState } from "react";
import { usePropertyContext } from "../context/PropertyContext";
import {
  FileText,
  ShieldCheck,
  Clock,
  AlertCircle,
  ChevronRight,
  Download,
} from "lucide-react";
import { PortalMetricCard } from "../components/UI/PortalMetricCard";
import { FilterRibbon } from "../components/UI/FilterRibbon";
import { Pagination } from "../components/UI/Pagination";
import { TableEmptyState } from "../components/UI/TableEmptyState";
import { Button } from "../components/UI/Button";

import { useDocuments } from "../hooks/useDocuments";
import { useToast } from "../components/UI/ToastContext";

export const Documents = () => {
  const { selectedProperty } = usePropertyContext();
  const { documents, loading, handleDownload } = useDocuments();
  const { addToast } = useToast();
  const comingSoon = () => addToast("This feature is coming soon.", "info");

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All Categories");
  const [filterRelated, setFilterRelated] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All Statuses");

  const clearFilters = () => {
    setSearchQuery("");
    setFilterCategory("All Categories");
    setFilterRelated("All");
    setFilterStatus("All Statuses");
  };

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  let documentsData = documents || [];

  if (selectedProperty && selectedProperty !== "all") {
    documentsData = documentsData.filter(
      (doc) =>
        doc.related.includes(selectedProperty.property_reference) ||
        doc.related.includes(
          selectedProperty.name || selectedProperty.address_line1
        )
    );
  }

  if (searchQuery) {
    documentsData = documentsData.filter((doc) =>
      doc.item.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  if (filterCategory && filterCategory !== "All Categories") {
    documentsData = documentsData.filter((doc) => doc.category === filterCategory);
  }

  if (filterRelated && filterRelated !== "All") {
    documentsData = documentsData.filter((doc) =>
      (doc.related || []).includes(filterRelated),
    );
  }

  if (filterStatus && filterStatus !== "All Statuses") {
    documentsData = documentsData.filter((doc) => doc.status === filterStatus);
  }

  // Reset to page 1 when the data or the active filters change (render-time
  // pattern). This also fixes a prior bug where a fresh documentsData array
  // reset the page on every render, making pagination impossible.
  const resetKey = `${searchQuery}|${filterCategory}|${filterRelated}|${filterStatus}|${
    selectedProperty?.property_reference || selectedProperty?.name || "all"
  }`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setCurrentPage(1);
  }

  const totalItems = documentsData.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedDocuments = documentsData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const stats = {
    total: documentsData.length,
    upToDate: documentsData.filter(d => d.status === 'Valid').length,
    upToDatePct: documentsData.length ? Math.round((documentsData.filter(d => d.status === 'Valid').length / documentsData.length) * 100) : 0,
    expiringSoon: 0,
    expiringSoonPct: 0,
    expired: 0,
    expiredPct: 0,
  };

  const categoriesCount = {
    Tenancy: documentsData.filter(d => d.category === 'Tenancy').length,
    Certificates: documentsData.filter(d => d.category === 'Certificates').length,
    Compliance: documentsData.filter(d => d.category === 'Compliance').length,
  };

  // Filter options built from the real data so every dropdown value maps to
  // at least one document (derived from the full set, not the filtered view).
  const categoryOptions = [
    { value: "All Categories", label: "All Categories" },
    ...[...new Set((documents || []).map((d) => d.category).filter(Boolean))]
      .sort()
      .map((c) => ({ value: c, label: c })),
  ];
  const relatedOptions = [
    { value: "All", label: "All" },
    ...[
      ...new Set((documents || []).flatMap((d) => d.related || []).filter(Boolean)),
    ]
      .sort()
      .map((r) => ({ value: r, label: r })),
  ];
  const statusOptions = [
    { value: "All Statuses", label: "All Statuses" },
    ...[...new Set((documents || []).map((d) => d.status).filter(Boolean))]
      .sort()
      .map((s) => ({ value: s, label: s })),
  ];

  const filtersConfig = [
    {
      label: "Category",
      value: filterCategory,
      onChange: setFilterCategory,
      options: categoryOptions,
      width: "w-36",
    },
    {
      label: "Related To",
      value: filterRelated,
      onChange: setFilterRelated,
      options: relatedOptions,
      width: "w-32",
    },
    {
      label: "Status",
      value: filterStatus,
      onChange: setFilterStatus,
      options: statusOptions,
      width: "w-32",
    },
  ];

  const searchConfig = {
    value: searchQuery,
    onChange: (e) => setSearchQuery(e.target.value),
    placeholder: "Search documents...",
  };

  return (
    <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 font-sans text-brand-primary">
      {/* Metric Cards Grid (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <PortalMetricCard
          label="Total Documents"
          value={stats.total}
          icon={FileText}
          variant="info"
          actionText="View All Documents"
          onActionClick={clearFilters}
        />
        <PortalMetricCard
          label="Up to Date"
          value={`${stats.upToDate} (${stats.upToDatePct}%)`}
          icon={ShieldCheck}
          variant="success"
          actionText="View Up to Date"
          onActionClick={() => setFilterStatus("Valid")}
        />
        <PortalMetricCard
          label="Expiring Soon"
          value={`${stats.expiringSoon} (${stats.expiringSoonPct}%)`}
          icon={Clock}
          variant="warning"
          actionText="View Expiring Soon"
          onActionClick={comingSoon}
        />
        <PortalMetricCard
          label="Expired"
          value={`${stats.expired} (${stats.expiredPct}%)`}
          icon={AlertCircle}
          variant="danger"
          actionText="View Expired"
          onActionClick={() => setFilterStatus("Expired")}
        />
      </div>

      {/* Main Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Table & Filter Ribbon (9 Columns) */}
        <div className="lg:col-span-9 flex flex-col gap-5">
          {/* Ribbon Filters */}
          <FilterRibbon
            filters={filtersConfig}
            search={searchConfig}
          />

          {/* Table Container Card */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col justify-between overflow-hidden min-h-[300px]">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs-portal">
                <thead>
                  <tr className="border-b border-card-border text-2xs text-gray-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-2">Document Name</th>
                    <th className="py-3 px-2">Category</th>
                    <th className="py-3 px-2">Related To</th>
                    <th className="py-3 px-2">Uploaded</th>
                    <th className="py-3 px-2">Expiry Date</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {documentsData.length === 0 ? (
                    <TableEmptyState
                      colSpan={7}
                      loading={loading}
                      emptyText="No documents match the selected filters."
                      className="py-8 text-center text-gray-400 font-semibold"
                    />
                  ) : (
                    paginatedDocuments.map((row, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-surface-light/50 transition-colors"
                      >
                        <td className="py-3 px-2">{row.item}</td>
                        <td className="py-3 px-2">{row.category}</td>
                        <td className="py-3 px-2">{row.related}</td>
                        <td className="py-3 px-2">{row.uploaded}</td>
                        <td className="py-3 px-2">{row.expires}</td>
                        <td className="py-3 px-2">{row.status}</td>
                        <td className="py-3 px-2 text-center">
                          <Button
                            variant="icon-only"
                            size="sm"
                            className="p-1 hover:text-brand-primary rounded cursor-pointer"
                            onClick={() => handleDownload(row)}
                            title="Download document"
                          >
                            <Download size={13} />
                          </Button>
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
              itemLabel="documents"
            />
          </div>
        </div>

        {/* Right Side: Sidebar Panels (3 Columns) */}
        <div className="lg:col-span-3 flex flex-col gap-6 select-none">
          {/* Document Categories */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-4">
            <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider pb-2 border-b border-card-border">
              Document Categories
            </h3>

            <div className="flex flex-col gap-3 mt-1 text-xs-portal font-bold text-status-muted">
              <div className="flex justify-between items-center">
                <span>Tenancy</span>
                <span className="px-2 py-0.5 rounded-full bg-status-info-bg text-status-info text-2xs font-extrabold">
                  {categoriesCount.Tenancy}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-card-border pt-2.5">
                <span>Certificates</span>
                <span className="px-2 py-0.5 rounded-full bg-status-info-bg text-status-info text-2xs font-extrabold">
                  {categoriesCount.Certificates}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-card-border pt-2.5">
                <span>Compliance</span>
                <span className="px-2 py-0.5 rounded-full bg-status-warning/10 text-status-warning text-2xs font-extrabold">
                  {categoriesCount.Compliance}
                </span>
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

          {/* Recent Uploads */}
          <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-4">
            <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider pb-2 border-b border-card-border">
              Recent Uploads
            </h3>

            <div className="flex flex-col gap-3 mt-1">
              <div className="text-xs-portal text-gray-400 font-semibold py-2">
                No recent uploads
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
