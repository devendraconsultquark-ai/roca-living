import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Trash2, CheckCircle2, AlertTriangle, HelpCircle, Clock 
} from 'lucide-react';

export const DataRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
    <div className="flex items-center gap-3 text-gray-500">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 text-gray-500">
        {Icon && <Icon size={14} />}
      </div>
      <span className="text-[13px] font-semibold">{label}</span>
    </div>
    <span className="text-[13px] font-bold text-[#1A1A1A] text-right max-w-[50%] truncate" title={typeof value === 'string' ? value : ''}>
      {value || '—'}
    </span>
  </div>
);

export const Card = ({ title, children }) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-border-color/60">
    <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">{title}</h3>
    {children}
  </div>
);

export const DetailContainer = ({ children, className = '' }) => (
  <div className={`w-full flex flex-col bg-[#F8F9FA] min-h-[calc(100vh-64px)] p-8 pt-10 ${className}`}>
    {children}
  </div>
);

export const DetailSkeleton = () => (
  <div className="py-8 max-w-7xl mx-auto px-4 flex flex-col gap-5 animate-pulse">
    <div className="h-8 bg-gray-200 rounded-lg w-48 mb-6" />
    <div className="h-24 bg-gray-100 rounded-2xl mb-8" />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 h-64 bg-gray-100 rounded-2xl" />
      <div className="lg:col-span-1 h-64 bg-gray-100 rounded-2xl" />
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
            className="flex items-center gap-1.5 text-sm font-bold text-brand-accent hover:text-brand-accent/80 transition-colors w-fit mb-2 cursor-pointer"
          >
            <ArrowLeft size={16} />
            {backLabel}
          </button>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-[#1A1A1A]">{title}</h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-1">
            {subtitle}
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        {editLabel && (
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-accent/20 text-brand-accent rounded-xl hover:bg-brand-accent/5 transition-colors text-sm font-bold shadow-sm cursor-pointer"
          >
            <Edit size={16} />
            {editLabel}
          </button>
        )}
        {deleteLabel && (
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-status-danger/20 text-status-danger rounded-xl hover:bg-status-danger/5 transition-colors text-sm font-bold shadow-sm cursor-pointer"
          >
            <Trash2 size={16} />
            {deleteLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export const DetailTabs = ({ tabs, activeTab, setActiveTab }) => {
  return (
    <div className="flex items-center gap-8 border-b border-border-color/60 mb-6 overflow-x-auto no-scrollbar">
      {tabs.map(tab => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab.id 
                ? 'border-brand-accent text-brand-accent' 
                : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
            }`}
          >
            {Icon && <Icon size={16} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export const certStatusConfig = {
  compliant: { color: 'text-status-success bg-status-success/10 border-status-success/20', icon: CheckCircle2, label: 'Compliant' },
  expiring_soon: { color: 'text-status-warning bg-status-warning/10 border-status-warning/20', icon: AlertTriangle, label: 'Expiring Soon' },
  expired: { color: 'text-status-danger bg-status-danger/10 border-status-danger/20', icon: AlertTriangle, label: 'Expired' },
  not_uploaded: { color: 'text-gray-400 bg-gray-100 border-gray-200', icon: HelpCircle, label: 'Not Uploaded' },
};

export const CertBadge = ({ status }) => {
  const cfg = certStatusConfig[status] || certStatusConfig.not_uploaded;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
};

export const urgencyColor = {
  emergency: 'bg-status-danger/10 text-status-danger border-status-danger/20',
  urgent: 'bg-status-warning/10 text-status-warning border-status-warning/20',
  routine: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const ticketStatusIcon = {
  complete: <CheckCircle2 size={13} className="text-status-success" />,
  cancelled: <AlertTriangle size={13} className="text-status-danger" />,
  in_progress: <Clock size={13} className="text-status-warning" />,
};

