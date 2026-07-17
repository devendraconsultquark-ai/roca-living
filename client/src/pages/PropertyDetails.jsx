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
import { Skeleton } from "../components/UI/Skeleton";
import { TableEmptyState } from "../components/UI/TableEmptyState";
import { usePropertyDetails } from "../hooks/usePropertyDetails";

const TICKET_STATUS_CHIPS = {
  new: "text-status-info bg-status-info-bg border-status-info/15",
  triaged: "text-status-info bg-status-info-bg border-status-info/15",
  awaiting_approval: "text-status-warning bg-status-warning/10 border-status-warning/15",
  in_progress: "text-status-warning bg-status-warning/10 border-status-warning/15",
  complete: "text-status-success bg-status-success-bg border-status-success/15",
  cancelled: "text-status-muted bg-surface-light border-card-border",
};

const UTILITY_STATUS_CHIPS = {
  complete: "text-status-success bg-status-success-bg border-status-success/15",
  disputed: "text-status-danger bg-status-danger/10 border-status-danger/15",
};

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
    tenancy,
    propStatements,
    propTickets,
    propCertificates,
    propUtilities,
    propDocuments,
    handleDownloadStatementPDF,
    handleDownloadDocument,
    handleViewCertificate,
  } = usePropertyDetails(id);

  const [activeTab, setActiveTab] = useState("Overview");

  const downloadLatestStatement = () => {
    const latest = propStatements[0];
    if (latest) handleDownloadStatementPDF(latest.id, latest.period);
  };

  if (isPageLoading) {
    return (
      <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8">
        <Skeleton radius="bar" className="h-8 w-1/3" />
        <Skeleton radius="bar" className="h-4 w-1/4 mt-1" />
        <Skeleton radius="bar" className="h-10 mt-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <Skeleton radius="bar" className="h-[300px]" />
          <Skeleton radius="bar" className="h-[300px]" />
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
                  disabled={propStatements.length === 0}
                  onClick={downloadLatestStatement}
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
                    Documents on File
                  </span>
                  <span className="font-mono font-bold text-brand-primary">
                    {propDocuments.length}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-1">
                  <span className="text-gray-400 font-medium">
                    Deposit Protection
                  </span>
                  <span className="font-mono font-bold text-brand-primary">
                    {tenancy?.deposit != null ? tenancy.depositStatus : "—"}
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
      ) : activeTab === "Tenant & Tenancy" ? (
        tenancy ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
            <PortalCard title="Current Tenancy" subtitle={tenancy.ref}>
              <div className="flex flex-col gap-3 mt-2 text-xs-portal text-left">
                <div className="flex justify-between items-center border-b border-card-border pb-2">
                  <span className="text-gray-400 font-medium">Lead Tenant</span>
                  <span className="font-bold text-brand-primary">{tenancy.tenant}</span>
                </div>
                <div className="flex justify-between items-center border-b border-card-border pb-2">
                  <span className="text-gray-400 font-medium">Status</span>
                  <StatusPill status="active" size="sm" showIcon={false} />
                </div>
                <div className="flex justify-between items-center border-b border-card-border pb-2">
                  <span className="text-gray-400 font-medium">Start Date</span>
                  <span className="font-bold text-brand-primary">{tenancy.start}</span>
                </div>
                <div className="flex justify-between items-center border-b border-card-border pb-2">
                  <span className="text-gray-400 font-medium">End Date</span>
                  <span className="font-bold text-brand-primary">{tenancy.end}</span>
                </div>
                <div className="flex justify-between items-center pb-1">
                  <span className="text-gray-400 font-medium">Rent</span>
                  <span className="font-bold text-brand-primary font-mono">
                    {tenancy.rentPcm != null
                      ? `£${tenancy.rentPcm.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${tenancy.rentFrequency}`
                      : "—"}
                  </span>
                </div>
              </div>
            </PortalCard>

            <PortalCard title="Deposit" subtitle="Protection details">
              <div className="flex flex-col gap-3 mt-2 text-xs-portal text-left">
                <div className="flex justify-between items-center border-b border-card-border pb-2">
                  <span className="text-gray-400 font-medium">Amount Held</span>
                  <span className="font-bold text-brand-primary font-mono">
                    {tenancy.deposit != null
                      ? `£${tenancy.deposit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-card-border pb-2">
                  <span className="text-gray-400 font-medium">Scheme</span>
                  <span className="font-bold text-brand-primary">{tenancy.depositScheme}</span>
                </div>
                <div className="flex justify-between items-center border-b border-card-border pb-2">
                  <span className="text-gray-400 font-medium">Status</span>
                  <span className="font-bold text-brand-primary">{tenancy.depositStatus}</span>
                </div>
                <div className="flex justify-between items-center pb-1">
                  <span className="text-gray-400 font-medium">Registered On</span>
                  <span className="font-bold text-brand-primary">
                    {tenancy.depositRegisteredAt}
                  </span>
                </div>
              </div>
              <div className="mt-auto pt-4 flex items-center">
                <Button
                  onClick={() => navigate("/tenancy")}
                  className="text-xs-portal font-bold text-status-info hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  View Tenancy Lifecycle <ChevronRight size={12} />
                </Button>
              </div>
            </PortalCard>
          </div>
        ) : (
          <div className="card-bg border border-card-border rounded-card p-12 text-center text-gray-400 select-none animate-fade-in">
            No active tenancy for this property.
          </div>
        )
      ) : activeTab === "Financials" ? (
        <div className="card-bg border border-card-border rounded-card p-5 shadow-xs animate-fade-in">
          <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider pb-3 border-b border-card-border select-none">
            Statements for this Property
          </h3>
          <div className="overflow-x-auto w-full mt-3">
            <table className="w-full text-left border-collapse text-xs-portal">
              <thead>
                <tr className="border-b border-card-border text-2xs text-gray-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-2">Period</th>
                  <th className="py-3 px-2">Generated</th>
                  <th className="py-3 px-2 text-right">Invoiced</th>
                  <th className="py-3 px-2 text-right">Deductions &amp; Fees</th>
                  <th className="py-3 px-2 text-right">Net Paid</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {propStatements.length === 0 ? (
                  <TableEmptyState
                    colSpan={7}
                    loading={false}
                    emptyText="No statements generated for this property yet."
                  />
                ) : (
                  propStatements.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-light/50 transition-colors">
                      <td className="py-3 px-2 font-bold text-brand-primary">{s.period}</td>
                      <td className="py-3 px-2 font-medium text-gray-400">{s.date}</td>
                      <td className="py-3 px-2 text-right font-mono font-bold text-brand-primary">
                        £{s.invoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-2 text-right font-mono font-bold text-brand-primary">
                        £{s.fees.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-2 text-right font-mono font-extrabold text-brand-primary">
                        £{s.payout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-2">
                        <StatusPill status={s.status} size="sm" showIcon={false} />
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!py-1 !px-2.5 text-2xs font-bold text-status-info hover:bg-status-info/5 border border-transparent hover:border-card-border flex items-center gap-1 cursor-pointer"
                            onClick={() => handleDownloadStatementPDF(s.id, s.period)}
                          >
                            <span>Download</span>
                            <Download size={11} className="shrink-0" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "Compliance" ? (
        <div className="card-bg border border-card-border rounded-card p-5 shadow-xs animate-fade-in">
          <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider pb-3 border-b border-card-border select-none">
            Compliance Certificates
          </h3>
          <div className="overflow-x-auto w-full mt-3">
            <table className="w-full text-left border-collapse text-xs-portal">
              <thead>
                <tr className="border-b border-card-border text-2xs text-gray-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-2">Certificate</th>
                  <th className="py-3 px-2">Type</th>
                  <th className="py-3 px-2">Issued</th>
                  <th className="py-3 px-2">Expires</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {propCertificates.length === 0 ? (
                  <TableEmptyState
                    colSpan={6}
                    loading={false}
                    emptyText="No certificates recorded for this property."
                  />
                ) : (
                  propCertificates.map((row, idx) => (
                    <tr key={idx} className="hover:bg-surface-light/50 transition-colors">
                      <td className="py-3 px-2">
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-brand-primary leading-tight">
                            {row.item}
                          </span>
                          <span className="text-2xs text-gray-400 mt-0.5 leading-none">
                            {row.ref}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 font-semibold text-status-muted">{row.type}</td>
                      <td className="py-3 px-2 font-medium text-gray-400">{row.issued}</td>
                      <td className="py-3 px-2 font-medium text-gray-400">
                        <div className="flex flex-col leading-tight">
                          <span>{row.expires}</span>
                          <span className={`text-2xs mt-0.5 leading-none ${row.countdownColor}`}>
                            {row.countdown}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <StatusPill status={row.status} size="sm" showIcon={false} />
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-center">
                          {row.hasDocument ? (
                            <Button
                              variant="secondary"
                              className="!py-0.5 !px-2.5 text-2xs font-bold card-bg"
                              onClick={() => handleViewCertificate(row)}
                            >
                              View
                            </Button>
                          ) : (
                            <span className="text-2xs text-gray-400 font-semibold">
                              No document
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "Maintenance" ? (
        <div className="card-bg border border-card-border rounded-card p-5 shadow-xs animate-fade-in">
          <div className="flex justify-between items-center pb-3 border-b border-card-border select-none">
            <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider">
              Maintenance Tickets
            </h3>
            <Button
              variant="link"
              className="text-xs-portal font-bold text-status-info hover:underline cursor-pointer"
              onClick={() => navigate("/maintenance")}
            >
              Go to Maintenance
            </Button>
          </div>
          <div className="overflow-x-auto w-full mt-3">
            <table className="w-full text-left border-collapse text-xs-portal">
              <thead>
                <tr className="border-b border-card-border text-2xs text-gray-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-2">Issue</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2">Contractor</th>
                  <th className="py-3 px-2 text-right">Quote</th>
                  <th className="py-3 px-2">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {propTickets.length === 0 ? (
                  <TableEmptyState
                    colSpan={5}
                    loading={false}
                    emptyText="No maintenance tickets for this property."
                  />
                ) : (
                  propTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-surface-light/50 transition-colors">
                      <td className="py-3 px-2">
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-brand-primary leading-tight">
                            {t.title || `Ticket #${t.id}`}
                          </span>
                          <span className="text-2xs text-gray-400 mt-0.5 leading-none truncate max-w-xs">
                            {t.description}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={`px-2 py-0.5 text-2xs font-bold rounded-sm border select-none inline-block capitalize ${TICKET_STATUS_CHIPS[t.status] || TICKET_STATUS_CHIPS.new}`}
                        >
                          {(t.status || "new").replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-semibold text-status-muted">
                        {t.contractor_company || "—"}
                      </td>
                      <td className="py-3 px-2 text-right font-mono font-bold text-brand-primary">
                        {t.quote_amount != null
                          ? `£${parseFloat(t.quote_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="py-3 px-2 font-medium text-gray-400">
                        {t.updated_at
                          ? new Date(t.updated_at).toLocaleDateString("en-GB")
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "Utilities & Access" ? (
        <div className="card-bg border border-card-border rounded-card p-5 shadow-xs animate-fade-in">
          <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider pb-3 border-b border-card-border select-none">
            Utilities &amp; Handover Records
          </h3>
          <div className="overflow-x-auto w-full mt-3">
            <table className="w-full text-left border-collapse text-xs-portal">
              <thead>
                <tr className="border-b border-card-border text-2xs text-gray-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-2">Utility</th>
                  <th className="py-3 px-2">Supplier</th>
                  <th className="py-3 px-2">Account Ref</th>
                  <th className="py-3 px-2">Direction</th>
                  <th className="py-3 px-2">Handover Date</th>
                  <th className="py-3 px-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {propUtilities.length === 0 ? (
                  <TableEmptyState
                    colSpan={6}
                    loading={false}
                    emptyText="No utility records for this property."
                  />
                ) : (
                  propUtilities.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-light/50 transition-colors">
                      <td className="py-3 px-2 font-bold text-brand-primary capitalize">
                        {(u.utility_type || "—").replace(/_/g, " ")}
                      </td>
                      <td className="py-3 px-2 font-semibold text-status-muted">
                        {u.supplier || "—"}
                      </td>
                      <td className="py-3 px-2 font-medium text-gray-400">
                        {u.account_ref || "—"}
                      </td>
                      <td className="py-3 px-2 font-semibold text-status-muted capitalize">
                        {u.direction || "—"}
                      </td>
                      <td className="py-3 px-2 font-medium text-gray-400">
                        {u.handover_date
                          ? new Date(u.handover_date).toLocaleDateString("en-GB")
                          : "—"}
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={`px-2 py-0.5 text-2xs font-bold rounded-sm border select-none inline-block capitalize ${UTILITY_STATUS_CHIPS[u.status] || "text-status-warning bg-status-warning/10 border-status-warning/15"}`}
                        >
                          {(u.status || "pending").replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card-bg border border-card-border rounded-card p-5 shadow-xs animate-fade-in">
          <div className="flex justify-between items-center pb-3 border-b border-card-border select-none">
            <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider">
              Documents for this Property
            </h3>
            <Button
              variant="link"
              className="text-xs-portal font-bold text-status-info hover:underline cursor-pointer"
              onClick={() => navigate("/documents")}
            >
              Go to Documents
            </Button>
          </div>
          <div className="overflow-x-auto w-full mt-3">
            <table className="w-full text-left border-collapse text-xs-portal">
              <thead>
                <tr className="border-b border-card-border text-2xs text-gray-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-2">Document</th>
                  <th className="py-3 px-2">Category</th>
                  <th className="py-3 px-2">Uploaded</th>
                  <th className="py-3 px-2">Size</th>
                  <th className="py-3 px-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {propDocuments.length === 0 ? (
                  <TableEmptyState
                    colSpan={5}
                    loading={false}
                    emptyText="No documents filed for this property yet."
                  />
                ) : (
                  propDocuments.map((d) => (
                    <tr key={d.id} className="hover:bg-surface-light/50 transition-colors">
                      <td className="py-3 px-2 font-bold text-brand-primary">{d.item}</td>
                      <td className="py-3 px-2 font-semibold text-status-muted">
                        {d.category || "—"}
                      </td>
                      <td className="py-3 px-2 font-medium text-gray-400">{d.uploaded}</td>
                      <td className="py-3 px-2 font-medium text-gray-400">{d.size}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!py-1 !px-2.5 text-2xs font-bold text-status-info hover:bg-status-info/5 border border-transparent hover:border-card-border flex items-center gap-1 cursor-pointer"
                            onClick={() => handleDownloadDocument(d)}
                          >
                            <span>Download</span>
                            <Download size={11} className="shrink-0" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
