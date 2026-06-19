import React from 'react';
import { FolderOpen, FileText, Download } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { useToast } from '../components/UI/ToastContext';

const documentsData = [
  { id: 'DOC-881', name: 'AST Tenancy Lease Agreement.pdf', property: 'Flat 12, Living Towers, Manchester M1', category: 'Tenancy Contract', date: '2025-06-01' },
  { id: 'DOC-882', name: 'Gas Safety Certificate (CP12).pdf', property: 'Flat 12, Living Towers, Manchester M1', category: 'Compliance Certificate', date: '2025-05-14' },
  { id: 'DOC-883', name: 'Energy Performance Certificate (EPC).pdf', property: '78 Oak Avenue, Bristol BS2', category: 'Compliance Certificate', date: '2024-08-20' },
  { id: 'DOC-884', name: 'ROCA Living Terms of Business.pdf', property: 'All Properties', category: 'Terms of Business', date: '2024-06-11' },
];

export const Documents = () => {
  const { addToast } = useToast();

  const handleDownload = (name) => {
    addToast(`Downloading document: ${name} (Mock)`, 'success');
  };

  const columns = [
    { header: 'Document ID', accessor: 'id', sortable: true },
    { 
      header: 'File Name', 
      accessor: 'name', 
      sortable: true,
      renderCell: (row) => (
        <span className="inline-flex items-center gap-2 font-semibold text-gray-700">
          <FileText size={15} className="text-brand-accent shrink-0" />
          {row.name}
        </span>
      )
    },
    { header: 'Property Scope', accessor: 'property', sortable: true },
    { header: 'Document Type', accessor: 'category', sortable: true },
    { header: 'Upload Date', accessor: 'date', sortable: true },
    {
      header: 'Action',
      accessor: 'name',
      renderCell: (row) => (
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => handleDownload(row.name)}
          icon={Download}
        >
          Download
        </Button>
      )
    }
  ];

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#1A1A1A]">Shared Files & Agreements</h2>
        <p className="text-sm text-gray-500 mt-1">Access, download, and review lease agreements, compliance certificates, and corporate agency documentation.</p>
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        <DataTable columns={columns} data={documentsData} />
      </div>
    </div>
  );
};
