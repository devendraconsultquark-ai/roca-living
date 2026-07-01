import React, { useState } from 'react';
import { 
  Users, Home, FileText, Headphones, ChevronRight, Search 
} from 'lucide-react';
import { CirclePoundIcon } from '../components/UI/CirclePoundIcon';

export const Support = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const topicsData = [
    {
      title: 'Getting Started',
      description: 'Learn the basics of navigating and using your portal.',
      icon: Users,
      isCustomIcon: false
    },
    {
      title: 'Property',
      description: 'Manage your property details and information.',
      icon: Home,
      isCustomIcon: false
    },
    {
      title: 'Finances',
      description: 'Understand your balances, payments and statements.',
      icon: CirclePoundIcon,
      isCustomIcon: true
    },
    {
      title: 'Documents',
      description: 'Upload, view and manage your important documents.',
      icon: FileText,
      isCustomIcon: false
    },
    {
      title: 'Support',
      description: 'How to contact us and get further assistance.',
      icon: Headphones,
      isCustomIcon: false
    }
  ];

  // Dynamic search filtering
  const filteredTopics = topicsData.filter(topic => 
    topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    topic.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 font-sans text-brand-primary">
      
      {/* 1. How can we help widget */}
      <div className="bg-white border border-card-border rounded-card p-6 shadow-xs flex items-center justify-between gap-6 select-none">
        <div className="flex flex-col text-left gap-1.5 flex-grow">
          <h3 className="text-sm-portal font-black text-brand-primary">How can we help?</h3>
          
          <div className="relative mt-2 max-w-xl">
            <Search size={14} className="absolute left-3.5 top-3 text-gray-400" />
            <input 
              type="text"
              placeholder="Search for help topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-card-border rounded-card pl-10 pr-4 py-2 w-full text-xs-portal font-bold text-gray-500 bg-white placeholder-gray-400 focus:outline-none focus:border-gray-300 transition-colors"
            />
          </div>

          <p className="text-xs-portal text-gray-400 font-semibold mt-2.5">
            Find answers to common questions about using the portal.
          </p>
        </div>

        {/* Browser SVG Illustration */}
        <div className="hidden md:flex relative items-center justify-center w-24 h-24 bg-blue-50/30 rounded-full shrink-0">
          <svg className="w-14 h-14" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="15" y="25" width="70" height="50" rx="5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
            <rect x="15" y="25" width="70" height="12" rx="2" fill="#EDF2F7" />
            <circle cx="21" cy="31" r="1.5" fill="#CBD5E0" />
            <circle cx="26" cy="31" r="1.5" fill="#CBD5E0" />
            <circle cx="31" cy="31" r="1.5" fill="#CBD5E0" />
            <circle cx="50" cy="55" r="10" fill="#1A56DB" />
            <text x="47.5" y="58.5" fill="#FFFFFF" fontSize="10" fontWeight="bold" fontFamily="sans-serif">?</text>
          </svg>
        </div>
      </div>

      {/* 2. Help Topics List */}
      <div className="flex flex-col gap-3 select-none text-left">
        <h4 className="text-xs-portal font-black text-brand-primary uppercase tracking-wider pl-1">
          Help Topics
        </h4>

        <div className="bg-white border border-card-border rounded-card shadow-xs overflow-hidden divide-y divide-gray-50">
          {filteredTopics.map((topic, idx) => {
            const IconComponent = topic.icon;
            return (
              <div 
                key={idx}
                className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
                    <IconComponent size={14} className="shrink-0" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs-portal font-black text-brand-primary group-hover:text-status-info transition-colors leading-tight">
                      {topic.title}
                    </span>
                    <span className="text-2xs text-gray-400 font-semibold mt-1 leading-none">
                      {topic.description}
                    </span>
                  </div>
                </div>

                <ChevronRight size={13} className="text-gray-300 group-hover:text-status-info transition-colors" />
              </div>
            );
          })}

          {filteredTopics.length === 0 && (
            <div className="p-8 text-center text-xs-portal text-gray-400 font-semibold bg-white select-none">
              No matching help topics found. Try searching for something else.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
