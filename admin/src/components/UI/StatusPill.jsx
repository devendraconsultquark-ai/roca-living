import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Circle } from 'lucide-react';

export const StatusPill = ({
  status = 'active', // active, pending, danger, draft
  customLabel = null
}) => {

  // Map backend statuses to design system concepts and icons
  const statusConfig = {
    // 1. Success States (Green, CheckCircle2)
    active: { text: 'Active', classes: 'bg-[#2E7D32]/10 text-[#2E7D32]', icon: CheckCircle2 },
    compliant: { text: 'Compliant', classes: 'bg-[#2E7D32]/10 text-[#2E7D32]', icon: CheckCircle2 },
    reconciled: { text: 'Reconciled', classes: 'bg-[#2E7D32]/10 text-[#2E7D32]', icon: CheckCircle2 },
    verified: { text: 'Verified', classes: 'bg-[#2E7D32]/10 text-[#2E7D32]', icon: CheckCircle2 },
    paid: { text: 'Paid', classes: 'bg-[#2E7D32]/10 text-[#2E7D32]', icon: CheckCircle2 },

    // 2. Warning States (Amber, AlertTriangle)
    pending: { text: 'Pending', classes: 'bg-[#E0A93B]/10 text-[#E0A93B]', icon: AlertTriangle },
    'expiring soon': { text: 'Expiring Soon', classes: 'bg-[#E0A93B]/10 text-[#E0A93B]', icon: AlertTriangle },
    'awaiting approval': { text: 'Awaiting Approval', classes: 'bg-[#E0A93B]/10 text-[#E0A93B]', icon: AlertTriangle },

    // 3. Danger States (Red, XCircle)
    overdue: { text: 'Overdue', classes: 'bg-[#C62828]/10 text-[#C62828]', icon: XCircle },
    expired: { text: 'Expired', classes: 'bg-[#C62828]/10 text-[#C62828]', icon: XCircle },
    failed: { text: 'Failed', classes: 'bg-[#C62828]/10 text-[#C62828]', icon: XCircle },
    blocked: { text: 'Blocked', classes: 'bg-[#C62828]/10 text-[#C62828]', icon: XCircle },

    // 4. Muted States (Grey, Circle)
    onboarding: { text: 'Onboarding', classes: 'bg-[#F2F2F2] text-[#888888]', icon: Circle },
    draft: { text: 'Draft', classes: 'bg-[#F2F2F2] text-[#888888]', icon: Circle },
    'not started': { text: 'Not Started', classes: 'bg-[#F2F2F2] text-[#888888]', icon: Circle },
  };

  // Normalize input status string to lowercase (defensive programming)
  const normalizedStatus = status ? status.toLowerCase() : 'draft';
  
  // Find match, or default to grey draft status
  const config = statusConfig[normalizedStatus] || { 
    text: status, 
    classes: 'bg-[#F2F2F2] text-[#888888]', 
    icon: Circle 
  };

  const label = customLabel || config.text;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-bold w-fit ${config.classes}`}>
      <Icon size={14} className="shrink-0" />
      {label}
    </span>
  );
};