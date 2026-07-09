import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  User,
  ChevronRight,
  Download,
  CheckCircle2,
} from "lucide-react";
import { PortalCard } from "../components/UI/PortalCard";
import { Button } from "../components/UI/Button";
import { StatusPill } from "../components/UI/StatusPill";
import { Tabs } from "../components/UI/Tabs";
import { usePropertyDetails } from "../hooks/usePropertyDetails";

export const PropertyDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Data fetching, the global-selection sync, all derivations and the activity
  // feed live in the hook; this component only renders and handles navigation.
  const {
    loading: isPageLoading,
    error,
    details,
    hasActiveTenancy,
    financialSummary,
    firstOpenTicket,
    nextInspection,
    activities,
  } = usePropertyDetails(id);

  const [activeTab, setActiveTab] = useState("Overview");

  if (isPageLoading) {
    return (
      <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 animate-pulse">
        <div className="h-8 bg-surface-hover rounded-lg w-1/3" />
        <div className="h-4 bg-surface-light rounded-lg w-1/4 mt-1" />
        <div className="h-10 bg-surface-hover rounded-lg mt-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="h-[300px] bg-surface-hover/60 rounded-card" />
          <div className="h-[300px] bg-surface-hover/60 rounded-card" />
        </div>
      </div>
    );
  }

  const tabs = [
    "Overview",
    "Tenant & Tenancy",
    "Financials",
    "Compliance",
    "Maintenance",
    "Tenancy Lifecycle",
    "Utilities & Access",
    "Documents",
  ];

  return (
    <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 font-sans text-brand-primary">
      {error && (
        <div className="border border-status-danger bg-status-danger/5 rounded-card p-4 text-center text-status-danger font-semibold">
          {error}
        </div>
      )}

      {/* 2. Subtabs Navigation link row */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* 3. Main Overview Content tab */}
      {activeTab === "Overview" ? (
        <div className="flex flex-col gap-6">
          {/* Top Panel Row (2 Columns) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Card: Property Profile */}
            <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col md:flex-row gap-5">
              {/* Photo Box */}
              <div className="w-full md:w-[210px] h-[190px] rounded-sm overflow-hidden shrink-0 border border-card-border shadow-sm bg-surface-light">
                <img
                  src={details.image}
                  alt="Property"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Profile details */}
              <div className="flex-grow flex flex-col justify-between py-0.5">
                <div>
                  <StatusPill
                    status={details.status === "let" ? "active" : "pending"}
                    customLabel={
                      details.status === "let" ? "Occupied" : "Vacant"
                    }
                    size="sm"
                    showIcon={false}
                  />

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4">
                    <div className="flex flex-col">
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                        Property Type
                      </span>
                      <span className="text-xs-portal font-bold text-brand-primary mt-1 leading-none">
                        {details.propertyType}
                      </span>

                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none mt-4.5">
                        Tenant
                      </span>
                      <div className="flex items-center gap-1 mt-1 leading-none min-w-0">
                        {details.status === "let" && (
                          <User className="w-3.5 h-3.5 text-status-info shrink-0" />
                        )}
                        <span className="text-xs-portal font-bold text-brand-primary truncate">
                          {details.tenantName}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col border-l border-card-border pl-4">
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                        Tenancy Type
                      </span>
                      <span className="text-xs-portal font-bold text-brand-primary mt-1 leading-none">
                        {details.tenancy_type}
                      </span>

                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none mt-4.5">
                        Tenancy Start Date
                      </span>
                      <span className="text-xs-portal font-bold text-brand-primary mt-1 leading-none">
                        {details.startDate}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tenant review indicator footer */}
                <div className="border-t border-card-border pt-3 mt-4 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                      Next Rent Review
                    </span>
                    <span className="text-xs-portal font-bold text-brand-primary mt-0.5 leading-none">
                      {details.nextReview}
                    </span>
                  </div>

                  <Button
                    variant="light"
                    size="sm"
                    onClick={() => setActiveTab("Tenant & Tenancy")}
                    icon={ChevronRight}
                    iconPosition="right"
                    className="text-2xs font-extrabold whitespace-nowrap !py-1 !px-2.5"
                  >
                    View Property Details
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Card: Financial Checklist Grid */}
            <div className="card-bg border border-card-border rounded-card p-5 shadow-xs flex flex-col justify-between">
              <div className="grid grid-cols-3 gap-4 pb-4 border-b border-card-border">
                <div>
                  <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                    Monthly Rent
                  </span>
                  <span className="text-base-portal font-bold text-brand-primary mt-1.5 block leading-none">
                    £{details.rent.toLocaleString()}
                  </span>
                  {details.status === "let" && (
                    <span className="text-2xs text-status-success font-semibold mt-1 block leading-none">
                      Protected
                    </span>
                  )}
                </div>
                <div className="border-l border-card-border pl-4">
                  <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                    Deposit Held
                  </span>
                  <span className="text-base-portal font-bold text-brand-primary mt-1.5 block leading-none">
                    £{details.deposit.toLocaleString()}
                  </span>
                  {details.status === "let" && (
                    <span className="text-2xs text-status-success font-semibold mt-1 block leading-none">
                      Protected
                    </span>
                  )}
                </div>
                <div className="border-l border-card-border pl-4">
                  <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                    Compliance
                  </span>
                  <span
                    className={`text-base-portal font-bold mt-1.5 block leading-none ${
                      details.compliancePct === 100
                        ? "text-status-success"
                        : "text-status-warning"
                    }`}
                  >
                    {details.compliancePct}%
                  </span>
                  <span
                    className={`text-2xs font-semibold mt-1 block leading-none ${
                      details.compliancePct === 100
                        ? "text-status-success"
                        : "text-status-warning"
                    }`}
                  >
                    {details.compliancePct === 100
                      ? "Compliant"
                      : "Action Required"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div>
                  <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                    Maintenance
                  </span>
                  <span
                    className={`text-sm-portal font-bold mt-1.5 block leading-none ${
                      details.maintenanceIssues > 0
                        ? "text-status-warning"
                        : "text-status-success"
                    }`}
                  >
                    {details.maintenanceIssues > 0
                      ? `${details.maintenanceIssues} Open Issue`
                      : "No Issues"}
                  </span>
                </div>
                <div className="border-l border-card-border pl-4">
                  <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                    Net Paid This Month
                  </span>
                  <span className="text-base-portal font-bold text-brand-primary mt-1.5 block leading-none">
                    £{details.netPaid.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action row at bottom */}
              <div className="mt-6 flex gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setActiveTab("Financials")}
                  icon={ChevronRight}
                  iconPosition="right"
                >
                  View Financials
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  icon={Download}
                  iconPosition="right"
                >
                  Download Statement
                </Button>
              </div>
            </div>
          </div>

          {/* Middle Summary Row (3 Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-1">
            {/* Card 1: Financial Summary */}
            <PortalCard title="financial summary (this month)">
              {(() => {
                // Derivation lives in usePropertyDetails; alias its fields here.
                const {
                  rentReceived: propRentReceived,
                  managementFees: propManagementFees,
                  netPaid: propNetPaid,
                  paidDate: propPaidDate,
                  deductions: propDeductions,
                } = financialSummary;

                return (
                  <div className="flex-grow flex flex-col text-xs-portal gap-2.5 mt-2">
                    <div className="flex justify-between items-center border-b border-card-border pb-1.5">
                      <span className="text-gray-400 font-medium">
                        Rent Received
                      </span>
                      <span className="font-mono font-bold text-brand-primary">
                        £
                        {propRentReceived.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-card-border pb-1.5">
                      <span className="text-gray-400 font-medium">
                        Management Fees
                      </span>
                      <span className="font-mono font-bold text-brand-primary">
                        £
                        {propManagementFees.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-1">
                      <span className="text-gray-400 font-medium">
                        Maintenance & Other
                      </span>
                      <span className="font-mono font-bold text-brand-primary">
                        £
                        {propDeductions.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    <div className="border-t border-card-border my-1"></div>

                    <div className="flex justify-between items-baseline py-1">
                      <span className="text-status-muted font-bold">
                        Net Paid
                      </span>
                      <div className="flex flex-col items-end">
                        <span className="text-base font-extrabold text-brand-primary font-mono">
                          £
                          {propNetPaid.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-2xs text-status-success font-bold uppercase tracking-wider mt-0.5 leading-none">
                          Paid{" "}
                          {propPaidDate !== "—" ? `on ${propPaidDate}` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-auto pt-4 flex items-center">
                <Button
                  onClick={() => setActiveTab("Financials")}
                  className="text-xs-portal font-bold text-status-info hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  View Financials <ChevronRight size={12} />
                </Button>
              </div>
            </PortalCard>

            {/* Card 2: Compliance Summary */}
            <PortalCard title="compliance summary">
              <div className="flex-grow flex flex-col text-xs-portal gap-2.5 mt-2">
                <div className="flex justify-between items-center border-b border-card-border pb-1.5">
                  <span className="text-gray-400 font-medium">
                    Property Compliance
                  </span>
                  <span className="font-mono font-bold text-brand-primary">
                    {details.compliancePct}%
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-card-border pb-1.5">
                  <span className="text-gray-400 font-medium">
                    Tenant Compliance
                  </span>
                  <span className="font-mono font-bold text-brand-primary">
                    {hasActiveTenancy ? "100%" : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-card-border pb-1.5">
                  <span className="text-gray-400 font-medium">
                    Documentation Compliance
                  </span>
                  <span className="font-mono font-bold text-brand-primary">
                    100%
                  </span>
                </div>
                <div className="flex justify-between items-center pb-1">
                  <span className="text-gray-400 font-medium">
                    Deposit Compliance
                  </span>
                  <span className="font-mono font-bold text-brand-primary">
                    {hasActiveTenancy ? "100%" : "—"}
                  </span>
                </div>

                <div className="border-t border-card-border my-1"></div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-status-muted font-bold">
                    Overall Compliance
                  </span>
                  <div className="flex flex-col items-end">
                    <span
                      className={`text-base font-extrabold leading-none ${details.compliancePct === 100 ? "text-status-success" : "text-status-warning"}`}
                    >
                      {details.compliancePct}%
                    </span>
                    <span
                      className={`text-2xs font-bold mt-1 uppercase tracking-wider leading-none ${details.compliancePct === 100 ? "text-status-success" : "text-status-warning"}`}
                    >
                      {details.compliancePct === 100
                        ? "Compliant"
                        : "Action Required"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-4 flex items-center">
                <Button
                  onClick={() => setActiveTab("Compliance")}
                  className="text-xs-portal font-bold text-status-info hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  View Compliance <ChevronRight size={12} />
                </Button>
              </div>
            </PortalCard>

            {/* Card 3: Maintenance Summary */}
            <PortalCard title="maintenance summary">
              <div className="flex flex-col text-xs-portal gap-2.5 mt-2 flex-grow justify-between">
                <div>
                  <div className="flex justify-between items-center border-b border-card-border pb-2">
                    <span className="text-gray-400 font-medium">
                      Open Issues
                    </span>
                    <span className="font-mono font-bold text-status-danger text-xs">
                      {details.maintenanceIssues}
                    </span>
                  </div>

                  {details.maintenanceIssues > 0 ? (
                    <div className="flex justify-between items-center mt-2.5 py-2 px-3 bg-surface-light border border-card-border rounded-card select-none">
                      <div className="flex flex-col text-left">
                        <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                          Priority
                        </span>
                        <span className="text-xs-portal font-bold text-brand-primary mt-1 leading-none truncate max-w-[150px]">
                          {firstOpenTicket?.title || "Open Issue"}
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="!py-1 !px-2 text-2xs font-bold card-bg"
                        onClick={() => navigate("/maintenance")}
                      >
                        View Issue
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-4 text-xs-portal text-status-success font-semibold text-center select-none flex items-center gap-1 justify-center py-2 bg-status-success-bg border border-status-success/15 rounded-card">
                      <CheckCircle2 size={12} /> No Maintenance Issues
                    </div>
                  )}
                </div>

                <div className="border-t border-card-border my-1"></div>

                <div className="flex justify-between items-baseline py-1">
                  <div className="flex flex-col text-left">
                    <span className="text-status-muted font-bold">
                      Next Inspection
                    </span>
                    <span className="text-xs-portal font-bold text-status-info mt-1 leading-none">
                      {nextInspection ? nextInspection.date : "—"}
                    </span>
                  </div>
                  <span className="text-2xs text-gray-400 font-medium">
                    {nextInspection ? nextInspection.countdown : ""}
                  </span>
                </div>
              </div>

              <div className="mt-auto pt-4 flex items-center">
                <Button
                  onClick={() => setActiveTab("Maintenance")}
                  className="text-xs-portal font-bold text-status-info hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  View Maintenance <ChevronRight size={12} />
                </Button>
              </div>
            </PortalCard>
          </div>

          {/* 4. Recent Activity (Horizontal Scroll List) */}
          <div className="flex flex-col gap-3 mt-1">
            <div className="flex justify-between items-center border-b border-card-border pb-2 select-none">
              <h3 className="text-base-portal font-bold text-brand-primary tracking-tight">
                Recent Activity
              </h3>
              <Button
                onClick={() => navigate("/statements")}
                className="text-xs-portal font-bold text-status-info hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                View All Activity <ChevronRight size={12} />
              </Button>
            </div>

            {/* Horizontal Timeline Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {activities.length === 0 ? (
                <div className="col-span-4 card-bg border border-card-border rounded-card p-6 text-center text-gray-400 font-semibold select-none">
                  No recent activity logged for this property.
                </div>
              ) : (
                activities.map((act, index) => (
                  <div
                    key={index}
                    className="card-bg border border-card-border rounded-card p-4 hover:border-gray-300 transition-colors shadow-xs flex items-center justify-between select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${act.color}`}
                      >
                        <act.icon size={16} />
                      </div>
                      <div className="flex flex-col min-w-0 text-left">
                        <span className="text-xs-portal font-bold text-brand-primary truncate leading-tight">
                          {act.title}
                        </span>
                        <span className="text-2xs text-gray-400 mt-0.5 truncate leading-none">
                          {act.subTitle}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className="text-2xs text-gray-400 whitespace-nowrap font-medium">
                        {act.date}
                      </span>
                      <ChevronRight
                        size={14}
                        className="text-sidebar-text-muted shrink-0"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card-bg border border-card-border rounded-card p-12 text-center text-gray-400 select-none">
          {activeTab} content will load here. Reusable modules are successfully
          registered.
        </div>
      )}
    </div>
  );
};
