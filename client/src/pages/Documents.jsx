import React, { useState, useEffect } from 'react';
import { usePropertyContext } from '../context/PropertyContext';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, ShieldCheck, Clock, AlertCircle, Plus, ChevronRight, HardDrive, MoreVertical 
} from 'lucide-react';
import { PortalMetricCard } from '../components/UI/PortalMetricCard';
import { FilterRibbon } from '../components/UI/FilterRibbon';
import { Pagination } from '../components/UI/Pagination';
import { TableEmptyState } from '../components/UI/TableEmptyState';

export const Documents = () => {
  const { selectedProperty } = usePropertyContext();
  const navigate = useNavigate();

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All Types');
  const [filterCategory, setFilterCategory] = useState('All Categories');
  const [filterRelated, setFilterRelated] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All Statuses');

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const documentsData = [];

  useEffect(() => {
    setCurrentPage(1);
  }, [documentsData]);

  const totalItems = documentsData.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedDocuments = documentsData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const stats = {
    total: documentsData.length,
    upToDate: 0,
    upToDatePct: 0,
    expiringSoon: 0,
    expiringSoonPct: 0,
    expired: 0,
    expiredPct: 0
  };

  const filtersConfig = [
    {
      label: 'Document Type',
      value: filterType,
      onChange: setFilterType,
      options: [{ value: 'All Types', label: 'All Types' }],
      width: 'w-32'
    },
    {
      label: 'Category',
      value: filterCategory,
      onChange: setFilterCategory,
      options: [{ value: 'All Categories', label: 'All Categories' }],
      width: 'w-36'
    },
    {
      label: 'Related To',
      value: filterRelated,
      onChange: setFilterRelated,
      options: [{ value: 'All', label: 'All' }],
      width: 'w-32'
    },
    {
      label: 'Status',
      value: filterStatus,
      onChange: setFilterStatus,
      options: [{ value: 'All Statuses', label: 'All Statuses' }],
      width: 'w-32'
    }
  ];

  const searchConfig = {
    value: searchQuery,
    onChange: (e) => setSearchQuery(e.target.value),
    placeholder: 'Search documents...'
  };

  const actionConfig = {
    label: 'Upload Document',
    icon: Plus,
    onClick: () => {}
  };

  return (
    <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 font-sans text-brand-primary">
      
      {/* Metric Cards Grid (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <PortalMetricCard 
          label="Total Documents" 
          value={stats.total}
          icon={FileText}
          variant="info"
          actionText="View All Documents"
          onActionClick={() => {}}
        />
        <PortalMetricCard 
          label="Up to Date" 
          value={`${stats.upToDate} (${stats.upToDatePct}%)`}
          icon={ShieldCheck}
          variant="success"
          actionText="View Up to Date"
          onActionClick={() => {}}
        />
        <PortalMetricCard 
          label="Expiring Soon" 
          value={`${stats.expiringSoon} (${stats.expiringSoonPct}%)`}
          icon={Clock}
          variant="warning"
          actionText="View Expiring Soon"
          onActionClick={() => {}}
        />
        <PortalMetricCard 
          label="Expired" 
          value={`${stats.expired} (${stats.expiredPct}%)`}
          icon={AlertCircle}
          variant="danger"
          actionText="View Expired"
          onActionClick={() => {}}
        />
      </div>

      {/* Main Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Table & Filter Ribbon (9 Columns) */}
        <div className="lg:col-span-9 flex flex-col gap-5">
          
          {/* Ribbon Filters */}
          <FilterRibbon
            filters={filtersConfig}
            search={searchConfig}
            action={actionConfig}
          />

          {/* Table Container Card */}
          <div className="bg-white border border-card-border rounded-card p-5 shadow-xs flex flex-col justify-between overflow-hidden min-h-[300px]">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs-portal">
                <thead>
                  <tr className="border-b border-card-border text-2xs text-gray-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-2">Document Name</th>
                    <th className="py-3 px-2">Category</th>
                    <th className="py-3 px-2">Related To</th>
                    <th className="py-3 px-2">Uploaded</th>
                    <th className="py-3 px-2">Expiry Date</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {documentsData.length === 0 ? (
                    <TableEmptyState
                      colSpan={7}
                      loading={false}
                      emptyText="No documents stored."
                      className="py-8 text-center text-gray-400 font-semibold"
                    />
                  ) : (
                    paginatedDocuments.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-2">{row.item}</td>
                        <td className="py-3 px-2">{row.category}</td>
                        <td className="py-3 px-2">{row.related}</td>
                        <td className="py-3 px-2">{row.uploaded}</td>
                        <td className="py-3 px-2">{row.expires}</td>
                        <td className="py-3 px-2">{row.status}</td>
                        <td className="py-3 px-2 text-center">
                          <button className="p-1 hover:text-brand-primary rounded cursor-pointer">
                            <MoreVertical size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalItems}
              pageSize={pageSize}
              itemLabel="documents"
            />

          </div>

        </div>

        {/* Right Side: Sidebar Panels (3 Columns) */}
        <div className="lg:col-span-3 flex flex-col gap-6 select-none">
          
          {/* Document Categories */}
          <div className="bg-white border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-4">
            <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider pb-2 border-b border-gray-50">
              Document Categories
            </h3>

            <div className="flex flex-col gap-3 mt-1 text-xs-portal font-bold text-gray-500">
              <div className="flex justify-between items-center">
                <span>Tenancy</span>
                <span className="px-2 py-0.5 rounded-full bg-status-info-bg text-status-info text-2xs font-extrabold">0</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-50 pt-2.5">
                <span>Certificates</span>
                <span className="px-2 py-0.5 rounded-full bg-status-info-bg text-status-info text-2xs font-extrabold">0</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-50 pt-2.5">
                <span>Compliance</span>
                <span className="px-2 py-0.5 rounded-full bg-status-warning/10 text-status-warning text-2xs font-extrabold">0</span>
              </div>
            </div>

            <button className="text-xs-portal font-bold text-status-info hover:underline text-left mt-1 flex items-center gap-0.5 cursor-pointer">
              View All Categories <ChevronRight size={10} />
            </button>
          </div>

          {/* Recent Uploads */}
          <div className="bg-white border border-card-border rounded-card p-5 shadow-xs flex flex-col gap-4">
            <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider pb-2 border-b border-gray-50">
              Recent Uploads
            </h3>

            <div className="flex flex-col gap-3 mt-1">
              <div className="text-xs-portal text-gray-400 font-semibold py-2">No recent uploads</div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
