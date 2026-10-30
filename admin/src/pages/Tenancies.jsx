import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CalendarClock, AlertTriangle, X, RefreshCw, BarChart3, UserPlus, TrendingUp, ShieldCheck } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { DatePicker } from '../components/UI/DatePicker';
import { Dropdown } from '../components/UI/Dropdown';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { Skeleton } from '../components/UI/Skeleton';
import { ListTabs, ExportButton } from '../components/UI/ListToolbar';
import {
  PageActions, KpiRow, KpiCard, WithRail, SectionCard, Donut, QuickActions, UpcomingList,
  InfoFooter, Pill, PersonCell, Two, SearchInput, RowMenu,
} from '../components/UI/DesignKit';
import { C, gbp, shortDate, daysUntil, pct } from '../utilities/designTokens';
import api from '../utilities/api';
import { downloadCsv } from '../utilities/csv';
import { InfoTip } from '../components/UI/InfoTip';

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_LABELS = {
  active: 'Active',
  pending: 'Pending',
  notice: 'Notice Served',
  ended: 'Ended',
};

// Design p16 (Tenancies): KPI row, tenancy list with "Next Action", overview
// donut, upcoming end dates and quick actions. Actions are unchanged.
const nextAction = (t) => {
  if (t.rawStatus === 'ended') return { label: 'Ended', when: t.rawEndDate };
  if (t.rawReviewStatus && !['none', 'completed'].includes(t.rawReviewStatus) && t.rawReviewDate) {
    return { label: 'Rent review', when: t.rawReviewDate, tone: 'orange' };
  }
  const d = daysUntil(t.rawEndDate);
  if (d !== null && d >= 0 && d <= 90) return { label: `Ends in ${d} day${d === 1 ? '' : 's'}`, when: t.rawEndDate, tone: 'orange' };
  if (t.rawStatus === 'pending') return { label: 'Activate', tone: 'blue' };
  return null;
};

