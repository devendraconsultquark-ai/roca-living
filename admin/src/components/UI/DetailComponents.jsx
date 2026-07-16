import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, Trash2, CheckCircle2, AlertTriangle, HelpCircle, Clock
} from 'lucide-react';
import { Skeleton } from './Skeleton';

export const DataRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
    <div className="flex items-center gap-3 text-status-muted">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-light border border-card-border text-status-muted">
        {Icon && <Icon size={14} />}
      </div>
      <span className="text-xs-portal font-semibold">{label}</span>
    </div>
    <span className="text-xs-portal font-bold text-brand-primary text-right max-w-[50%] truncate" title={typeof value === 'string' ? value : ''}>
      {value || '—'}
    </span>
  </div>
);

export const Card = ({ title, children }) => (
  <div className="card-bg rounded-card p-6 shadow-premium border border-card-border">
    <h3 className="text-base-portal font-semibold text-brand-primary tracking-tight mb-4">{title}</h3>
    {children}
  </div>
);

export const DetailContainer = ({ children, className = '' }) => (
  <div className={`w-full flex flex-col bg-app-bg min-h-[calc(100vh-64px)] p-8 pt-10 ${className}`}>
    {children}
  </div>
);

export const DetailSkeleton = () => (
  <div className="py-8 max-w-[1440px] mx-auto px-8 flex flex-col gap-5 w-full">
    <Skeleton radius="bar" className="h-8 w-48 mb-6" />
    <Skeleton radius="card" className="h-24 mb-8" />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Skeleton className="lg:col-span-2 h-64" />
      <Skeleton className="lg:col-span-1 h-64" />
    </div>
  </div>
);

export const DetailHeader = ({
  backPath,
  backLabel,
  title,
  badge,
  subtitle,
  editLabel = 'Edit',
  onEdit,
  onDelete,
  deleteLabel = 'Delete'
}) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-4">
      <div className="flex flex-col gap-2">
        {backPath && (
          <button
            onClick={() => navigate(backPath)}
            className="flex items-center gap-1.5 text-xs-portal font-bold text-status-info hover:underline transition-colors w-fit mb-2 cursor-pointer"
          >
            <ArrowLeft size={16} />
            {backLabel}
          </button>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-brand-primary tracking-tight">{title}</h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider mt-1">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {editLabel && (
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 card-bg border border-card-border text-ink rounded-card hover:bg-gray-50 transition-colors text-sm-portal font-semibold shadow-xs cursor-pointer"
          >
            <Edit size={15} />
            {editLabel}
          </button>
        )}
        {deleteLabel && (
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2 card-bg border border-status-danger/20 text-status-danger rounded-card hover:bg-status-danger/5 transition-colors text-sm-portal font-semibold shadow-xs cursor-pointer"
          >
            <Trash2 size={15} />
            {deleteLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export const DetailTabs = ({ tabs, activeTab, setActiveTab }) => {
  return (
    <div className="flex items-center gap-6 border-b border-card-border mb-6 overflow-x-auto no-scrollbar py-1 select-none">
      {tabs.map(tab => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 pb-2.5 text-sm font-semibold tracking-tight border-b-2 relative -mb-[5px] transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-gray-400 hover:text-status-muted'
            }`}
          >
            {Icon && <Icon size={15} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export const certStatusConfig = {
  compliant: { color: 'text-status-success bg-status-success-bg border-status-success/15', icon: CheckCircle2, label: 'Compliant' },
  expiring_soon: { color: 'text-status-warning bg-status-warning/10 border-status-warning/15', icon: AlertTriangle, label: 'Expiring Soon' },
  expired: { color: 'text-status-danger bg-status-danger-bg border-status-danger/15', icon: AlertTriangle, label: 'Expired' },
  not_uploaded: { color: 'text-gray-400 bg-surface-hover border-card-border', icon: HelpCircle, label: 'Not Uploaded' },
};

export const CertBadge = ({ status }) => {
  const cfg = certStatusConfig[status] || certStatusConfig.not_uploaded;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
};

export const urgencyColor = {
  emergency: 'bg-status-danger-bg text-status-danger border-status-danger/15',
  urgent: 'bg-status-warning/10 text-status-warning border-status-warning/15',
  routine: 'bg-surface-hover text-gray-400 border-card-border',
};

export const ticketStatusIcon = {
  complete: <CheckCircle2 size={13} className="text-status-success" />,
  cancelled: <AlertTriangle size={13} className="text-status-danger" />,
  in_progress: <Clock size={13} className="text-status-warning" />,
};
