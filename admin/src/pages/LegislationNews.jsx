import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from '../components/UI/Skeleton';
import { NewsList } from '../components/UI/NewsList';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

// Read-only list of legislation & news items. They are added and archived
// under Settings.
export const LegislationNews = () => {
  const { addToast } = useToast();
  const [news, setNews] = useState(null);

  useEffect(() => {
    api.get('/news', { params: { status: 'active' } })
      .then((res) => setNews(res.data.data || []))
      .catch((err) => {
        addToast(err.response?.data?.message || 'Failed to load news', 'error');
        setNews([]);
      });
  }, [addToast]);

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between pb-3 border-b border-card-border">
          <h3 className="text-sm-portal font-bold text-brand-primary">Latest Updates</h3>
          <Link to="/settings" className="text-2xs font-bold text-brand-accent hover:text-brand-accent-hover transition-colors shrink-0">
            Manage news
          </Link>
        </div>
        {news === null ? (
          <Skeleton radius="card" className="h-40 w-full" />
        ) : news.length === 0 ? (
          <p className="text-xs text-gray-400 font-semibold py-8 text-center">No news items yet — add them under Settings.</p>
        ) : (
          <NewsList news={news} />
        )}
      </div>
    </div>
  );
};
