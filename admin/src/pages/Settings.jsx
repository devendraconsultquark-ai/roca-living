import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Newspaper, Plus, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import { XeroConnection } from '../components/UI/XeroConnection';
import api from '../utilities/api';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export const Settings = () => {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [agencyFee, setAgencyFee] = useState('12.0');
  const [depositSchemeNum, setDepositSchemeNum] = useState('TDS-ROCA-5001');
  const [vatRate, setVatRate] = useState('20.0');
  const [loading, setLoading] = useState(false);

  // Legislation & News manager
  const [newsItems, setNewsItems] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsForm, setNewsForm] = useState({ title: '', url: '', published_on: '' });
  const [savingNews, setSavingNews] = useState(false);
  const [newsReloadKey, setNewsReloadKey] = useState(0);
  const refreshNews = () => setNewsReloadKey((k) => k + 1);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await api.get('/news');
        setNewsItems(res.data.data || []);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load news items', 'error');
      } finally {
        setNewsLoading(false);
      }
    };
    fetchNews();
  }, [newsReloadKey, addToast]);

  const handleAddNews = async (e) => {
    e.preventDefault();
    if (!newsForm.title.trim() || !newsForm.published_on) {
      addToast('Title and date are required', 'warning');
      return;
    }
    setSavingNews(true);
    try {
      await api.post('/news', {
        title: newsForm.title.trim(),
        url: newsForm.url.trim() || null,
        published_on: newsForm.published_on,
      });
      addToast('News item published', 'success');
      setNewsForm({ title: '', url: '', published_on: '' });
      refreshNews();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to add news item', 'error');
    } finally {
      setSavingNews(false);
    }
  };

  const handleToggleArchive = async (item) => {
    try {
      await api.patch(`/news/${item.id}`, { status: item.status === 'active' ? 'archived' : 'active' });
      addToast(item.status === 'active' ? 'News item archived' : 'News item restored', 'success');
      refreshNews();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update news item', 'error');
    }
  };

  const handleDeleteNews = async (item) => {
    const ok = await confirm({
      title: 'Delete News Item',
      message: `Permanently delete “${item.title}”? This cannot be undone.`,
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await api.delete(`/news/${item.id}`);
      addToast('News item deleted', 'success');
      refreshNews();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete news item', 'error');
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/settings');
        if (response.data?.success && response.data?.data) {
          const { agencyFee, depositSchemeNum, vatRate } = response.data.data;
          if (agencyFee !== undefined) setAgencyFee(agencyFee);
          if (depositSchemeNum !== undefined) setDepositSchemeNum(depositSchemeNum);
          if (vatRate !== undefined) setVatRate(vatRate);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
        addToast('Failed to load settings from server', 'error');
      }
    };
    fetchSettings();
  }, [addToast]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/settings', {
        agencyFee,
        vatRate,
        depositSchemeNum
      });
      if (response.data?.success) {
        addToast('System settings saved successfully!', 'success');
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      addToast(err.response?.data?.message || 'Failed to save settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      {/* Settings Form (title lives in the layout header) */}
      <form onSubmit={handleSave} className="card-bg border border-card-border rounded-card p-6 md:p-8 shadow-premium flex flex-col gap-6">

        {/* Billing Section */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider flex items-center gap-2 select-none">
            <SettingsIcon size={16} className="text-brand-accent" />
            Financial Settings
          </h3>
          <div className="border-t border-card-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input
              label="Standard Management Commission Fee (%)"
              id="agencyFee"
              required
              value={agencyFee}
              onChange={(e) => setAgencyFee(e.target.value)}
              disabled={loading}
            />
            <Input
              label="Value Added Tax (VAT) rate (%)"
              id="vatRate"
              required
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {/* Deposit scheme parameters */}
        <div className="flex flex-col gap-4 mt-2">
          <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider flex items-center gap-2 select-none">
            <SettingsIcon size={16} className="text-brand-accent" />
            Deposit Protection Settings
          </h3>
          <div className="border-t border-card-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input
              label="Tenancy Deposit Scheme (TDS) Agency ID"
              id="depositSchemeNum"
              required
              value={depositSchemeNum}
              onChange={(e) => setDepositSchemeNum(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="border-t border-card-border pt-6 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            icon={Save}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

      </form>

      {/* Xero — accounting integration (money source of truth) */}
      <XeroConnection />

      {/* Legislation & News manager — feeds the dashboard's "Legislation & News" card */}
      <div className="card-bg border border-card-border rounded-card p-6 md:p-8 shadow-premium flex flex-col gap-5">
        <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider flex items-center gap-2 select-none">
          <Newspaper size={16} className="text-brand-accent" />
          Legislation &amp; News
        </h3>

        {/* Add item */}
        <form onSubmit={handleAddNews} className="border-t border-card-border pt-4 grid grid-cols-1 sm:grid-cols-[2fr_2fr_1fr_auto] gap-4 items-end">
          <Input
            label="Title"
            id="news-title"
            required
            placeholder="e.g. Renters' Rights Bill — latest updates"
            value={newsForm.title}
            onChange={(e) => setNewsForm((f) => ({ ...f, title: e.target.value }))}
            disabled={savingNews}
          />
          <Input
            label="Link (optional)"
            id="news-url"
            type="url"
            placeholder="https://…"
            value={newsForm.url}
            onChange={(e) => setNewsForm((f) => ({ ...f, url: e.target.value }))}
            disabled={savingNews}
          />
          <Input
            label="Date"
            id="news-date"
            type="date"
            required
            value={newsForm.published_on}
            onChange={(e) => setNewsForm((f) => ({ ...f, published_on: e.target.value }))}
            disabled={savingNews}
          />
          <Button type="submit" variant="primary" icon={Plus} disabled={savingNews}>
            {savingNews ? 'Adding…' : 'Add'}
          </Button>
        </form>

        {/* Item list */}
        <div className="flex flex-col">
          {newsLoading ? (
            <p className="text-xs text-gray-400 font-semibold py-4 text-center">Loading news items…</p>
          ) : newsItems.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-4 text-center">
              No news items yet. Items you add here appear on the admin dashboard.
            </p>
          ) : (
            newsItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 py-3 border-b border-card-border/60 last:border-0">
                <div className="min-w-0">
                  <p className={`text-xs font-bold truncate ${item.status === 'archived' ? 'text-gray-400 line-through' : 'text-brand-primary'}`}>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer" className="hover:text-brand-accent transition-colors">
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </p>
                  <p className="text-2xs text-gray-400 font-semibold mt-0.5">
                    {fmtDate(item.published_on)}{item.status === 'archived' ? ' • Archived' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={item.status === 'active' ? Archive : ArchiveRestore}
                    onClick={() => handleToggleArchive(item)}
                  >
                    {item.status === 'active' ? 'Archive' : 'Restore'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    className="text-status-danger"
                    onClick={() => handleDeleteNews(item)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
