import React, { useState, useEffect } from "react";
import { usePropertyContext } from "../context/PropertyContext";
import { PortalCard } from "../components/UI/PortalCard";
import { TableEmptyState } from "../components/UI/TableEmptyState";
import { Pagination } from "../components/UI/Pagination";
import { Skeleton } from "../components/UI/Skeleton";
import { useUtilities } from "../hooks/useUtilities";
import { Key, Wrench, Settings } from "lucide-react";

export const Utilities = () => {
  const { selectedProperty } = usePropertyContext();
  const { utilities, loading, error } = useUtilities();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filter based on property context
  let utilitiesData = utilities || [];
  if (selectedProperty && selectedProperty !== "all") {
    utilitiesData = utilitiesData.filter(
      (u) => u.property_id === selectedProperty.id
    );
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [utilitiesData]);

  const totalPages = Math.ceil(utilitiesData.length / pageSize);
  const paginatedUtilities = utilitiesData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8">
        <Skeleton className="h-[400px]" />
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

      <PortalCard title="Utilities & Access Logs" icon={Key}>
        {utilitiesData.length === 0 ? (
          <TableEmptyState
            icon={Wrench}
            title="No Utility Records Found"
            description="There are currently no utility or access records for this property."
          />
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-card-border text-xs text-gray-400 uppercase tracking-tight">
                  <th className="pb-3 pl-4 font-semibold">Property</th>
                  <th className="pb-3 font-semibold">Utility Type</th>
                  <th className="pb-3 font-semibold">Supplier</th>
                  <th className="pb-3 font-semibold">Account Ref</th>
                  <th className="pb-3 font-semibold">Direction</th>
                  <th className="pb-3 font-semibold">Handover Date</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {paginatedUtilities.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-card-border/50 hover:bg-surface-hover/50 transition-colors"
                  >
                    <td className="py-4 pl-4 truncate max-w-[200px]">
                      {u.property_name || u.address_line1}
                    </td>
                    <td className="py-4 capitalize">
                      {u.utility_type ? u.utility_type.replace("_", " ") : "N/A"}
                    </td>
                    <td className="py-4">{u.supplier || "—"}</td>
                    <td className="py-4 font-mono text-xs">{u.account_ref || "—"}</td>
                    <td className="py-4 capitalize">{u.direction ? u.direction.replace("_", " ") : "—"}</td>
                    <td className="py-4 text-gray-500">
                      {u.handover_date
                        ? new Date(u.handover_date).toLocaleDateString("en-GB")
                        : "—"}
                    </td>
                    <td className="py-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                          u.status === "active"
                            ? "bg-status-success-bg text-status-success"
                            : u.status === "pending"
                            ? "bg-status-warning-bg text-status-warning"
                            : "bg-status-info-bg text-status-info"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </PortalCard>
    </div>
  );
};
