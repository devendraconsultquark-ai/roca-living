import React, { useState } from 'react';
import { usePropertyContext } from '../context/PropertyContext';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, AlertCircle, Calendar, CheckCircle2, ChevronRight, User, Building, FileText, Wrench, Wallet, Flame, Droplet, Key, Download, Info, Headphones, Check, HelpCircle, MoreVertical
} from 'lucide-react';
import { useProperties } from '../hooks/useProperties';
import { useTenancy } from '../hooks/useTenancy';
import { PortalMetricCard } from '../components/UI/PortalMetricCard';
import { Button } from '../components/UI/Button';
import { FilterRibbon } from '../components/UI/FilterRibbon';
import { RadialGauge } from '../components/UI/RadialGauge';
import { TableEmptyState } from '../components/UI/TableEmptyState';
import { StatusPill } from '../components/UI/StatusPill';

export const ComplianceOverview = () => {
  const { selectedProperty } = usePropertyContext();
  const navigate = useNavigate();
  
  // Real data hooks
  const { properties, loading: propertiesLoading, error: propertiesError } = useProperties();
  const { tenancies, loading: tenancyLoading } = useTenancy();

  // Filter states
  const [filterProperty, setFilterProperty] = useState('All Properties');
  const [filterType, setFilterType] = useState('All Types');
  const [filterStatus, setFilterStatus] = useState('All Statuses');
  const [filterDue, setFilterDue] = useState('All Time');

  // Dynamic values computation
  const loading = propertiesLoading || tenancyLoading;

  // Let's count expired certifications across all properties
  let expiredCertifications = 0;
  let totalCertificationsTracked = 0;

  const essentialCertificates = [];
  const propertyManagement = [];

  properties.forEach(p => {
    // Gas Certificate
    if (p.gasCompliance) {
      totalCertificationsTracked++;
      const isExpired = p.gasCompliance === 'expired';
      if (isExpired) expiredCertifications++;
      essentialCertificates.push({
        item: 'Gas Safety Certificate',
        status: isExpired ? 'Expired' : 'Compliant',
        nextDue: '—',
        subtext: isExpired ? 'Action required' : 'Active',
        subtextColor: isExpired ? 'text-status-danger' : 'text-gray-400',
        action: 'View Certificate',
        icon: ShieldCheck,
        color: isExpired ? 'bg-red-50 text-red-500' : 'bg-status-success-bg text-status-success',
        property: p.address
      });
    }

    // EICR Certificate
    if (p.eicrCompliance) {
      totalCertificationsTracked++;
      const isExpired = p.eicrCompliance === 'expired';
      if (isExpired) expiredCertifications++;
      essentialCertificates.push({
        item: 'Electrical Installation condition (EICR)',
        status: isExpired ? 'Expired' : 'Compliant',
        nextDue: '—',
        subtext: isExpired ? 'Action required' : 'Active',
        subtextColor: isExpired ? 'text-status-danger' : 'text-gray-400',
        action: 'View Certificate',
        icon: ShieldCheck,
        color: isExpired ? 'bg-red-50 text-red-500' : 'bg-status-success-bg text-status-success',
        property: p.address
      });
    }

    // EPC Certificate
    if (p.epcCompliance) {
      totalCertificationsTracked++;
      const isExpired = p.epcCompliance === 'expired';
      if (isExpired) expiredCertifications++;
      propertyManagement.push({
        item: 'Energy Performance Certificate (EPC)',
        status: isExpired ? 'Expired' : 'Compliant',
        nextDue: '—',
        subtext: isExpired ? 'Action required' : 'Active',
        subtextColor: isExpired ? 'text-status-danger' : 'text-gray-400',
        action: 'View Certificate',
        icon: FileText,
        color: isExpired ? 'bg-red-50 text-red-500' : 'bg-status-success-bg text-status-success',
        property: p.address
      });
    }
  });

  const overallCompliancePct = totalCertificationsTracked 
    ? Math.round(((totalCertificationsTracked - expiredCertifications) / totalCertificationsTracked) * 100) 
    : 100;

  const stats = {
    overall: overallCompliancePct,
    actionRequired: expiredCertifications,
    expiringSoon: 0,
    upToDate: totalCertificationsTracked - expiredCertifications,
    tenantCompliance: 100,
    landlordCompliance: overallCompliancePct
  };

  // Move-in compliance dynamically constructed from active tenancies
  const moveInCompliance = tenancies.map((t, idx) => ({
    item: `Right to Rent: ${t.lead_tenant_name}`,
    detail: t.address_line1 ? `${t.address_line1}, ${t.city}` : '—',
    status: t.status === 'active' ? 'Compliant' : 'Pending',
    completed: t.start_date ? new Date(t.start_date).toLocaleDateString('en-GB') : '—',
    action: 'View Details',
    icon: User,
    color: 'bg-status-info-bg text-status-info'
  }));

  // Ongoing tenant compliance mapping
  const ongoingTenantCompliance = tenancies.map((t, idx) => ({
    item: `Rent Schedule: ${t.lead_tenant_name}`,
    detail: `Monthly rent: £${parseFloat(t.rent_pcm).toLocaleString()}`,
    status: t.status === 'active' ? 'Compliant' : 'Overdue',
    nextDue: t.end_date ? new Date(t.end_date).toLocaleDateString('en-GB') : '—',
    action: 'View Tenancy',
    icon: Wallet,
    color: 'bg-status-success-bg text-status-success'
  }));

  const filtersConfig = [
    {
      label: 'Filter by Property',
      value: filterProperty,
      onChange: setFilterProperty,
      options: [{ value: 'All Properties', label: 'All Properties' }],
      width: 'w-44'
    },
    {
      label: 'Filter by Type',
      value: filterType,
      onChange: setFilterType,
      options: [{ value: 'All Types', label: 'All Types' }],
      width: 'w-32'
    },
    {
      label: 'Filter by Status',
      value: filterStatus,
      onChange: setFilterStatus,
      options: [{ value: 'All Statuses', label: 'All Statuses' }],
      width: 'w-32'
    },
    {
      label: 'Due Within',
      value: filterDue,
      onChange: setFilterDue,
      options: [{ value: 'All Time', label: 'All Time' }],
      width: 'w-32'
    }
  ];

  const actionConfig = {
    label: 'Review Compliance Checklist',
    icon: ChevronRight,
    iconPosition: 'right',
    onClick: () => {}
  };

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 animate-pulse">
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl" />
          ))}
        </div>
        {/* Filter Bar Skeleton */}
        <div className="h-10 bg-gray-100 rounded-lg" />
        {/* Main Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-6">
            <div className="h-[80px] bg-gray-100/60 rounded-2xl" />
            <div className="h-[280px] bg-gray-100/60 rounded-2xl" />
            <div className="h-[280px] bg-gray-100/60 rounded-2xl" />
          </div>
          <div className="flex flex-col gap-6">
            <div className="h-[80px] bg-gray-100/60 rounded-2xl" />
            <div className="h-[280px] bg-gray-100/60 rounded-2xl" />
            <div className="h-[280px] bg-gray-100/60 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 font-sans text-brand-primary">
      
      {propertiesError && (
        <div className="border border-status-danger bg-status-danger/5 rounded-card p-4 text-center text-status-danger font-semibold">
          {propertiesError}
        </div>
      )}
      
      {/* Metric Cards Grid (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 animate-fade-in">
        <PortalMetricCard 
          label="Overall Compliance" 
          value={loading ? '...' : `${stats.overall}%`}
          icon={ShieldCheck}
          variant="success"
          actionText="View Overview"
          onActionClick={() => {}}
        />
        <PortalMetricCard 
          label="Action Required" 
          value={loading ? '...' : (stats.actionRequired > 0 ? `${stats.actionRequired} Items` : '0 Items')}
          icon={AlertCircle}
          variant={stats.actionRequired > 0 ? "danger" : "success"}
          actionText="View All"
          onActionClick={() => {}}
        />
        <PortalMetricCard 
          label="Expiring Soon" 
          value={loading ? '...' : `${stats.expiringSoon} Items`}
          subText="Within 90 Days"
          icon={Calendar}
          variant="warning"
          actionText="View Expiring"
          onActionClick={() => {}}
        />
        <PortalMetricCard 
          label="Up to Date" 
          value={loading ? '...' : `${stats.upToDate} Items`}
          icon={CheckCircle2}
          variant="info"
          actionText="View All"
          onActionClick={() => {}}
        />
      </div>

      {/* Main Grid area */}
      <div className="flex flex-col gap-6">
        
        {/* Filters ribbon */}
        <FilterRibbon
          filters={filtersConfig}
          action={actionConfig}
        />

        {/* 2 Column Grid: Tenant Compliance vs Landlord Compliance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* LEFT: Tenant Compliance */}
          <div className="flex flex-col gap-6">
            
            {/* Header Panel */}
            <div className="bg-white border border-card-border rounded-card p-5 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3.5 min-w-0 text-left">
                <div className="w-10 h-10 rounded-full bg-status-success-bg text-status-success flex items-center justify-center shrink-0">
                  <User size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-sm-portal font-bold text-brand-primary leading-tight">Tenant Compliance</h3>
                  <span className="text-2xs text-gray-400 leading-none mt-1.5 font-semibold">Move-in compliance and ongoing tenant/tenancy requirements.</span>
                </div>
              </div>
              <RadialGauge percentage={stats.tenantCompliance} color="stroke-status-success" />
            </div>

            {/* Tables Checklist Card */}
            <div className="bg-white border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-6">
              
              {/* Move In Compliance Section */}
              <div>
                <h4 className="text-xs-portal font-extrabold text-brand-primary tracking-tight border-b border-gray-50 pb-2">
                  Move-In Compliance Check
                </h4>
                <div className="overflow-x-auto w-full mt-2 select-none">
                  <table className="w-full text-left border-collapse text-xs-portal">
                    <thead>
                      <tr className="text-2xs text-gray-400 font-bold uppercase tracking-wider border-b border-gray-50">
                        <th className="py-2 px-1">Item</th>
                        <th className="py-2 px-1">Status</th>
                        <th className="py-2 px-1">Completed Date</th>
                        <th className="py-2 px-1 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {loading || moveInCompliance.length === 0 ? (
                        <TableEmptyState
                          colSpan={4}
                          loading={loading}
                          loadingText="Loading..."
                          emptyText="No move-in compliance items tracked."
                          className="py-6 text-center text-gray-400 font-bold"
                        />
                      ) : (
                        moveInCompliance.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${row.color}`}>
                                  <row.icon size={11} />
                                </div>
                                <div className="flex flex-col text-left">
                                  <span className="font-bold text-brand-primary leading-tight truncate max-w-[140px]">{row.item}</span>
                                  <span className="text-2xs text-gray-400 mt-0.5 leading-none truncate max-w-[140px]">{row.detail}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-1">
                              <StatusPill status={row.status} size="sm" showIcon={false} />
                            </td>
                            <td className="py-2.5 px-1 font-semibold text-brand-primary">{row.completed}</td>
                            <td className="py-2.5 px-1">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="secondary" className="!py-0.5 !px-2 text-2xs font-bold bg-white">{row.action}</Button>
                                <button className="p-0.5 text-gray-300 hover:text-brand-primary cursor-pointer"><MoreVertical size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Ongoing Tenancy Compliance Section */}
              <div>
                <h4 className="text-xs-portal font-extrabold text-brand-primary tracking-tight border-b border-gray-50 pb-2">
                  Ongoing Tenancy Requirements
                </h4>
                <div className="overflow-x-auto w-full mt-2 select-none">
                  <table className="w-full text-left border-collapse text-xs-portal">
                    <thead>
                      <tr className="text-2xs text-gray-400 font-bold uppercase tracking-wider border-b border-gray-50">
                        <th className="py-2 px-1">Item</th>
                        <th className="py-2 px-1">Status</th>
                        <th className="py-2 px-1">Next Review</th>
                        <th className="py-2 px-1 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {loading || ongoingTenantCompliance.length === 0 ? (
                        <TableEmptyState
                          colSpan={4}
                          loading={loading}
                          loadingText="Loading..."
                          emptyText="No active ongoing tenancy items."
                          className="py-6 text-center text-gray-400 font-bold"
                        />
                      ) : (
                        ongoingTenantCompliance.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${row.color}`}>
                                  <row.icon size={11} />
                                </div>
                                <div className="flex flex-col text-left">
                                  <span className="font-bold text-brand-primary leading-tight truncate max-w-[140px]">{row.item}</span>
                                  <span className="text-2xs text-gray-400 mt-0.5 leading-none truncate max-w-[140px]">{row.detail}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-1">
                              <StatusPill status={row.status} size="sm" showIcon={false} />
                            </td>
                            <td className="py-2.5 px-1 font-semibold text-brand-primary">{row.nextDue}</td>
                            <td className="py-2.5 px-1">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="secondary" className="!py-0.5 !px-2 text-2xs font-bold bg-white">{row.action}</Button>
                                <button className="p-0.5 text-gray-300 hover:text-brand-primary cursor-pointer"><MoreVertical size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT: Landlord Compliance */}
          <div className="flex flex-col gap-6">
            
            {/* Header Panel */}
            <div className="bg-white border border-card-border rounded-card p-5 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3.5 min-w-0 text-left">
                <div className="w-10 h-10 rounded-full bg-status-success-bg text-status-success flex items-center justify-center shrink-0">
                  <Building size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-sm-portal font-bold text-brand-primary leading-tight">Landlord Compliance</h3>
                  <span className="text-2xs text-gray-400 leading-none mt-1.5 font-semibold">Property ownership and management compliance.</span>
                </div>
              </div>
              <RadialGauge percentage={stats.landlordCompliance} color="stroke-status-success" />
            </div>

            {/* Tables Certificates List */}
            <div className="bg-white border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-6">
              
              {/* Essential Certificates Section */}
              <div>
                <h4 className="text-xs-portal font-extrabold text-brand-primary tracking-tight border-b border-gray-50 pb-2">
                  Essential Certificates & Compliance
                </h4>
                <div className="overflow-x-auto w-full mt-2 select-none">
                  <table className="w-full text-left border-collapse text-xs-portal">
                    <thead>
                      <tr className="text-2xs text-gray-400 font-bold uppercase tracking-wider border-b border-gray-50">
                        <th className="py-2 px-1">Item</th>
                        <th className="py-2 px-1">Status</th>
                        <th className="py-2 px-1">Next Due</th>
                        <th className="py-2 px-1 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {loading || essentialCertificates.length === 0 ? (
                        <TableEmptyState
                          colSpan={4}
                          loading={loading}
                          loadingText="Loading..."
                          emptyText="No active certifications tracked."
                          className="py-6 text-center text-gray-400 font-bold"
                        />
                      ) : (
                        essentialCertificates.map((row, idx) => {
                          const isExpired = row.status === 'Expired';
                          return (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="py-2.5 px-1">
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${row.color}`}>
                                    <row.icon size={11} />
                                  </div>
                                  <span className="font-bold text-brand-primary leading-tight truncate max-w-[150px] sm:max-w-xs">{row.item}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-1">
                                <StatusPill status={row.status} size="sm" showIcon={false} />
                              </td>
                              <td className="py-2.5 px-1">
                                <div className="flex flex-col leading-tight">
                                  <span className="font-semibold text-brand-primary">{row.nextDue}</span>
                                  {row.subtext && <span className={`text-2xs font-bold mt-0.5 leading-none ${row.subtextColor}`}>{row.subtext}</span>}
                                </div>
                              </td>
                              <td className="py-2.5 px-1">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="secondary" className="!py-0.5 !px-2 text-2xs font-bold bg-white">{row.action}</Button>
                                  <button className="p-0.5 text-gray-300 hover:text-brand-primary cursor-pointer"><MoreVertical size={13} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Property & Management Compliance */}
              <div>
                <h4 className="text-xs-portal font-extrabold text-brand-primary tracking-tight border-b border-gray-50 pb-2">
                  Property & Management Compliance
                </h4>
                <div className="overflow-x-auto w-full mt-2 select-none">
                  <table className="w-full text-left border-collapse text-xs-portal">
                    <thead>
                      <tr className="text-2xs text-gray-400 font-bold uppercase tracking-wider border-b border-gray-50">
                        <th className="py-2 px-1">Item</th>
                        <th className="py-2 px-1">Status</th>
                        <th className="py-2 px-1">Next Due</th>
                        <th className="py-2 px-1 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {loading || propertyManagement.length === 0 ? (
                        <TableEmptyState
                          colSpan={4}
                          loading={loading}
                          loadingText="Loading..."
                          emptyText="No management items tracked."
                          className="py-6 text-center text-gray-400 font-bold"
                        />
                      ) : (
                        propertyManagement.map((row, idx) => {
                          const isExpired = row.status === 'Expired';
                          return (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="py-2.5 px-1">
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${row.color}`}>
                                    <row.icon size={11} />
                                  </div>
                                  <span className="font-bold text-brand-primary leading-tight truncate max-w-[150px] sm:max-w-xs">{row.item}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-1">
                                <StatusPill status={row.status} size="sm" showIcon={false} />
                              </td>
                              <td className="py-2.5 px-1">
                                <div className="flex flex-col leading-tight">
                                  <span className="font-semibold text-brand-primary">{row.nextDue}</span>
                                  {row.subtext && <span className={`text-2xs font-bold mt-0.5 leading-none ${row.subtextColor}`}>{row.subtext}</span>}
                                </div>
                              </td>
                              <td className="py-2.5 px-1">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="secondary" className="!py-0.5 !px-2 text-2xs font-bold bg-white">{row.action}</Button>
                                  <button className="p-0.5 text-gray-300 hover:text-brand-primary cursor-pointer"><MoreVertical size={13} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
