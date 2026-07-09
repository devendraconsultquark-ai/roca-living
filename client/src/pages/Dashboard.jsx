import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  Wrench,
  Clock,
  Check,
  ChevronRight,
  Wallet,
  Download,
  Sparkles,
  User,
  AlertCircle,
} from "lucide-react";
import { useDashboard } from "../hooks/useDashboard";
import { useProperties } from "../hooks/useProperties";
import { useInspections } from "../hooks/useInspections";
import { PortalCard } from "../components/UI/PortalCard";
import { TimelineItem } from "../components/UI/TimelineItem";
import { Button } from "../components/UI/Button";
import { Dropdown } from "../components/UI/Dropdown";
import { useMaintenance } from "../hooks/useMaintenance";
import { useTenancy } from "../hooks/useTenancy";
import { useDocuments } from "../hooks/useDocuments";
import { useUtilities } from "../hooks/useUtilities";

export const Dashboard = () => {
  const navigate = useNavigate();

  // Real hooks data
  const {
    latestStatement,
    activeTenancy,
    loading: dashboardLoading,
    error,
    rentReceived,
    netIncome,
    totalFees,
    deductions,
    hasActiveTenancy,
  } = useDashboard();

  const { properties, loading: propertiesLoading } = useProperties();
  const { inspections, loading: inspectionsLoading } = useInspections();
  const { quotes } = useMaintenance();
  const { tenancies } = useTenancy();
  const { documents } = useDocuments();
  const { utilities } = useUtilities();

  const [selectedPeriod, setSelectedPeriod] = useState("this_month");

  const periodOptions = [
    { value: "this_month", label: "This Month" },
    { value: "last_month", label: "Last Month" },
    { value: "ytd", label: "Year to Date" },
  ];

  const loading = dashboardLoading || propertiesLoading || inspectionsLoading;

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 animate-pulse">
        <div className="h-8 bg-surface-hover rounded-lg w-1/3" />
        <div className="h-4 bg-surface-light rounded-lg w-1/4 mt-1" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="h-[320px] bg-surface-hover/60 rounded-2xl" />
            <div className="h-[200px] bg-surface-hover/60 rounded-2xl" />
          </div>
          <div className="lg:col-span-3 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-[220px] bg-surface-hover/60 rounded-2xl" />
              <div className="h-[220px] bg-surface-hover/60 rounded-2xl" />
            </div>
            <div className="h-[140px] bg-surface-hover/60 rounded-2xl" />
            <div className="h-[140px] bg-surface-hover/60 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // Derive compliance score dynamically
  let expiredCertifications = 0;
  let totalCertificationsTracked = 0;

  properties.forEach((p) => {
    if (p.gasCompliance) {
      totalCertificationsTracked++;
      if (p.gasCompliance === "expired") expiredCertifications++;
    }
    if (p.eicrCompliance) {
      totalCertificationsTracked++;
      if (p.eicrCompliance === "expired") expiredCertifications++;
    }
    if (p.epcCompliance) {
      totalCertificationsTracked++;
      if (p.epcCompliance === "expired") expiredCertifications++;
    }
  });

  const overallCompliancePct = totalCertificationsTracked
    ? Math.round(
        ((totalCertificationsTracked - expiredCertifications) /
          totalCertificationsTracked) *
          100,
      )
    : 100;

  // Key Dates collection
  const keyDates = [];
  if (activeTenancy?.start_date) {
    keyDates.push({
      title: "Tenancy Start",
      subTitle: new Date(activeTenancy.start_date).toLocaleDateString("en-GB"),
      rightText: "Active",
      icon: Calendar,
      variant: "info",
    });
  }
  if (activeTenancy?.end_date) {
    keyDates.push({
      title: "Tenancy Expiry",
      subTitle: new Date(activeTenancy.end_date).toLocaleDateString("en-GB"),
      rightText: "Expires soon",
      icon: Calendar,
      variant: "neutral",
    });
  }
  inspections
    .filter((i) => !i.date || i.date === "—")
    .forEach((i) => {
      if (i.next_inspection_due) {
        keyDates.push({
          title: "Next Inspection",
          subTitle: new Date(i.next_inspection_due).toLocaleDateString("en-GB"),
          rightText: "Scheduled",
          icon: Calendar,
          variant: "neutral",
        });
      }
    });

  // Recent activity list derived dynamically
  const activities = [];
  if (latestStatement) {
    activities.push({
      title: "Payout Disbursed",
      subTitle: `£${parseFloat(latestStatement.net_paid).toLocaleString(undefined, { minimumFractionDigits: 2 })} payout processed`,
      date: latestStatement.period_start
        ? new Date(latestStatement.period_start).toLocaleDateString("en-GB")
        : "—",
      icon: Wallet,
      variant: "success",
    });
  }
  inspections
    .filter((i) => i.date && i.date !== "—")
    .slice(0, 2)
    .forEach((i) => {
      activities.push({
        title: "Inspection Completed",
        subTitle: `Routine inspection completed by ${i.inspector}`,
        date: i.date,
        icon: Calendar,
        variant: "neutral",
      });
    });

  if (documents) {
    documents.slice(0, 2).forEach((d) => {
      activities.push({
        title: "Document Uploaded",
        subTitle: d.item,
        date: d.uploaded,
        icon: Clock,
        variant: "info",
      });
    });
  }

  if (utilities) {
    utilities.slice(0, 2).forEach((u) => {
      activities.push({
        title: "Utility Logged",
        subTitle: `${u.utility_type?.replace("_", " ") || "Utility"} record created for ${u.property_name || "property"}`,
        date: u.created_at ? new Date(u.created_at).toLocaleDateString("en-GB") : "—",
        icon: Wrench,
        variant: "neutral",
      });
    });
  }

  // Active alerts list calculated dynamically from real states
  const alertsList = [];

  // 1. Safety Certificate Expired (Only push if expiredCertifications > 0)
  if (expiredCertifications > 0) {
    alertsList.push({
      title: "Safety Certificate Expired",
      detail: `${expiredCertifications} action required safety documents expired`,
      subText: "Compliance warning",
      variant: "danger",
      icon: AlertCircle,
      onClick: () => navigate("/compliance/overview"),
      subTextColor: "text-status-danger",
    });
  }

  // 2. Inspection Due / Overdue (Always visible)
  const overdueInspections = inspections.filter((i) => {
    const hasBeenCompleted = i.date && i.date !== "—";
    if (hasBeenCompleted) return false;
    if (!i.next_inspection_due) return false;
    return new Date(i.next_inspection_due) < new Date();
  });

  const upcomingInspections = inspections.filter((i) => {
    const hasBeenCompleted = i.date && i.date !== "—";
    return !hasBeenCompleted && i.next_inspection_due;
  });

  if (overdueInspections.length > 0) {
    alertsList.push({
      title: "Inspection Overdue",
      detail: `${overdueInspections.length} inspection(s) past due date`,
      subText: overdueInspections[0].next_inspection_due
        ? new Date(
            overdueInspections[0].next_inspection_due,
          ).toLocaleDateString("en-GB")
        : "—",
      variant: "danger",
      icon: Calendar,
      onClick: () => navigate("/compliance/inspections"),
      subTextColor: "text-status-danger",
    });
  } else if (upcomingInspections.length > 0) {
    alertsList.push({
      title: "Inspection Due",
      detail: "Routine inspection is due",
      subText: upcomingInspections[0].next_inspection_due
        ? new Date(
            upcomingInspections[0].next_inspection_due,
          ).toLocaleDateString("en-GB")
        : "—",
      variant: "warning",
      icon: Calendar,
      onClick: () => navigate("/compliance/inspections"),
      subTextColor: "text-status-info",
    });
  } else {
    alertsList.push({
      title: "Inspection Due",
      detail: "No inspections scheduled",
      subText: "—",
      variant: "neutral",
      icon: Calendar,
      onClick: () => navigate("/compliance/inspections"),
      subTextColor: "text-gray-400",
    });
  }

  // 3. Maintenance Approval Required (Always visible)
  if (quotes && quotes.length > 0) {
    alertsList.push({
      title: "Maintenance Approval Required",
      detail: quotes[0].description || "Pending maintenance quote",
      subText: `£${quotes[0].cost.toFixed(2)}`,
      variant: "warning",
      icon: Wrench,
      onClick: () => navigate("/maintenance"),
      hasAction: true,
      actionText: "Review",
      subTextColor: "text-brand-primary font-bold",
    });
  } else {
    alertsList.push({
      title: "Maintenance Approval Required",
      detail: "No maintenance quotes awaiting approval",
      subText: "£0.00",
      variant: "neutral",
      icon: Wrench,
      onClick: () => navigate("/maintenance"),
      hasAction: false,
      subTextColor: "text-gray-400",
    });
  }

  // 4. Rent Review Due (Always visible)
  if (activeTenancy && activeTenancy.start_date) {
    const startDate = new Date(activeTenancy.start_date);
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    if (startDate < oneYearAgo) {
      const nextReviewDate = new Date(startDate);
      nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1);
      alertsList.push({
        title: "Rent Review Due",
        detail: "Tenancy active over a year. Rent review recommended.",
        subText: nextReviewDate.toLocaleDateString("en-GB"),
        variant: "warning",
        icon: Clock,
        onClick: () => navigate("/properties"),
        subTextColor: "text-status-info",
      });
    } else {
      const nextReviewDate = new Date(startDate);
      nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1);
      alertsList.push({
        title: "Rent Review Due",
        detail: "Rent review is due in 6 months",
        subText: nextReviewDate.toLocaleDateString("en-GB"),
        variant: "neutral",
        icon: Clock,
        onClick: () => navigate("/properties"),
        subTextColor: "text-status-info",
      });
    }
  } else {
    alertsList.push({
      title: "Rent Review Due",
      detail: "Rent review up to date",
      subText: "—",
      variant: "neutral",
      icon: Clock,
      onClick: () => navigate("/properties"),
      subTextColor: "text-gray-400",
    });
  }

  // Count active alerts (excluding 'neutral' status)
  const activeAlertsCount = alertsList.filter(
    (a) => a.variant !== "neutral",
  ).length;

  return (
    <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 font-sans text-brand-primary">
      {error && (
        <div className="border border-status-danger bg-status-danger/5 rounded-card p-4 text-center text-status-danger font-semibold">
          {error}
        </div>
      )}

      {/* 3. Top Section: Property, Compliance & Financials (3 Equal Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
        {/* Card 1: Property Performance */}
        <PortalCard title="Property Performance">
          <div className="flex gap-4 mt-2">
            {/* Left: Building Photo */}
            <div className="w-[140px] h-[155px] rounded-sm overflow-hidden shrink-0 border border-card-border shadow-sm bg-surface-light flex items-center justify-center">
              <img
                src={
                  properties[0]?.image_url ||
                  `${import.meta.env.BASE_URL}images/block_img.jpg`
                }
                alt="Property"
                className="w-full h-full object-cover image-render-smooth"
              />
            </div>

            {/* Right: Tenant & Rent Details */}
            <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5 select-none text-left">
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-0.5 text-2xs rounded-full select-none ${
                      hasActiveTenancy
                        ? "text-status-success bg-status-success-bg"
                        : "text-gray-400 bg-surface-hover"
                    }`}
                  >
                    {hasActiveTenancy ? "Occupied" : "Vacant"}
                  </span>
                </div>

                {/* Tenant Info */}
                <div className="mt-3 flex items-center gap-1.5 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                      Tenant
                    </span>
                    <span className="text-sm-portal font-bold text-brand-primary truncate mt-1 leading-none">
                      {activeTenancy?.lead_tenant_name || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rent & Deposit Row */}
              <div className="grid grid-cols-2 gap-2 mt-auto border-t border-card-border pt-2">
                <div className="flex flex-col">
                  <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                    Monthly Rent
                  </span>
                  <span className="text-sm-portal font-bold text-brand-primary mt-1.5 leading-none">
                    {activeTenancy?.rent_pcm
                      ? `£${parseFloat(activeTenancy.rent_pcm).toFixed(0)}`
                      : "—"}
                  </span>
                  <span className="text-2xs text-gray-400 mt-1 leading-none">
                    Due 1st Monthly
                  </span>
                </div>
                <div className="flex flex-col border-l border-card-border pl-2">
                  <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">
                    Deposit Held
                  </span>
                  <span className="text-sm-portal font-bold text-brand-primary mt-1.5 leading-none">
                    {activeTenancy?.deposit_amount
                      ? `£${parseFloat(activeTenancy.deposit_amount).toFixed(0)}`
                      : "—"}
                  </span>
                  <span className="text-2xs text-gray-400 mt-1 leading-none">
                    {activeTenancy?.deposit_scheme || "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Paid This Month banner */}
          <div className="mt-4 pt-3 border-t border-card-border flex items-center justify-between select-none">
            <div className="flex flex-col text-left">
              <span className="text-2xs text-brand-primary tracking-wider leading-none">
                Net Paid This Month
              </span>
            </div>
            <span className="text-lg font-bold text-brand-primary font-mono leading-none">
              {netIncome !== undefined && netIncome !== null
                ? `£${parseFloat(netIncome).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                : "£0.00"}
            </span>
          </div>

          {/* View Property Footer Action */}
          <div className="mt-auto pt-4">
            <Button
              variant="light"
              size="sm"
              fullWidth
              onClick={() => navigate("/properties")}
              icon={ChevronRight}
              iconPosition="right"
            >
              View Property
            </Button>
          </div>
        </PortalCard>

        {/* Card 2: Compliance Overview */}
        <PortalCard title="Compliance Overview">
          <div className="flex flex-col gap-2 mt-2 select-none text-left">
            <div className="flex justify-between items-center py-2 border-b border-card-border">
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 ${expiredCertifications > 0 ? "text-status-danger" : "text-status-success"}`}
                />
                <span className="text-sm-portal font-bold text-brand-primary">
                  Property Compliance
                </span>
              </div>
              <span className="text-sm-portal font-bold text-brand-primary font-mono">
                {overallCompliancePct}%
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-card-border">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                <span className="text-sm-portal font-bold text-brand-primary">
                  Tenant Compliance
                </span>
              </div>
              <span className="text-sm-portal font-bold text-brand-primary font-mono">
                100%
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-card-border">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                <span className="text-sm-portal font-bold text-brand-primary">
                  Documentation Compliance
                </span>
              </div>
              <span className="text-sm-portal font-bold text-brand-primary font-mono">
                100%
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-card-border">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                <span className="text-sm-portal font-bold text-brand-primary">
                  Deposit Compliance
                </span>
              </div>
              <span className="text-sm-portal font-bold text-brand-primary font-mono">
                100%
              </span>
            </div>
          </div>

          {/* Centered big compliance indicator */}
          <div className="flex flex-col items-center justify-center mt-3 pt-1 text-center select-none">
            <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider">
              Overall Compliance
            </span>
            <span
              className={`text-3xl font-extrabold mt-0.5 leading-none ${expiredCertifications > 0 ? "text-status-danger" : "text-status-success"}`}
            >
              {overallCompliancePct}%
            </span>
            <span
              className={`text-2xs font-bold mt-1 uppercase tracking-wider ${expiredCertifications > 0 ? "text-status-danger" : "text-status-success"}`}
            >
              {expiredCertifications > 0
                ? "Action Required"
                : "Fully Compliant"}
            </span>
          </div>

          {/* View Compliance Footer Action */}
          <div className="mt-auto pt-4">
            <Button
              variant="light"
              size="sm"
              fullWidth
              onClick={() => navigate("/compliance/overview")}
              icon={ChevronRight}
              iconPosition="right"
            >
              View Compliance
            </Button>
          </div>
        </PortalCard>

        {/* Card 3: Financial Summary */}
        <PortalCard
          title="Financial Summary"
          headerActions={
            <Dropdown
              options={periodOptions}
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              size="sm"
              variant="ghost"
              className="w-[130px] text-status-muted font-bold"
            />
          }
        >
          <div className="flex items-start gap-3 mt-2 text-left">
            {/* Wallet Icon */}
            <div className="w-9 h-9 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
              <Wallet className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1 flex flex-col text-xs-portal select-none">
              <div className="flex justify-between items-center py-1">
                <span className="text-status-muted font-medium">
                  Rent Received
                </span>
                <span className="font-bold text-brand-primary font-mono">
                  {rentReceived !== undefined && rentReceived !== null
                    ? `£${parseFloat(rentReceived).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : "£0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-status-muted font-medium">
                  Deductions
                </span>
                <span className="font-bold text-brand-primary font-mono">
                  {deductions !== undefined && deductions !== null
                    ? `£${parseFloat(deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : "£0.00"}
                </span>
              </div>

              <div className="border-t border-card-border my-1"></div>

              <div className="flex justify-between items-center py-1.5">
                <span className="text-status-muted font-bold">
                  Total Fees Paid
                </span>
                <span className="font-bold text-brand-primary font-mono text-sm-portal">
                  {totalFees !== undefined && totalFees !== null
                    ? `£${parseFloat(totalFees).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : "£0.00"}
                </span>
              </div>

              <div className="border-t border-card-border my-1"></div>

              <div className="flex justify-between items-baseline py-1">
                <span className="text-status-muted font-bold">Net Paid</span>
                <div className="flex flex-col items-end">
                  <span className="text-base font-extrabold text-brand-primary font-mono">
                    {netIncome !== undefined && netIncome !== null
                      ? `£${parseFloat(netIncome).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : "£0.00"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-auto pt-4 grid grid-cols-2 gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate("/financials")}
              icon={ChevronRight}
              iconPosition="right"
            >
              View Financials
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              iconPosition="right"
            >
              Download Statement
            </Button>
          </div>
        </PortalCard>
      </div>

      {/* 4. Alerts & Actions Carousel Section */}
      <div className="flex flex-col gap-3 mt-4">
        {/* Section Heading */}
        <div className="flex justify-between items-center border-b border-card-border pb-2 select-none">
          <div className="flex items-center gap-2">
            <h3 className="text-base-portal font-bold text-brand-primary tracking-tight">
              Alerts & Actions
            </h3>
            <span className="w-5 h-5 rounded-full bg-status-danger text-white text-xs-portal font-extrabold flex items-center justify-center select-none">
              {activeAlertsCount}
            </span>
          </div>
          <Button
            onClick={() => navigate("/compliance/overview")}
            className="text-xs-portal font-bold text-status-info hover:underline flex items-center cursor-pointer"
          >
            View All Alerts <ChevronRight size={12} className="ml-0.5" />
          </Button>
        </div>

        {/* Dynamic Alert Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {alertsList.map((alert, idx) => (
            <div
              key={idx}
              onClick={alert.onClick}
              className="card-bg border border-card-border rounded-card p-4 flex items-center justify-between hover:border-gray-300 transition-colors duration-150 shadow-xs text-left select-none cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    alert.variant === "danger"
                      ? "bg-status-danger-bg text-status-danger"
                      : alert.variant === "warning"
                        ? "bg-status-warning/10 text-status-warning"
                        : "bg-status-info-bg text-status-info"
                  }`}
                >
                  <alert.icon size={18} />
                </div>
                <div className="flex flex-col min-w-0 text-left">
                  <span className="text-sm-portal font-bold text-brand-primary truncate leading-tight">
                    {alert.title}
                  </span>
                  <span className="text-xs-portal text-gray-400 mt-0.5 truncate leading-none">
                    {alert.detail}
                  </span>
                  <span
                    className={`text-xs-portal font-bold mt-1.5 leading-none ${alert.subTextColor || "text-status-info"}`}
                  >
                    {alert.subText}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {alert.hasAction && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      alert.onClick();
                    }}
                    className="bg-black text-white hover:bg-slate-900 text-2xs font-semibold py-1.5 px-3 rounded transition-colors cursor-pointer shadow-sm"
                  >
                    {alert.actionText || "Review"}
                  </Button>
                )}
                <ChevronRight size={16} className="text-sidebar-text-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Bottom Row: Recent Activity, Key Dates & Marketing Banner (3 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
        {/* Card 1: Recent Activity */}
        <PortalCard
          title="Recent Activity"
          headerActions={
            <Button
              onClick={() => navigate("/statements")}
              className="text-xs-portal font-bold text-status-info hover:underline cursor-pointer"
            >
              View All Activity
            </Button>
          }
        >
          <div className="flex flex-col select-none text-left">
            {activities.length === 0 ? (
              <div className="text-xs-portal text-gray-400 font-semibold py-4 text-center">
                No recent activity logged
              </div>
            ) : (
              activities.map((act, idx) => (
                <TimelineItem
                  key={idx}
                  title={act.title}
                  subTitle={act.subTitle}
                  date={act.date}
                  icon={act.icon}
                  variant={act.variant}
                />
              ))
            )}
          </div>
        </PortalCard>

        {/* Card 2: Key Dates */}
        <PortalCard
          title="Key Dates"
          headerActions={
            <Button
              onClick={() => navigate("/compliance/inspections")}
              className="text-xs-portal font-bold text-status-info hover:underline cursor-pointer"
            >
              View Calendar
            </Button>
          }
        >
          <div className="flex flex-col select-none text-left">
            {keyDates.length === 0 ? (
              <div className="text-xs-portal text-gray-400 font-semibold py-4 text-center">
                No upcoming key dates
              </div>
            ) : (
              keyDates.map((kd, idx) => (
                <TimelineItem
                  key={idx}
                  title={kd.title}
                  subTitle={kd.subTitle}
                  rightText={kd.rightText}
                  icon={kd.icon}
                  variant={kd.variant}
                />
              ))
            )}
          </div>
        </PortalCard>

        {/* Card 3: Premium Banner */}
        <div className="bg-sidebar-bg border border-gray-800 rounded-card p-6 shadow-premium relative flex flex-col justify-between overflow-hidden select-none">
          {/* Header row with Premium tag */}
          <div className="flex items-center justify-between">
            <h4 className="text-xs-portal font-bold text-sidebar-text-muted uppercase tracking-wider">
              Investment & Portfolio Reporting
            </h4>
            <span className="px-2.5 py-0.5 text-2xs font-extrabold bg-status-info rounded-full text-white select-none">
              PREMIUM
            </span>
          </div>

          {/* Subtext and visual spark icon */}
          <div className="mt-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full card-bg/5 border border-white/10 flex items-center justify-center shrink-0 text-white">
              <Sparkles className="w-4.5 h-4.5 text-blue-400" />
            </div>
            <p className="text-xs-portal text-gray-400 leading-snug text-left">
              Unlock advanced analytics and tax-ready reporting.
            </p>
          </div>

          {/* Feature Checklist */}
          <div className="mt-4 flex flex-col gap-2 text-left">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-xs-portal text-sidebar-text-muted font-medium">
                Performance analytics
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-xs-portal text-sidebar-text-muted font-medium">
                Tax reports & accountant pack
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-xs-portal text-sidebar-text-muted font-medium">
                Yield & ROI analysis
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-xs-portal text-sidebar-text-muted font-medium">
                Void & arrears insights
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-xs-portal text-sidebar-text-muted font-medium">
                Portfolio reporting
              </span>
            </div>
          </div>

          {/* Upgrade Now Button */}
          <div className="mt-6">
            <Button
              variant="light"
              size="sm"
              fullWidth
              onClick={() => {}}
              icon={ChevronRight}
              iconPosition="right"
            >
              Upgrade Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
