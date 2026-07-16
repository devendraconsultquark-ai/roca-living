import React from "react";
import { Search } from "lucide-react";
import { Dropdown } from "./Dropdown";
import { Button } from "./Button";

export const FilterRibbon = ({
  filters = [],
  search = null,
  action = null,
}) => {
  return (
    <div className="card-bg border border-card-border rounded-card p-4 shadow-xs flex flex-wrap items-end justify-between gap-4 select-none">
      <div className="flex flex-wrap items-center gap-4 text-xs-portal font-bold text-text-primary">
        {/* Search Input */}
        {search && (
          <div className="flex flex-col gap-1.5">
            <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
              Search
            </span>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-2.5 text-gray-400"
              />
              <input
                type="text"
                placeholder={search.placeholder || "Search..."}
                value={search.value}
                onChange={search.onChange}
                className="border border-card-border rounded-card pl-9 pr-3 py-1.5 text-xs-portal font-bold text-status-muted card-bg placeholder-gray-400 focus:outline-none focus:border-gray-300 w-44"
              />
            </div>
          </div>
        )}

        {/* Filters */}
        {filters.map((filter, idx) => (
          <div key={idx} className="flex flex-col gap-1.5">
            <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
              {filter.label}
            </span>
            <Dropdown
              size="sm"
              className={filter.width || "w-32"}
              value={filter.value}
              onChange={filter.onChange}
              options={filter.options}
            />
          </div>
        ))}
      </div>

      {/* Action Button */}
      {action && (
        <Button
          variant="primary"
          size="sm"
          icon={action.icon}
          iconPosition={action.iconPosition || "left"}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};
