import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Home, Wrench, Wallet, ArrowRight, UserPlus, PlusCircle } from 'lucide-react';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';
import api from '../utilities/api';

export const Dashboard = () => {
  const [pipeline, setPipeline] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pipelineRes, activitiesRes] = await Promise.all([
          api.get('/reports/pipeline'),
          api.get('/reports/recent-activity')
        ]);
        setPipeline(pipelineRes.data.data);
        setActivities(activitiesRes.data.data || []);
      } catch (err) {
        console.error('Failed to fetch dashboard reports data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = [
    { 
      name: 'YTD Revenue Collected', 
      value: pipeline ? `£${parseFloat(pipeline.ytd_revenue).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '£0.00', 
      icon: Wallet, 
      color: 'text-brand-accent bg-brand-accent/10', 
      valueColor: 'text-brand-accent' 
    },
    { 
      name: 'Active Landlords', 
      value: pipeline ? `${pipeline.total_landlords} Partners` : '0 Partners', 
      icon: Users, 
      color: 'text-brand-primary bg-brand-primary/10', 
      valueColor: 'text-[#1A1A1A]' 
    },
    { 
      name: 'Occupancy Rate', 
      value: pipeline && pipeline.total_properties > 0 ? `${(pipeline.let / pipeline.total_properties * 100).toFixed(1)}%` : '0.0%', 
      icon: Home, 
      color: 'text-status-success bg-status-success/10', 
      valueColor: 'text-status-success' 
    },
    { 
      name: 'Open Maintenance', 
      value: pipeline ? `${pipeline.maintenance_open} Tickets` : '0 Tickets', 
      icon: Wrench, 
      color: 'text-status-warning bg-status-warning/10', 
      valueColor: 'text-status-warning' 
    },
  ];

  const recentActivities = activities.slice(0, 5); // display up to 5 entries

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col gap-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Welcome back, Admin</h2>
          <p className="text-sm text-gray-500 mt-1">Here is a summary of your ROCA Living portfolios and ongoing workflows.</p>
        </div>
        
        <Link to="/onboarding">
          <Button variant="primary" icon={PlusCircle} className="shadow-sm">
            New Onboarding
          </Button>
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, idx) => (
          <StatCard
            key={idx}
            label={stat.name}
            value={stat.value}
            icon={stat.icon}
            iconColor={stat.color}
            valueColor={stat.valueColor}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions Panel */}
        <div className="bg-white border border-[#DDDDDD] rounded-[8px] p-4 shadow-xs flex flex-col gap-5 lg:col-span-1">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider select-none">Quick Workflows</h3>
          <div className="flex flex-col gap-3">
            <Link to="/onboarding" className="group p-4 bg-[#F8FAFC] border border-border-color/60 rounded-xl hover:bg-brand-primary/5 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-accent/10 text-brand-accent flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-700">Landlord Wizard</h4>
                  <p className="text-[11px] text-gray-400 font-semibold mt-0.5">Onboard landlord & property</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-gray-400 group-hover:text-brand-accent transition-colors" />
            </Link>

            <Link to="/maintenance" className="group p-4 bg-[#F8FAFC] border border-border-color/60 rounded-xl hover:bg-brand-primary/5 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-status-warning/10 text-status-warning flex items-center justify-center">
                  <Wrench size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-700">Maintenance Board</h4>
                  <p className="text-[11px] text-gray-400 font-semibold mt-0.5">Manage contractor quotes</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-gray-400 group-hover:text-status-warning transition-colors" />
            </Link>

            <Link to="/accounting" className="group p-4 bg-[#F8FAFC] border border-border-color/60 rounded-xl hover:bg-brand-primary/5 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center">
                  <Wallet size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-700">Accounting Hub</h4>
                  <p className="text-[11px] text-gray-400 font-semibold mt-0.5">Reconcile rental income</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-gray-400 group-hover:text-status-success transition-colors" />
            </Link>
          </div>
        </div>

        {/* Recent Activity List */}
        <div className="bg-white border border-[#DDDDDD] rounded-[8px] p-4 shadow-xs flex flex-col gap-4 lg:col-span-2">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider select-none">Recent Staff Notifications</h3>
          <div className="flex flex-col gap-3.5">
            {loading ? (
              <div className="h-28 bg-gray-50 rounded-xl animate-pulse w-full" />
            ) : recentActivities.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No recent activities found.</p>
            ) : (
              recentActivities.map(act => (
                <div key={act.id} className="flex items-start justify-between gap-4 p-3.5 hover:bg-[#F8FAFC] rounded-xl transition-colors border border-transparent hover:border-border-color/40">
                  <div className="flex items-start gap-3">
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      act.type === 'success' ? 'bg-status-success' : act.type === 'danger' ? 'bg-status-danger' : 'bg-brand-accent'
                    }`} />
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-gray-700 leading-none">{act.title}</h4>
                      <p className="text-xs text-gray-400 font-semibold mt-1.5">{act.desc}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 shrink-0">{act.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
