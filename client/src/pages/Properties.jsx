import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building, User, Home as HomeIcon, Wallet, ShieldCheck, Search, Grid, List, MoreVertical, ChevronRight, CheckCircle2, AlertTriangle, Key, Download, Check, HelpCircle
} from 'lucide-react';
import { useProperties } from '../hooks/useProperties';
import { PortalCard } from '../components/UI/PortalCard';
import { PortalMetricCard } from '../components/UI/PortalMetricCard';
import { Button } from '../components/UI/Button';
import { DataTable } from '../components/UI/DataTable';
import { StatusPill } from '../components/UI/StatusPill';

export const Properties = () => {
  const navigate = useNavigate();
  const {
    properties,
    loading,
    error,
    monthlyGrossYield,
    complianceWarnings,
  } = useProperties();

  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('card'); // card | table

  // Map image while forwarding joined database attributes
  const enrichProperty = (p) => {
    return {
      ...p,
      image: `${import.meta.env.BASE_URL}images/img1.jpg`
    };
  };

  const enrichedProperties = properties.map(enrichProperty);

  // Filters logic
  const filteredProperties = enrichedProperties.filter((p) => {
    // 1. Search Query filter
    const matchesSearch = p.address.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // 2. Filter Pills logic
    switch (activeFilter) {
      case 'Occupied':
        return p.status === 'let';
      case 'Vacant':
        return p.status === 'vacant' || p.status === 'onboarding';
      case 'Compliance Issues':
        return p.compliance_pct < 100 || p.gasCompliance === 'expired' || p.epcCompliance === 'expired' || p.eicrCompliance === 'expired';
      case 'Maintenance Issues':
        return p.maintenance_issues > 0;
      case 'Rent Arrears':
        return p.status === 'let' && p.id === 999; // Mock: no arrears in active database
      case 'Expiring Compliance':
        return p.gasCompliance === 'expiring_soon' || p.epcCompliance === 'expiring_soon' || p.eicrCompliance === 'expiring_soon';
      default:
        return true;
    }
  });

  // Summary Metrics calculations
  const totalCount = enrichedProperties.length;
  const occupiedCount = enrichedProperties.filter(p => p.status === 'let').length;
  const vacantCount = totalCount - occupiedCount;
  const occupiedPct = totalCount > 0 ? ((occupiedCount / totalCount) * 100).toFixed(1) : '0';
  const vacantPct = totalCount > 0 ? ((vacantCount / totalCount) * 100).toFixed(1) : '0';
  const compliancePct = totalCount > 0 ? Math.round(((totalCount - complianceWarnings) / totalCount) * 100) : 100;

  // Render cert status for the table view fallback
  const renderCertStatus = (statusValue) => {
    if (!statusValue || statusValue === 'not_uploaded') return '-';
    return <StatusPill status={statusValue} size="sm" showIcon={true} />;
  };

  // Table Columns
  const tableColumns = [
    { header: 'Property Ref', accessor: 'id', sortable: true },
    { header: 'Property Address', accessor: 'address', sortable: true },
    { header: 'Current Tenant', accessor: 'tenant_name', sortable: true },
    { 
      header: 'Monthly Rent', 
      accessor: 'rent', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.rent.toLocaleString()}`
    },
    { 
      header: 'Occupancy', 
      accessor: 'status',
      renderCell: (row) => {
        let pillStatus = 'draft';
        if (row.status === 'let') pillStatus = 'active';
        else if (row.status === 'vacant') pillStatus = 'pending';
        return <StatusPill status={pillStatus} customLabel={row.status === 'let' ? 'Occupied' : 'Vacant'} />;
      }
    },
    { 
      header: 'Gas Certificate', 
      accessor: 'gasCompliance',
      renderCell: (row) => renderCertStatus(row.gasCompliance)
    },
    { 
      header: 'EPC Safety', 
      accessor: 'epcCompliance',
      renderCell: (row) => renderCertStatus(row.epcCompliance)
    },
    { 
      header: 'EICR Electrical', 
      accessor: 'eicrCompliance',
      renderCell: (row) => renderCertStatus(row.eicrCompliance)
    },
  ];

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 animate-pulse">
        <div className="h-8 bg-gray-100 rounded-lg w-1/4" />
        <div className="h-4 bg-gray-50 rounded-lg w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mt-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="h-10 bg-gray-100 rounded-lg mt-6" />
        <div className="flex flex-col gap-4 mt-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100/60 rounded-xl" />
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
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 border-b border-gray-100 pb-4 mt-2">
        {/* Left: Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <span className="text-xs-portal font-bold text-gray-400 uppercase tracking-wider shrink-0 select-none mr-2">Filter by</span>
          {[
            'All', 'Occupied', 'Vacant', 'Compliance Issues', 'Maintenance Issues', 'Rent Arrears', 'Expiring Compliance'
          ].map((filt) => (
            <button
              key={filt}
              onClick={() => setActiveFilter(filt)}
              className={`px-3.5 py-1.5 rounded-md text-xs-portal font-bold tracking-tight cursor-pointer transition-all duration-150 shrink-0 ${
                activeFilter === filt
                  ? 'bg-status-info text-white'
                  : 'bg-white hover:bg-gray-50 border border-gray-200 text-brand-primary'
              }`}
            >
              {filt}
            </button>
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
              className="w-full sm:w-[240px] pl-9 pr-4 py-1.5 text-xs-portal bg-white border border-card-border focus:border-gray-400 rounded-md focus:outline-none transition-colors"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-gray-200 rounded-md overflow-hidden bg-white select-none">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 flex items-center justify-center cursor-pointer transition-colors ${
                viewMode === 'card' ? 'bg-gray-50 text-status-info' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Card View"
            >
              <Grid size={16} />
              <span className="text-xs-portal font-bold ml-1 hidden sm:inline">Card View</span>
            </button>
            <div className="w-[1px] h-6 bg-gray-200" />
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 flex items-center justify-center cursor-pointer transition-colors ${
                viewMode === 'table' ? 'bg-gray-50 text-status-info' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Table View"
            >
              <List size={16} />
              <span className="text-xs-portal font-bold ml-1 hidden sm:inline">Table View</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Content: Properties List */}
      <div>
        {filteredProperties.length === 0 ? (
          <div className="bg-white border border-card-border rounded-card p-12 text-center text-gray-400 font-medium">
            No properties found matching the selected filters.
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white border border-card-border rounded-card p-4 shadow-sm">
            <DataTable columns={tableColumns} data={filteredProperties} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredProperties.map((p) => (
              <div 
                key={p.id}
                className="bg-white border border-card-border rounded-card p-4 flex flex-col lg:flex-row gap-6 hover:border-gray-300 transition-colors duration-150 shadow-xs relative"
              >
                
                {/* Image Section */}
                <div className="w-full lg:w-[220px] h-[135px] rounded-sm overflow-hidden shrink-0 border border-gray-100 shadow-sm bg-gray-50">
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
                    <h3 className="text-[15px] font-extrabold text-brand-primary leading-tight tracking-tight">
                      {p.address_line1}
                    </h3>
                    <span className="text-xs-portal font-semibold text-gray-400 mt-1 block">
                      {p.city}, {p.postcode}
                    </span>
                  </div>                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 border-t border-gray-50 pt-3">
                    <div className="flex flex-col">
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">Property Type</span>
                      <span className="text-xs-portal font-bold text-brand-primary mt-1 leading-none">{p.property_type || 'Apartment'}</span>
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none mt-4.5">Status</span>
                      <span className="text-xs-portal font-bold text-brand-primary mt-1 leading-none flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'let' ? 'bg-status-success' : 'bg-status-warning'}`} />
                        {p.status === 'let' ? 'Occupied' : 'Vacant'}
                      </span>
                    </div>
 
                    <div className="flex flex-col border-l border-gray-100 pl-6">
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">Tenancy Type</span>
                      <span className="text-xs-portal font-bold text-brand-primary mt-1 leading-none">{p.tenancy_type}</span>
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none mt-4.5">Tenancy Start Date</span>
                      <span className="text-xs-portal font-bold text-brand-primary mt-1 leading-none">{p.start_date}</span>
                    </div>
                  </div>

                  {/* Tenant & Rent Review Footer row inside the layout */}
                  <div className="grid grid-cols-2 gap-x-6 mt-4 border-t border-gray-50 pt-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-5.5 h-5.5 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">Tenant</span>
                        <span className="text-xs-portal font-bold text-brand-primary truncate mt-0.5 leading-none">
                          {p.tenant_name}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col border-l border-gray-100 pl-6">
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">Next Rent Review</span>
                      <span className="text-xs-portal font-bold text-brand-primary mt-0.5 leading-none">{p.next_review}</span>
                    </div>
                  </div>
                </div>

                {/* Metrics Columns Section */}
                <div className="w-full lg:w-[380px] flex items-center justify-between shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 pt-4 lg:pt-0 lg:pl-6 gap-4">
                  {/* Monthly Rent & Deposit Column */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">Monthly Rent</span>
                      <span className="text-sm-portal font-bold text-brand-primary mt-1.5 block leading-none">£{p.rent.toLocaleString()}</span>
                      {p.status === 'let' && (
                        <span className="text-2xs text-status-success font-semibold mt-1 block leading-none">Protected</span>
                      )}
                    </div>
                    <div>
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">Maintenance</span>
                      <span className={`text-xs-portal font-bold mt-1.5 block leading-none ${
                        p.maintenance_issues > 0 ? 'text-status-warning' : 'text-status-success'
                      }`}>
                        {p.maintenance_issues > 0 ? `${p.maintenance_issues} Open Issue` : 'No Issues'}
                      </span>
                    </div>
                  </div>

                  {/* Deposit Held & Net Paid Column */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">Deposit Held</span>
                      <span className="text-sm-portal font-bold text-brand-primary mt-1.5 block leading-none">£{p.deposit_amount.toLocaleString()}</span>
                      <span className="text-2xs text-status-success font-semibold mt-1 block leading-none">{p.deposit_status}</span>
                    </div>
                    <div>
                      <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">Net Paid This Month</span>
                      <span className="text-sm-portal font-bold text-brand-primary mt-1.5 block leading-none">£{p.net_paid.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Compliance Column */}
                  <div className="flex flex-col items-center justify-center self-center pr-2 shrink-0">
                    <span className="text-2xs text-gray-400 font-bold uppercase tracking-wider leading-none">Compliance</span>
                    <span className={`text-sm font-extrabold mt-1.5 block leading-none ${
                      p.compliance_pct === 100 ? 'text-status-success' : 'text-status-warning'
                    }`}>
                      {p.compliance_pct}%
                    </span>
                    <span className={`text-2xs font-bold mt-1 block leading-none ${
                      p.compliance_pct === 100 ? 'text-status-success' : 'text-status-warning'
                    }`}>
                      {p.compliance_pct === 100 ? 'Compliant' : 'Action Required'}
                    </span>
                  </div>
                </div>

                {/* View Actions Section */}
                <div className="flex flex-row lg:flex-col items-center justify-end lg:justify-center gap-3 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 pt-4 lg:pt-0 lg:pl-4 self-stretch">
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
                  <button className="p-1.5 rounded hover:bg-gray-50 border border-gray-200 text-gray-400 hover:text-gray-600 cursor-pointer">
                    <MoreVertical size={16} />
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Bottom Grid: Financial, Compliance & Tenancy Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
        
        {/* Card 1: Financial Summary */}
        <PortalCard title="financial summary (this month)">
          <div className="flex flex-col text-xs-portal gap-2.5 mt-2">
            <div className="flex justify-between items-center border-b border-gray-50 pb-1.5">
              <span className="text-gray-400 font-medium">Monthly Rent Roll</span>
              <span className="font-mono font-bold text-brand-primary">£9,540</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-50 pb-1.5">
              <span className="text-gray-400 font-medium">Net Income</span>
              <span className="font-mono font-bold text-brand-primary">£8,145</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-50 pb-1.5">
              <span className="text-gray-400 font-medium">Maintenance Spend</span>
              <span className="font-mono font-bold text-brand-primary">£620</span>
            </div>
            <div className="flex justify-between items-center pb-1">
              <span className="text-gray-400 font-medium">Management Fees</span>
              <span className="font-mono font-bold text-brand-primary">£775</span>
            </div>
          </div>
          <div className="mt-4 pt-1 flex items-center">
            <button 
              onClick={() => navigate('/statements')}
              className="text-xs-portal font-extrabold text-status-info hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              View Financials <ChevronRight size={12} />
            </button>
          </div>
        </PortalCard>

        {/* Card 2: Compliance Summary */}
        <PortalCard title="compliance summary">
          <div className="flex flex-col text-xs-portal gap-2.5 mt-2">
            <div className="flex justify-between items-center border-b border-gray-50 pb-1.5">
              <span className="text-gray-400 font-medium">Properties Compliant</span>
              <span className="font-mono font-bold text-brand-primary">11 (92%)</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-50 pb-1.5">
              <span className="text-gray-400 font-medium">Certificates Expiring</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-status-warning">2</span>
                <span className="text-2xs text-gray-400">Within 60 days</span>
              </div>
            </div>
            <div className="flex justify-between items-center pb-1">
              <span className="text-gray-400 font-medium">Inspections Due</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-status-warning">3</span>
                <span className="text-2xs text-gray-400">Within 30 days</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-1 flex items-center">
            <button 
              onClick={() => navigate('/compliance/overview')}
              className="text-xs-portal font-extrabold text-status-info hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              View Compliance <ChevronRight size={12} />
            </button>
          </div>
        </PortalCard>

        {/* Card 3: Tenancy Summary */}
        <PortalCard title="tenancy summary">
          <div className="flex flex-col text-xs-portal gap-2.5 mt-2">
            <div className="flex justify-between items-center border-b border-gray-50 pb-1.5">
              <span className="text-gray-400 font-medium">Occupied</span>
              <span className="font-mono font-bold text-brand-primary">11 (92%)</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-50 pb-1.5">
              <span className="text-gray-400 font-medium">Vacant</span>
              <span className="font-mono font-bold text-brand-primary">1 (8%)</span>
            </div>
            <div className="flex justify-between items-center pb-1">
              <span className="text-gray-400 font-medium">Average Tenancy Length</span>
              <span className="font-mono font-bold text-brand-primary">18.6 months</span>
            </div>
          </div>
          <div className="mt-4 pt-1 flex items-center">
            <button 
              onClick={() => navigate('/tenancy/overview')}
              className="text-xs-portal font-extrabold text-status-info hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              View Tenancy Lifecycle <ChevronRight size={12} />
            </button>
          </div>
        </PortalCard>

      </div>

    </div>
  );
};
