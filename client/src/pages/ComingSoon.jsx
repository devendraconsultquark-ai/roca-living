import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowLeft } from 'lucide-react';
import { Button } from '../components/UI/Button';

export const ComingSoon = ({ title }) => {
  const navigate = useNavigate();

  return (
    <div className="py-12 max-w-xl mx-auto px-4 text-center flex flex-col items-center justify-center min-h-[60vh]">
      <div className="bg-white border border-card-border rounded-card p-8 shadow-premium w-full flex flex-col items-center gap-6">
        
        {/* Animated Clock Icon Container */}
        <div className="w-16 h-16 rounded-full bg-brand-accent/10 text-brand-accent flex items-center justify-center">
          <Clock size={32} />
        </div>
        
        {/* Text Details */}
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
          <p className="text-sm font-semibold text-status-info uppercase tracking-wider">Coming Soon</p>
          <p className="text-sm text-text-secondary max-w-sm mt-2 leading-relaxed">
            We are working hard to build the features for {title}. This section will be launched soon!
          </p>
        </div>

        {/* Back Button */}
        <Button 
          variant="secondary" 
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 mt-4"
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </Button>
      </div>
    </div>
  );
};