export const Tenancies = () => {
  const navigate = useNavigate();
  const [tenancies, setTenancies] = useState([]);
  const [arrearsByTenancy, setArrearsByTenancy] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState('all');
  const { addToast } = useToast();
  const confirm = useConfirm();

  // End-tenancy modal state
  const [endTarget, setEndTarget] = useState(null);
  const [endDate, setEndDate] = useState('');
  const [ending, setEnding] = useState(false);

  // Rent-review modal state
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewForm, setReviewForm] = useState({ date: '', proposed: '', status: 'scheduled' });
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    const fetchTenancies = async () => {
      setLoading(true);
      try {
        const res = await api.get('/tenancies');
        const formatted = (res.data.data || []).map((t) => ({
          rawId: t.id,
          id: `TNC-${String(t.id).padStart(4, '0')}`,
          tenant: t.lead_tenant_name || '—',
          landlord: t.landlord_name || '—',
          property: `${t.address_line1 || ''}, ${t.city || ''} ${t.postcode || ''}`.trim(),
          start: t.start_date || '—',
          end: t.end_date || '—',
          rent: parseFloat(t.rent_pcm || 0),
          tenantEmail: t.lead_tenant_email || null,
          tenantId: t.lead_tenant_id || null,
          propertyName: t.property_name || null,
          postcode: t.postcode || null,
          rawStartDate: t.start_date,
          rawStatus: t.status,
          rawEndDate: t.end_date,
          rawReviewDate: t.rent_review_date,
          rawProposedRent: t.proposed_rent,
          rawReviewStatus: t.rent_review_status,
        }));
        setTenancies(formatted);
        // Same source as the Arrears page this KPI links to.
        const arrears = await api.get('/reports/arrears', { skipInterceptorError: true }).catch(() => null);
        const owed = {};
        (arrears?.data?.data?.overdue_schedules || []).forEach((r) => {
          owed[r.tenancy_id] = (owed[r.tenancy_id] || 0) + parseFloat(r.amount || 0);
        });
        setArrearsByTenancy(owed);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load tenancies', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchTenancies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const patchTenancy = async (row, payload, successMsg) => {
    try {
      await api.patch(`/tenancies/${row.rawId}`, payload);
      addToast(successMsg, 'success');
      setReloadKey((k) => k + 1);
      return true;
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update tenancy', 'error');
      return false;
    }
  };

  const handleActivate = async (row) => {
    await patchTenancy(row, { status: 'active' }, `${row.id} activated`);
  };

  const handleServeNotice = async (row) => {
    const ok = await confirm({
      title: 'Serve Notice',
      message: `Mark ${row.id} (${row.tenant}) as under notice? The tenancy stays live until it is ended.`,
      confirmText: 'Serve Notice',
    });
    if (ok) await patchTenancy(row, { status: 'notice' }, `Notice recorded for ${row.id}`);
  };

  const handleRescindNotice = async (row) => {
    await patchTenancy(row, { status: 'active' }, `Notice rescinded for ${row.id}`);
  };

  const openEndModal = (row) => {
    setEndTarget(row);
    const now = new Date(); // local date — toISOString() is a day behind before 01:00 BST
    setEndDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
  };

  const handleEndSubmit = async (e) => {
    e.preventDefault();
    if (!endDate) {
      addToast('End date is required', 'warning');
      return;
    }
    setEnding(true);
    const ok = await patchTenancy(
      endTarget,
      { status: 'ended', end_date: endDate },
      `${endTarget.id} ended — future unpaid rent schedules removed`
    );
    setEnding(false);
    if (ok) setEndTarget(null);
  };

  const openReviewModal = (row) => {
    setReviewTarget(row);
    setReviewForm({
      date: row.rawReviewDate || '',
      proposed: row.rawProposedRent || '',
      status: row.rawReviewStatus && row.rawReviewStatus !== 'none' ? row.rawReviewStatus : 'scheduled',
    });
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewForm.date) {
      addToast('Review date is required', 'warning');
      return;
    }
    setSavingReview(true);
    try {
      const res = await api.patch(`/tenancies/${reviewTarget.rawId}/rent-review`, {
        rent_review_date: reviewForm.date,
        proposed_rent: reviewForm.proposed === '' ? null : reviewForm.proposed,
        rent_review_status: reviewForm.status,
      });
      addToast(res.data.applied ? `${reviewTarget.id}: ${res.data.message}` : `Rent review saved for ${reviewTarget.id}`, 'success');
      setReviewTarget(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to save rent review', 'error');
    } finally {
      setSavingReview(false);
    }
  };

  const handleReviewClear = async () => {
    const ok = await confirm({
      title: 'Remove Rent Review',
      message: `Remove the scheduled rent review for ${reviewTarget.id}? The review date and proposed rent will be cleared.`,
      confirmText: 'Remove Review',
    });
    if (!ok) return;
    setSavingReview(true);
    try {
      await api.patch(`/tenancies/${reviewTarget.rawId}/rent-review`, { rent_review_status: 'none' });
      addToast(`Rent review removed for ${reviewTarget.id}`, 'success');
      setReviewTarget(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to remove rent review', 'error');
    } finally {
      setSavingReview(false);
    }
  };

  const expiringSoon = (t) => {
    if (!t.rawEndDate || t.rawStatus !== 'active') return false;
    const diff = new Date(t.rawEndDate) - new Date();
    return diff > 0 && diff <= 60 * DAY_MS;
  };

  const activeCount = tenancies.filter((t) => t.rawStatus === 'active').length;
  const expiringCount = tenancies.filter(expiringSoon).length;
  const pendingCount = tenancies.filter((t) => t.rawStatus === 'pending').length;

  // Renewals due: live tenancies whose end date falls within the next 90 days
  const renewalsDue = tenancies.filter((t) => {
    if (!t.rawEndDate || !['active', 'notice'].includes(t.rawStatus)) return false;
    const diff = new Date(t.rawEndDate) - new Date();
    return diff > 0 && diff <= 90 * DAY_MS;
  }).length;

  // Average tenancy length (months) across tenancies with a start and end date
  const withTerm = tenancies.filter((t) => t.start !== '—' && t.rawEndDate);
  const avgMonths = withTerm.length
    ? withTerm.reduce((s, t) => s + (new Date(t.rawEndDate) - new Date(t.start)) / (DAY_MS * 30.44), 0) / withTerm.length
    : null;

  // Status tabs (design: All / Active / Ending soon / Expired / Terminated)
  const TAB_FILTERS = {
    all: () => true,
    active: (t) => t.rawStatus === 'active',
    ending: expiringSoon,
    notice: (t) => t.rawStatus === 'notice',
    pending: (t) => t.rawStatus === 'pending',
    ended: (t) => t.rawStatus === 'ended',
  };
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'ending', label: 'Ending soon' },
    { id: 'notice', label: 'Notice given' },
    { id: 'pending', label: 'Pending' },
    { id: 'ended', label: 'Ended' },
  ].map((t) => ({ ...t, count: tenancies.filter(TAB_FILTERS[t.id]).length }));
  const q = search.trim().toLowerCase();
  const visible = tenancies.filter(TAB_FILTERS[tab])
    .filter((t) => !q || [t.id, t.tenant, t.tenantEmail, t.landlord, t.property, t.propertyName].some((v) => String(v || '').toLowerCase().includes(q)));

  const live = tenancies.filter((t) => ['active', 'notice', 'pending'].includes(t.rawStatus));
  const arrearsIds = Object.keys(arrearsByTenancy).map(Number).filter((id) => live.some((t) => t.rawId === id));
  const arrearsTotal = arrearsIds.reduce((s2, id) => s2 + arrearsByTenancy[id], 0);
  const endedCount = tenancies.filter((t) => t.rawStatus === 'ended').length;
  const noticeCount = tenancies.filter((t) => t.rawStatus === 'notice').length;
  const activeOnly = Math.max(activeCount - expiringCount, 0);
  const donut = [
    { label: 'Active', value: activeOnly, color: C.green },
    { label: 'Ending Soon', value: expiringCount, color: C.amber },
    { label: 'Notice Given', value: noticeCount, color: C.blue },
    { label: 'Pending', value: pendingCount, color: C.purple },
    { label: 'Ended', value: endedCount, color: C.red },
  ].map((d) => ({ ...d, display: `${d.value} (${pct(d.value, tenancies.length)})` }));
  const upcomingEnds = live
    .filter((t) => { const d = daysUntil(t.rawEndDate); return d !== null && d >= 0; })
    .sort((x, y) => new Date(x.rawEndDate) - new Date(y.rawEndDate))
    .slice(0, 4);

  const exportCsv = () => downloadCsv('tenancies.csv', visible, [
    { key: 'id', label: 'Tenancy ID' },
    { key: 'tenant', label: 'Lead Tenant' },
    { key: 'landlord', label: 'Landlord' },
    { key: 'property', label: 'Property' },
    { key: 'start', label: 'Start Date' },
    { key: 'end', label: 'End Date' },
    { key: (r) => r.rent.toFixed(2), label: 'Monthly Rent (£)' },
    { key: (r) => STATUS_LABELS[r.rawStatus] || r.rawStatus, label: 'Status' },
  ]);

  const columns = [
    {
      header: 'Tenant',
      accessor: 'tenant',
      sortable: true,
      renderCell: (row) => <PersonCell name={row.tenant} sub={row.tenantEmail || row.id} />,
    },
    {
      header: 'Property',
      accessor: 'property',
      sortable: true,
      renderCell: (row) => <Two top={row.propertyName || row.property} bottom={[row.postcode, row.landlord !== '—' ? `Landlord: ${row.landlord}` : null].filter(Boolean).join(' · ')} width="max-w-[190px]" />,
    },
    {
      header: 'Tenancy Period',
      accessor: 'rawStartDate',
      sortable: true,
      renderCell: (row) => <Two top={shortDate(row.rawStartDate)} bottom={row.rawEndDate ? `– ${shortDate(row.rawEndDate)}` : '– Periodic'} width="max-w-[120px]" />,
    },
    { header: 'Rent (PCM)', accessor: 'rent', align: 'right', sortable: true, renderCell: (row) => gbp(row.rent) },
    {
      header: 'Status',
      accessor: 'rawStatus',
      sortable: true,
      renderCell: (row) => {
        if (expiringSoon(row)) return <Pill tone="orange">Ending Soon</Pill>;
        const tone = { active: 'green', pending: 'orange', notice: 'blue', ended: 'grey' }[row.rawStatus] || 'grey';
        return <Pill tone={tone}>{STATUS_LABELS[row.rawStatus] || 'Ended'}</Pill>;
      },
    },
    {
      header: 'Next Action',
      accessor: 'rawReviewDate',
      renderCell: (row) => {
        const n = nextAction(row);
        if (!n) return <span className="text-gray-400">None</span>;
        return <Two top={<span className={n.tone === 'orange' ? 'text-status-warning' : n.tone === 'blue' ? 'text-status-info' : ''}>{n.label}</span>} bottom={n.when ? shortDate(n.when) : null} />;
      },
    },
    {
      header: 'Actions',
      accessor: 'rawId',
      align: 'center',
      renderCell: (row) => {
        const live = row.rawStatus === 'active' || row.rawStatus === 'notice';
        return (
          <RowMenu
            label={`Actions for ${row.id}`}
            items={[
              row.rawStatus === 'pending' && { label: 'Activate', onClick: () => handleActivate(row) },
              row.rawStatus === 'active' && { label: 'Serve Notice', onClick: () => handleServeNotice(row) },
              row.rawStatus === 'notice' && { label: 'Rescind Notice', onClick: () => handleRescindNotice(row) },
              live && { label: row.rawReviewStatus && row.rawReviewStatus !== 'none' ? 'Rent Review…' : 'Rent Review', onClick: () => openReviewModal(row) },
              row.tenantId && { label: 'View Tenant', onClick: () => navigate(`/tenants/${row.tenantId}`) },
              live && { label: 'End Tenancy', danger: true, onClick: () => openEndModal(row) },
            ]}
          />
        );
      },
    },
  ];

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <PageActions>
        <ExportButton onClick={exportCsv} disabled={loading || !visible.length} />
        <Button variant="accent" icon={UserPlus} onClick={() => navigate('/tenants')}>New Tenancy</Button>
      </PageActions>

      <KpiRow>
        <KpiCard icon={FileText} tone="indigo" label="Active Tenancies" value={activeCount} sub={`${pct(activeCount, tenancies.length)} of all tenancies`} link="View active" onClick={() => setTab('active')} loading={loading} />
        <KpiCard icon={CalendarClock} tone="green" label="Tenancies Ending Soon" value={expiringCount} sub="Within next 60 days" link="View upcoming" onClick={() => setTab('ending')} loading={loading} />
        <KpiCard icon={AlertTriangle} tone="orange" label="Tenancies in Arrears" value={arrearsIds.length} sub={`Total overdue: ${gbp(arrearsTotal)}`} subTone={arrearsTotal > 0 ? 'red' : undefined} link="View arrears" to="/arrears" loading={loading} />
        <KpiCard icon={RefreshCw} tone="blue" label="Renewals Due (90 days)" value={renewalsDue} sub="Require attention" link="View renewals" to="/renewals" loading={loading} />
        <KpiCard icon={BarChart3} tone="indigo" label="Average Tenancy Length" value={avgMonths !== null ? `${avgMonths.toFixed(1)} months` : '—'} sub="Tenancies with an end date" loading={loading} />
      </KpiRow>

      <WithRail
        rail={(
          <>
            <SectionCard title="Tenancy Overview" action="View Report" to="/reports">
              <Donut data={donut} centre={tenancies.length} sub="Total" />
            </SectionCard>
            <SectionCard title="Upcoming End Dates" action="View all" onAction={() => setTab('ending')}>
              <UpcomingList
                empty="No tenancy end dates coming up."
                items={upcomingEnds.map((t) => {
                  const d = daysUntil(t.rawEndDate);
                  return {
                    key: t.rawId,
                    title: t.tenant,
                    sub: t.propertyName || t.property,
                    date: shortDate(t.rawEndDate),
                    badge: `${d} day${d === 1 ? '' : 's'}`,
                    badgeTone: d <= 30 ? 'red' : d <= 60 ? 'orange' : 'grey',
                  };
                })}
              />
            </SectionCard>
            <QuickActions items={[
              { icon: UserPlus, label: 'Create New Tenancy', sub: 'Add a tenant to an apartment', to: '/tenants' },
              { icon: TrendingUp, label: 'Rent Review', sub: 'Review or increase rent', to: '/rent-reviews' },
              { icon: ShieldCheck, label: 'Deposits', sub: 'Protection and returns', to: '/deposits' },
              { icon: BarChart3, label: 'Tenancy Reports', sub: 'Generate tenancy reports', to: '/reports' },
            ]} />
          </>
        )}
      >
        <SectionCard title="Tenancy List">
          <div className="flex items-end justify-between gap-3 flex-wrap border-b border-card-border">
            <ListTabs tabs={tabs} value={tab} onChange={setTab} />
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search tenancies…" className="w-full md:w-96" />
          {loading ? (
            <div className="space-y-4 py-4">
              <Skeleton radius="bar" className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <DataTable columns={columns} data={visible} onRowClick={(row) => row.tenantId && navigate(`/tenants/${row.tenantId}`)} />
          )}
        </SectionCard>
      </WithRail>

      <InfoFooter text="Tenancy dates and rent come from each tenancy; arrears from rent due and payments received." onRefresh={() => setReloadKey((k) => k + 1)} />

      {/* End Tenancy Modal */}
      {endTarget && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-card-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-primary flex items-center gap-1.5">End Tenancy <InfoTip text="Unpaid rent months after the end date are removed. The flat becomes vacant if no other tenancy is live." /></h3>
              <button onClick={() => setEndTarget(null)} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-status-muted mb-4 leading-snug">
              End {endTarget.id} ({endTarget.tenant} at {endTarget.property})? This can't be undone.
            </p>

            <form onSubmit={handleEndSubmit} className="flex flex-col gap-4">
              <DatePicker
                label="Tenancy End Date"
                id="tnc-end-date"
                required
                value={endDate}
                onChange={(v) => setEndDate(v)}
              />

              <div className="flex gap-3 justify-end mt-1">
                <Button type="button" variant="ghost" onClick={() => setEndTarget(null)} disabled={ending}>
                  Cancel
                </Button>
                <Button type="submit" variant="danger" disabled={ending}>
                  {ending ? 'Ending…' : 'End Tenancy'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rent Review Modal */}
      {reviewTarget && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-card-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-primary flex items-center gap-1.5">Rent Review <InfoTip text="When completed, the new rent applies from the review date to unpaid rent months. Months on a statement don't change." /></h3>
              <button onClick={() => setReviewTarget(null)} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-status-muted mb-4 leading-snug">
              {reviewTarget.tenant} at {reviewTarget.property}. Current rent: £{reviewTarget.rent.toFixed(2)} pcm.
            </p>

            <form onSubmit={handleReviewSubmit} className="flex flex-col gap-4">
              <DatePicker
                label="Review Date"
                id="review-date"
                required
                value={reviewForm.date}
                onChange={(v) => setReviewForm((f) => ({ ...f, date: v }))}
              />
              <Input
                label="Proposed Rent (£ pcm, optional)"
                id="review-proposed"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 2100.00"
                value={reviewForm.proposed}
                onChange={(e) => setReviewForm((f) => ({ ...f, proposed: e.target.value }))}
              />
              <Dropdown
                id="review-status"
                label="Review Status"
                options={[
                  { value: 'scheduled', label: 'Scheduled' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'completed', label: 'Completed' },
                ]}
                value={reviewForm.status}
                onChange={(val) => setReviewForm((f) => ({ ...f, status: val }))}
              />

              <div className="flex gap-3 justify-between mt-1">
                {reviewTarget.rawReviewStatus && reviewTarget.rawReviewStatus !== 'none' ? (
                  <Button type="button" variant="ghost" className="text-status-danger" onClick={handleReviewClear} disabled={savingReview}>
                    Remove Review
                  </Button>
                ) : <span />}
                <div className="flex gap-3">
                  <Button type="button" variant="ghost" onClick={() => setReviewTarget(null)} disabled={savingReview}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={savingReview}>
                    {savingReview ? 'Saving…' : 'Save Review'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
