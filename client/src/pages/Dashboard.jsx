import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Check,
  ChevronRight,
  Wallet,
  Download,
  Sparkles,
  User,
} from "lucide-react";
import { useDashboard } from "../hooks/useDashboard";
import { PortalCard } from "../components/UI/PortalCard";
import { TimelineItem } from "../components/UI/TimelineItem";
import { Button } from "../components/UI/Button";
import { Dropdown } from "../components/UI/Dropdown";
import { Skeleton } from "../components/UI/Skeleton";
import { useToast } from "../components/UI/ToastContext";

export const Dashboard = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const comingSoon = () => addToast("This feature is coming soon.", "info");

  // Everything data/derived — financial figures, compliance score, key dates,
  // the activity feed and the alerts list — lives in the hook; this component
  // only renders and handles navigation.
  const {
    activeTenancy,
    hasActiveTenancy,
    properties,
    error,
    loading,
    rentReceived,
    netIncome,
    expenditure,
    deductions,
    expiredCertifications,
    overallCompliancePct,
    keyDates,
    activities,
    alertsList,
    activeAlertsCount,
  } = useDashboard();

  // Local, ephemeral UI state (the period selector doesn't drive data yet).
  const [selectedPeriod, setSelectedPeriod] = useState("this_month");
  const periodOptions = [
    { value: "this_month", label: "This Month" },
    { value: "last_month", label: "Last Month" },
    { value: "ytd", label: "Year to Date" },
  ];

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8">
        <Skeleton radius="bar" className="h-8 w-1/3" />
        <Skeleton radius="bar" className="h-4 w-1/4 mt-1" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Skeleton className="h-[320px]" />
            <Skeleton className="h-[200px]" />
          </div>
          <div className="lg:col-span-3 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-[220px]" />
              <Skeleton className="h-[220px]" />
            </div>
            <Skeleton className="h-[140px]" />
            <Skeleton className="h-[140px]" />
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
                    className={`px-2 py-0.5 text-2xs rounded-full select-none ${hasActiveTenancy
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
                  Total Expenditure
                </span>
                <span className="font-bold text-brand-primary font-mono text-sm-portal">
                  {expenditure !== undefined && expenditure !== null
                    ? `£${parseFloat(expenditure).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
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
            variant="primary"
            size="sm"
            icon={ChevronRight}
            iconPosition="right"
            onClick={() => navigate("/compliance/overview")}
          >
            View All Alerts
          </Button>
        </div>

        {/* Dynamic Alert Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {alertsList.map((alert, idx) => (
            <div
              key={idx}
              onClick={() => navigate(alert.route)}
              className="card-bg border border-card-border rounded-card p-4 flex items-center justify-between hover:border-gray-300 transition-colors duration-150 shadow-xs text-left select-none cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${alert.variant === "danger"
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
                      navigate(alert.route);
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
              variant="primary"
              size="sm"
              iconPosition="right"
              icon={ChevronRight}
              onClick={() => navigate("/statements")}
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
              variant="primary"
              size="sm"
              icon={ChevronRight}
              iconPosition="right"
              onClick={() => navigate("/compliance/inspections")}
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
              onClick={comingSoon}
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
