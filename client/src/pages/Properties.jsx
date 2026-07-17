import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building,
  User,
  Home as HomeIcon,
  Wallet,
  ShieldCheck,
  Search,
  Grid,
  List,
  ChevronRight,
} from "lucide-react";
import { usePropertiesPage } from "../hooks/usePropertiesPage";
import { PortalCard } from "../components/UI/PortalCard";
import { PortalMetricCard } from "../components/UI/PortalMetricCard";
import { Button } from "../components/UI/Button";
import { DataTable } from "../components/UI/DataTable";
import { StatusPill } from "../components/UI/StatusPill";
import { Chip } from "../components/UI/Chip";
import { Skeleton } from "../components/UI/Skeleton";

export const Properties = () => {
  const navigate = useNavigate();

  // Filtering, enrichment and portfolio metrics live in the hook; the page owns
  // only the presentational view-mode toggle and renders.
  const {
    filteredProperties,
    loading,
    error,
    monthlyGrossYield,
    totalCount,
    occupiedCount,
    occupiedPct,
    vacantCount,
    vacantPct,
    compliancePct,
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    financialSummary,
    complianceSummary,
    avgTenancyMonths,
  } = usePropertiesPage();

  const [viewMode, setViewMode] = useState("card"); // card | table

  // Render cert status for the table view fallback
  const renderCertStatus = (statusValue) => {
    if (!statusValue || statusValue === "not_uploaded") return "-";
    return <StatusPill status={statusValue} size="sm" showIcon={true} />;
  };

  // Table Columns
  const tableColumns = [
    { header: "Property Reference", accessor: "property_reference", sortable: true },
    { header: "Property Address", accessor: "address", sortable: true },
    { header: "Current Tenant", accessor: "tenant_name", sortable: true },
    {
      header: "Monthly Rent",
      accessor: "rent",
      align: "right",
      sortable: true,
      renderCell: (row) =>
        `£${Number(row.rent).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      header: "Occupancy",
      accessor: "status",
      renderCell: (row) => <StatusPill status={row.status} />,
    },
    {
      header: "Gas Certificate",
      accessor: "gasCompliance",
      renderCell: (row) => renderCertStatus(row.gasCompliance),
    },
    {
      header: "EPC Safety",
      accessor: "epcCompliance",
      renderCell: (row) => renderCertStatus(row.epcCompliance),
    },
    {
      header: "EICR Electrical",
      accessor: "eicrCompliance",
      renderCell: (row) => renderCertStatus(row.eicrCompliance),
    },
  ];

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8">
        <Skeleton radius="bar" className="h-8 w-1/4" />
        <Skeleton radius="bar" className="h-4 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mt-6">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} radius="card" className="h-20" />
          ))}
        </div>
        <Skeleton radius="bar" className="h-10 mt-6" />
        <div className="flex flex-col gap-4 mt-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} radius="card" className="h-32" />
          ))}
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

      {/* 1. Statistics Cards Ribbon (5 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <PortalMetricCard
          label="Total Properties"
          value={totalCount}
          subText="In your portfolio"
          icon={Building}
          variant="info"
        />
        <PortalMetricCard
          label="Occupied"
          value={occupiedCount}
          subText={`${occupiedPct}% of portfolio`}
          icon={User}
          variant="success"
        />
        <PortalMetricCard
          label="Vacant"
          value={vacantCount}
          subText={`${vacantPct}% of portfolio`}
          icon={HomeIcon}
          variant="warning"
        />
        <PortalMetricCard
          label="Monthly Rent Roll"
          value={`£${monthlyGrossYield.toLocaleString()}`}
          subText="Across all properties"
          icon={Wallet}
          variant="neutral"
        />
        <PortalMetricCard
          label="Portfolio Compliance"
          value={`${compliancePct}%`}
          subText="Overall compliant"
          icon={ShieldCheck}
          variant="success"
        />
      </div>

      {/* 2. Filter & Actions Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 border-b border-card-border pb-4 mt-2">
        {/* Left: Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <span className="text-xs-portal font-bold text-gray-400 uppercase tracking-wider shrink-0 select-none mr-2">
            Filter by
          </span>
          {[
            "All",
            "Occupied",
            "Vacant",
            "Compliance Issues",
            "Maintenance Issues",
            "Rent Arrears",
            "Expiring Compliance",
          ].map((filt) => (
            <Chip
              key={filt}
              active={activeFilter === filt}
              onClick={() => setActiveFilter(filt)}
            >
              {filt}
            </Chip>
          ))}
        </div>

        {/* Right: Search & View Toggle */}
        <div className="flex items-center gap-4">
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search properties by address..."
              className="w-full sm:w-[240px] pl-9 pr-4 py-1.5 text-xs-portal card-bg border border-card-border focus:border-gray-400 rounded-md focus:outline-none transition-colors"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-card-border rounded-md overflow-hidden card-bg select-none">
            <Button
            variant="light"
              onClick={() => setViewMode("card")}
              className={`p-2 flex items-center justify-center cursor-pointer transition-colors ${
                viewMode === "card"
                  ? "bg-surface-light text-status-info"
                  : "text-gray-400 hover:text-status-muted"
              }`}
              title="Card View"
            >
              <Grid size={16} />
              <span className="text-xs-portal font-bold ml-1 hidden sm:inline">
                Card View
              </span>
            </Button>
            <div className="w-[1px] h-6 bg-card-border" />
            <Button
            variant="light"
              onClick={() => setViewMode("table")}
              className={`p-2 flex items-center justify-center cursor-pointer transition-colors ${
                viewMode === "table"
                  ? "bg-surface-light text-status-info"
                  : "text-gray-400 hover:text-status-muted"
              }`}
              title="Table View"
            >
              <List size={16} />
              <span className="text-xs-portal font-bold ml-1 hidden sm:inline">
                Table View
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Main Content: Properties List */}
      <div>
        {filteredProperties.length === 0 ? (
          <div className="card-bg border border-card-border rounded-card p-12 text-center text-gray-400 font-medium">
            No properties found matching the selected filters.
          </div>
        ) : viewMode === "table" ? (
          <div className="card-bg border border-card-border rounded-card p-4 shadow-sm">
            <DataTable columns={tableColumns} data={filteredProperties} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredProperties.map((p) => (
              <div
                key={p.id}
                className="card-bg border border-card-border rounded-card p-4 flex flex-col lg:flex-row gap-6 hover:border-gray-300 transition-colors duration-150 shadow-xs relative"
              >
                {/* Image Section */}
                <div className="w-full lg:w-[220px] h-[135px] rounded-sm overflow-hidden shrink-0 border border-card-border shadow-sm bg-surface-light">
                  <img
                    src={p.image}
                    alt={p.address_line1}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `${import.meta.env.BASE_URL}images/img1.jpg`; // fallback
                    }}
                  />
                </div>

                {/* Details Grid Section */}
                <div className="flex-grow flex flex-col justify-between min-w-0 py-0.5">
                  <div>
                    <h3 className="text-sm-portal font-extrabold text-brand-primary leading-tight tracking-tight">
                      {p.name || p.address_line1}
                    </h3>
                    <span className="text-xs-portal font-semibold text-gray-400 mt-1 block">
                      {p.property_reference || `Property #${p.id}`} • {p.city},{" "}
                      {p.postcode}
                    </span>
                  </div>{" "}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 border-t border-card-border pt-3">
                    <div className="flex flex-col">
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                        Property Type
                      </span>
                      <span className="text-xs-portal font-bold text-brand-primary mt-1 leading-none">
                        {p.property_type || "Apartment"}
                      </span>
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none mt-4.5">
                        Status
                      </span>
                      <span className="text-xs-portal font-bold text-brand-primary mt-1 leading-none flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            p.status === "let"
                              ? "bg-status-success"
                              : p.status === "onboarding"
                                ? "bg-status-info"
                                : "bg-status-warning"
                          }`}
                        />
                        {p.status === "let"
                          ? "Occupied"
                          : p.status === "onboarding"
                            ? "Onboarding"
                            : "Vacant"}
                      </span>
                    </div>

                    <div className="flex flex-col border-l border-card-border pl-6">
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                        Tenancy Type
                      </span>
                      <span className="text-xs-portal font-bold text-brand-primary mt-1 leading-none">
                        {p.tenancy_type}
                      </span>
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none mt-4.5">
                        Tenancy Start Date
                      </span>
                      <span className="text-xs-portal font-bold text-brand-primary mt-1 leading-none">
                        {p.start_date}
                      </span>
                    </div>
                  </div>
                  {/* Tenant & Rent Review Footer row inside the layout */}
                  <div className="grid grid-cols-2 gap-x-6 mt-4 border-t border-card-border pt-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-5.5 h-5.5 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                          Tenant
                        </span>
                        <span className="text-xs-portal font-bold text-brand-primary truncate mt-0.5 leading-none">
                          {p.tenant_name}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col border-l border-card-border pl-6">
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                        Next Rent Review
                      </span>
                      <span className="text-xs-portal font-bold text-brand-primary mt-0.5 leading-none">
                        {p.next_review}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metrics Columns Section */}
                <div className="w-full lg:w-[380px] flex items-center justify-between shrink-0 border-t lg:border-t-0 lg:border-l border-card-border pt-4 lg:pt-0 lg:pl-6 gap-4">
                  {/* Monthly Rent & Deposit Column */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                        Monthly Rent
                      </span>
                      <span className="text-sm-portal font-bold text-brand-primary mt-1.5 block leading-none">
                        £{Number(p.rent).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {p.status === "let" && (
                        <span className="text-2xs text-status-success font-semibold mt-1 block leading-none">
                          Protected
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                        Maintenance
                      </span>
                      <span
                        className={`text-xs-portal font-bold mt-1.5 block leading-none ${
                          p.maintenance_issues > 0
                            ? "text-status-warning"
                            : "text-status-success"
                        }`}
                      >
                        {p.maintenance_issues > 0
                          ? `${p.maintenance_issues} Open Issue`
                          : "No Issues"}
                      </span>
                    </div>
                  </div>

                  {/* Deposit Held & Net Paid Column */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                        Deposit Held
                      </span>
                      <span className="text-sm-portal font-bold text-brand-primary mt-1.5 block leading-none">
                        £{Number(p.deposit_amount).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-2xs text-status-success font-semibold mt-1 block leading-none">
                        {p.deposit_status}
                      </span>
                    </div>
                    <div>
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                        Net Paid This Month
                      </span>
                      <span className="text-sm-portal font-bold text-brand-primary mt-1.5 block leading-none">
                        £{Number(p.net_paid).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Compliance Column */}
                  <div className="flex flex-col items-center justify-center self-center pr-2 shrink-0">
                    <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                      Compliance
                    </span>
                    <span
                      className={`text-sm font-extrabold mt-1.5 block leading-none ${
                        p.compliance_pct === 100
                          ? "text-status-success"
                          : "text-status-warning"
                      }`}
                    >
                      {p.compliance_pct}%
                    </span>
                    <span
                      className={`text-2xs font-bold mt-1 block leading-none ${
                        p.compliance_pct === 100
                          ? "text-status-success"
                          : "text-status-warning"
                      }`}
                    >
                      {p.compliance_pct === 100
                        ? "Compliant"
                        : "Action Required"}
                    </span>
                  </div>
                </div>

                {/* View Actions Section */}
                <div className="flex flex-row lg:flex-col items-center justify-end lg:justify-center gap-3 shrink-0 border-t lg:border-t-0 lg:border-l border-card-border pt-4 lg:pt-0 lg:pl-4 self-stretch">
                  <Button
                    variant="light"
                    size="sm"
                    onClick={() => navigate(`/properties/${p.id}`)}
                    icon={ChevronRight}
                    iconPosition="right"
                    className="w-full lg:w-auto text-xs-portal font-extrabold whitespace-nowrap"
                  >
                    View Property
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Bottom Grid: Financial, Compliance & Tenancy Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
        {/* Card 1: Financial Summary */}
        <PortalCard title="financial summary (latest statements)">
          <div className="flex-grow flex flex-col text-xs-portal gap-2.5 mt-2">
            <div className="flex justify-between items-center border-b border-card-border pb-1.5">
              <span className="text-gray-400 font-medium">
                Monthly Rent Roll
              </span>
              <span className="font-mono font-bold text-brand-primary">
                £{monthlyGrossYield.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-card-border pb-1.5">
              <span className="text-gray-400 font-medium">
                Gross Rent Invoiced
              </span>
              <span className="font-mono font-bold text-brand-primary">
                £{financialSummary.grossInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-card-border pb-1.5">
              <span className="text-gray-400 font-medium">
                Deductions &amp; Fees
              </span>
              <span className="font-mono font-bold text-brand-primary">
                £{financialSummary.deductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center pb-1">
              <span className="text-gray-400 font-medium">Net Income</span>
              <span className="font-mono font-bold text-brand-primary">
                £{financialSummary.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="mt-auto pt-4 flex items-center">
            <Button
              onClick={() => navigate("/financials")}
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
                Properties Compliant
              </span>
              <span className="font-mono font-bold text-brand-primary">
                {complianceSummary.compliantCount} ({complianceSummary.compliantPct}%)
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-card-border pb-1.5">
              <span className="text-gray-400 font-medium">
                Certificates Expiring
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-status-warning">
                  {complianceSummary.expiringCerts}
                </span>
                <span className="text-2xs text-gray-400">Expiring soon</span>
              </div>
            </div>
            <div className="flex justify-between items-center pb-1">
              <span className="text-gray-400 font-medium">
                Certificates Expired
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-status-danger">
                  {complianceSummary.expiredCerts}
                </span>
                <span className="text-2xs text-gray-400">Need renewal</span>
              </div>
            </div>
          </div>
          <div className="mt-auto pt-4 flex items-center">
            <Button
              onClick={() => navigate("/compliance/overview")}
              className="text-xs-portal font-bold text-status-info hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              View Compliance <ChevronRight size={12} />
            </Button>
          </div>
        </PortalCard>

        {/* Card 3: Tenancy Summary */}
        <PortalCard title="tenancy summary">
          <div className="flex-grow flex flex-col text-xs-portal gap-2.5 mt-2">
            <div className="flex justify-between items-center border-b border-card-border pb-1.5">
              <span className="text-gray-400 font-medium">Occupied</span>
              <span className="font-mono font-bold text-brand-primary">
                {occupiedCount} ({occupiedPct}%)
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-card-border pb-1.5">
              <span className="text-gray-400 font-medium">Vacant</span>
              <span className="font-mono font-bold text-brand-primary">
                {vacantCount} ({vacantPct}%)
              </span>
            </div>
            <div className="flex justify-between items-center pb-1">
              <span className="text-gray-400 font-medium">
                Average Tenancy Length
              </span>
              <span className="font-mono font-bold text-brand-primary">
                {avgTenancyMonths != null ? `${avgTenancyMonths.toFixed(1)} months` : "—"}
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
    </div>
  );
};
