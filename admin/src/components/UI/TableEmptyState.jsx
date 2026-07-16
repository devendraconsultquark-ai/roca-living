import React from "react";

export const TableEmptyState = ({
  colSpan,
  loading,
  loadingText = "Loading...",
  emptyText = "No records found.",
  className = "py-8 text-center text-gray-400 font-bold",
}) => {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={`${className} ${loading ? "animate-pulse" : ""}`}
      >
        {loading ? loadingText : emptyText}
      </td>
    </tr>
  );
};
