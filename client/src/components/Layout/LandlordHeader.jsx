import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, User } from "lucide-react";
import { PropertyDropdown } from "./PropertyDropdown";
import { usePropertyContext } from "../../context/PropertyContext";
import { Button } from "../UI/Button";

export const LandlordHeader = ({ setMobileMenuOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedProperty, properties } = usePropertyContext();

  const getHeaderDetails = () => {
    const path = location.pathname;

    if (path.startsWith("/dashboard")) {
      const title =
        selectedProperty === "all"
          ? "All Properties Overview"
          : selectedProperty?.name ||
            selectedProperty?.address_line1 ||
            "Dashboard";

      // Live indicators derived from the loaded portfolio (or the selected
      // property) rather than hardcoded claims.
      const props = properties || [];
      let occupancy;
      let compliancePct;
      if (selectedProperty === "all" || !selectedProperty) {
        const occupiedCount = props.filter((p) => p.status === "let").length;
        occupancy = {
          text: `${occupiedCount}/${props.length} Occupied`,
          variant: occupiedCount === props.length && props.length > 0 ? "success" : "info",
        };
        compliancePct =
          props.length > 0
            ? Math.round(
                (props.filter((p) => p.compliance_pct === 100).length / props.length) * 100,
              )
            : 100;
      } else {
        occupancy = {
          text: selectedProperty?.status === "let" ? "Occupied" : "Vacant",
          variant: selectedProperty?.status === "let" ? "success" : "info",
        };
        compliancePct = selectedProperty?.compliance_pct ?? 100;
      }

      return {
        title,
        subTitle: "performance overview",
        indicators: [
          occupancy,
          { text: "Fully Managed", variant: "info" },
          {
            text: `${compliancePct}% Compliant`,
            variant: compliancePct === 100 ? "success" : "warning",
          },
        ],
      };
    }

    if (path.match(/\/properties\/\d+/)) {
      return {
        title:
          selectedProperty === "all"
            ? "Properties"
            : selectedProperty?.name ||
              selectedProperty?.address_line1 ||
              "Property Details",
        subTitle:
          selectedProperty === "all"
            ? "Manage and review your property portfolio."
            : `${selectedProperty?.property_reference ? `${selectedProperty.property_reference} • ` : ""}${selectedProperty?.city || "London"}, ${selectedProperty?.postcode || ""}`,
        indicators: [],
      };
    }

    if (path.startsWith("/properties")) {
      return {
        title: "Properties",
        subTitle: "Manage and review your property portfolio.",
        indicators: [],
      };
    }

    if (path.startsWith("/financials")) {
      return {
        title: "Financials",
        subTitle: "Full financial overview and transaction history.",
        indicators: [],
      };
    }

    if (path.startsWith("/statements")) {
      return {
        title: "Statements",
        subTitle: "Review rent statements, payouts, and downloads.",
        indicators: [],
      };
    }

    if (path.startsWith("/compliance/certificates")) {
      return {
        title: "Certificates",
        subTitle:
          "View and manage all compliance certificates for your property.",
        indicators: [],
      };
    }

    if (path.startsWith("/compliance/inspections")) {
      return {
        title: "Inspections",
        subTitle: "Schedule, track and manage property inspections.",
        indicators: [],
      };
    }

    if (
      path.startsWith("/compliance") ||
      path.startsWith("/compliance/overview")
    ) {
      return {
        title: "Compliance",
        subTitle: "Monitor and manage all compliance requirements.",
        indicators: [],
      };
    }

    if (path.startsWith("/maintenance")) {
      return {
        title: "Maintenance",
        subTitle: "Log, track and manage all property maintenance requests.",
        indicators: [],
      };
    }

    if (path.startsWith("/tenancy/documents")) {
      return {
        title: "Documents",
        subTitle:
          "Store, organise and access all important documents for your property.",
        indicators: [],
      };
    }

    if (path.startsWith("/tenancy")) {
      return {
        title: "Tenancy Lifecycle",
        subTitle:
          "Oversee every stage of the tenancy from move in to move out and renewal.",
        indicators: [],
      };
    }

    if (path.startsWith("/utilities")) {
      return {
        title: "Utilities & Access",
        subTitle: "Manage utility meters and entry key logs.",
        indicators: [],
      };
    }

    if (path.startsWith("/documents")) {
      return {
        title: "Documents",
        subTitle:
          "Store, organise and access all important documents for your property.",
        indicators: [],
      };
    }

    if (path.startsWith("/support")) {
      return {
        title: "Help",
        subTitle: "Get help with using the ROCA Living portal.",
        indicators: [],
      };
    }

    if (path.startsWith("/profile")) {
      return {
        title: "Profile",
        subTitle: "Manage your account details and preferences.",
        indicators: [],
      };
    }

    // Fallback
    const cleanTitle = path.replace("/", "").replace(/-/g, " ");
    return {
      title: cleanTitle || "Portal",
      subTitle: "Overview",
      indicators: [],
    };
  };

  const { title, subTitle, indicators } = getHeaderDetails();

  return (
    <header className="h-24 py-8 bg-white shadow-sm sticky top-0 z-40 shrink-0 font-sans w-full flex items-center px-8">
      <div className="max-w-[1440px] w-full mx-auto flex items-center justify-between">
        {/* 1. Left Section: Hamburger & Title Info */}
        <div className="flex items-center gap-4 min-w-0">
          <Button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-1.5 text-status-muted hover:text-brand-primary hover:bg-surface-hover rounded-lg shrink-0"
          >
            <Menu size={22} />
          </Button>

          <div className="flex flex-col min-w-0">
            <h1 className="text-base-portal font-medium text-brand-primary leading-tight tracking-tight">
              {title}
            </h1>
            {subTitle && (
              <span className="text-xs-portal text-status-muted font-semibold leading-none mt-1">
                {subTitle}
              </span>
            )}

            {/* Indicators list (Dashboard only) */}
            {indicators && indicators.length > 0 && (
              <div className="flex items-center gap-2.5 mt-2 text-xs-portal font-medium text-status-muted select-none">
                {indicators.map((ind, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-gray-200">|</span>}
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          ind.variant === "success"
                            ? "bg-status-success"
                            : ind.variant === "warning"
                              ? "bg-status-warning"
                              : "bg-status-info"
                        }`}
                      />
                      {ind.text}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2. Right Section: Property Selector Dropdown & Quick Actions */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="hidden sm:block">
            <PropertyDropdown />
          </div>

          <div className="flex items-center gap-3">
            {/* User Profile outline */}
            <button
              onClick={() => navigate("/profile")}
              className="w-11 h-11 rounded-full border border-card-border bg-white flex items-center justify-center relative hover:border-gray-300 hover:shadow-xs cursor-pointer transition-all duration-150 shrink-0"
            >
              <div className="w-9 h-9 rounded-full bg-surface-light flex items-center justify-center text-status-muted">
                <User size={18} />
              </div>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
