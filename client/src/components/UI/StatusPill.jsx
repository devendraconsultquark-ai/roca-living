import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Circle, Clock, Calendar } from 'lucide-react';

export const StatusPill = ({
  status = 'active',
  customLabel = null,
  size = 'md', // sm, md
  rounded = 'full', // sm, full
  showIcon = true
}) => {

  // Map backend statuses to design system concepts and icons
  const statusConfig = {
    // 1. Success States (Green, CheckCircle2)
    active: { text: 'Active', classes: 'bg-status-success-bg text-status-success border-status-success/15', icon: CheckCircle2 },
    compliant: { text: 'Compliant', classes: 'bg-status-success-bg text-status-success border-status-success/15', icon: CheckCircle2 },
    'fully compliant': { text: 'Fully Compliant', classes: 'bg-status-success-bg text-status-success border-status-success/15', icon: CheckCircle2 },
    fully_compliant: { text: 'Fully Compliant', classes: 'bg-status-success-bg text-status-success border-status-success/15', icon: CheckCircle2 },
    reconciled: { text: 'Reconciled', classes: 'bg-status-success-bg text-status-success border-status-success/15', icon: CheckCircle2 },
    verified: { text: 'Verified', classes: 'bg-status-success-bg text-status-success border-status-success/15', icon: CheckCircle2 },
    paid: { text: 'Paid', classes: 'bg-status-success-bg text-status-success border-status-success/15', icon: CheckCircle2 },
    completed: { text: 'Completed', classes: 'bg-status-success-bg text-status-success border-status-success/15', icon: CheckCircle2 },
    low: { text: 'Low', classes: 'bg-status-success-bg text-status-success border-status-success/15', icon: CheckCircle2 },

    // 2. Warning States (Amber, AlertTriangle)
    pending: { text: 'Pending', classes: 'bg-status-warning/10 text-status-warning border-status-warning/15', icon: AlertTriangle },
    'expiring soon': { text: 'Expiring Soon', classes: 'bg-status-warning/10 text-status-warning border-status-warning/15', icon: AlertTriangle },
    expiring_soon: { text: 'Expiring Soon', classes: 'bg-status-warning/10 text-status-warning border-status-warning/15', icon: AlertTriangle },
    'awaiting approval': { text: 'Awaiting Approval', classes: 'bg-status-warning/10 text-status-warning border-status-warning/15', icon: AlertTriangle },
    awaiting_approval: { text: 'Awaiting Approval', classes: 'bg-status-warning/10 text-status-warning border-status-warning/15', icon: AlertTriangle },
    medium: { text: 'Medium', classes: 'bg-status-warning/10 text-status-warning border-status-warning/15', icon: AlertTriangle },

    // 3. Danger States (Red, XCircle / AlertTriangle)
    overdue: { text: 'Overdue', classes: 'bg-status-danger-bg text-status-danger border-status-danger/15', icon: XCircle },
    expired: { text: 'Expired', classes: 'bg-status-danger-bg text-status-danger border-status-danger/15', icon: XCircle },
    failed: { text: 'Failed', classes: 'bg-status-danger-bg text-status-danger border-status-danger/15', icon: XCircle },
    blocked: { text: 'Blocked', classes: 'bg-status-danger-bg text-status-danger border-status-danger/15', icon: XCircle },
    cancelled: { text: 'Cancelled', classes: 'bg-status-danger-bg text-status-danger border-status-danger/15', icon: XCircle },
    'action required': { text: 'Action Required', classes: 'bg-status-danger-bg text-status-danger border-status-danger/15', icon: AlertTriangle },
    action_required: { text: 'Action Required', classes: 'bg-status-danger-bg text-status-danger border-status-danger/15', icon: AlertTriangle },
    high: { text: 'High', classes: 'bg-status-danger-bg text-status-danger border-status-danger/15', icon: AlertTriangle },

    // 4. Info States (Blue, Clock / Calendar)
    'in progress': { text: 'In Progress', classes: 'bg-status-info-bg text-status-info border-status-info/15', icon: Clock },
    in_progress: { text: 'In Progress', classes: 'bg-status-info-bg text-status-info border-status-info/15', icon: Clock },
    triaged: { text: 'In Progress', classes: 'bg-status-info-bg text-status-info border-status-info/15', icon: Clock },
    scheduled: { text: 'Scheduled', classes: 'bg-status-info-bg text-status-info border-status-info/15', icon: Calendar },

    // 5. Muted States (Grey, Circle)
    onboarding: { text: 'Onboarding', classes: 'bg-gray-100 text-gray-400 border-gray-200', icon: Circle },
    draft: { text: 'Draft', classes: 'bg-gray-100 text-gray-400 border-gray-200', icon: Circle },
    'not started': { text: 'Not Started', classes: 'bg-gray-100 text-gray-400 border-gray-200', icon: Circle },
    'not uploaded': { text: 'Not Uploaded', classes: 'bg-gray-100 text-gray-400 border-gray-200', icon: Circle },
    not_uploaded: { text: 'Not Uploaded', classes: 'bg-gray-100 text-gray-400 border-gray-200', icon: Circle }
  };

  // Normalize input status string to lowercase
  const normalizedStatus = status ? String(status).toLowerCase().trim() : 'draft';
  
  // Find match, or default to grey draft status
  const config = statusConfig[normalizedStatus] || { 
    text: status, 
    classes: 'bg-gray-100 text-gray-400 border-gray-200', 
    icon: Circle 
  };

  const label = customLabel || config.text;
  const Icon = config.icon;

  // Determine size classes
  // Note: sm size is text-[8px] or [8.5px] depending on the original style.
  // We'll use text-[8.5px] px-2 py-0.5 for small, text-xs py-1 px-2.5 for medium.
  const sizeClasses = size === 'sm' ? 'text-2xs py-0.5 px-2' : 'text-xs py-1 px-2.5';
  
  // Determine border-radius shape
  const roundedClasses = rounded === 'sm' ? 'rounded-sm' : 'rounded-full';

  return (
    <span className={`inline-flex items-center justify-center gap-1 font-bold border select-none w-fit leading-none shrink-0 ${sizeClasses} ${roundedClasses} ${config.classes}`}>
      {showIcon && <Icon size={size === 'sm' ? 11 : 14} className="shrink-0" />}
      {label}
    </span>
  );
};