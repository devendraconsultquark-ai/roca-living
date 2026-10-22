import { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { Info, ChevronRight } from 'lucide-react';
import { Card, DetailContainer, DetailSkeleton, DetailHeader } from '../components/UI/DetailComponents';
import { StatusPill } from '../components/UI/StatusPill';
import { LandlordSections, ReadOnlyNote, EstateStatus } from '../components/UI/EstatesViews';
import { EstatesLandlordForm } from '../components/UI/EstatesLandlordForm';
import { useEstatesEditable } from '../utilities/useEstatesEditable';
import { EstatesDeleteModal } from '../components/UI/EstatesDeleteModal';
import api from '../utilities/api';

// A ROCA Estates landlord with no Roca Living account: their details and
// apartments. They get a Roca Living landlord page once one of their
// apartments is managed (that opens /landlords/:id instead).
export const EstatesLandlordPage = () => {
  const { rocaemId } = useParams();
  const navigate = useNavigate();
  // Kept with the id it was loaded for, so moving to another record shows
  // the skeleton, never the previous record.
  const [loaded, setLoaded] = useState({ id: null, record: null, error: null });
  const current = loaded.id === rocaemId;
  const ll = current ? loaded.record : null;
  const error = current ? loaded.error : null;
  const editable = useEstatesEditable();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/estates/landlords/${rocaemId}`, { skipInterceptorError: true });
        setLoaded({ id: rocaemId, record: res.data.data, error: null });
      } catch (err) {
        setLoaded({ id: rocaemId, record: null, error: err.response?.data?.message || 'Failed to load the landlord from ROCA Estates' });
      }
    };
    load();
  }, [rocaemId, reloadKey]);

  if (ll?.roca_living_landlord_id) return <Navigate to={`/landlords/${ll.roca_living_landlord_id}`} replace />;
  if (error) {
    return (
      <DetailContainer>
        <DetailHeader backPath="/landlords" backLabel="Back to Landlords" title="Landlord" />
        <div className="border border-status-danger/15 bg-status-danger-bg rounded-card p-6 text-center text-status-danger font-semibold">{error}</div>
      </DetailContainer>
    );
  }
  if (!ll) return <DetailSkeleton />;

  const openUnit = (u) => navigate(u.roca_living?.property_id ? `/properties/${u.roca_living.property_id}` : `/properties/estates/${u.id}`);

  return (
    <DetailContainer>
      <DetailHeader
        backPath="/landlords"
        backLabel="Back to Landlords"
        title={ll.name}
        badge={<StatusPill status="draft" customLabel="Not managed by Roca Living" size="sm" />}
        subtitle={[ll.payment_ref, 'ROCA Estates landlord'].filter(Boolean).join(' • ')}
        editLabel="Edit Details"
        onEdit={editable ? () => setEditing(true) : undefined}
        deleteLabel="Delete"
        onDelete={editable ? () => setDeleting(true) : undefined}
      />

      <div className="flex items-start gap-3 border border-status-info/20 bg-status-info-bg rounded-card p-4 mb-6 text-sm text-brand-primary">
        <Info size={18} className="text-status-info shrink-0 mt-0.5" />
        <p>
          This landlord has no Roca Living account: none of their apartments is managed by Roca Living.
          Open one of their apartments and choose <span className="font-bold">Manage with ROCA Living</span> to
          start lettings; their full landlord page (statements, payments, compliance) then opens here.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title="ROCA Estates Details">
            <div className="flex flex-col gap-5">
              <ReadOnlyNote editable={editable} />
              <LandlordSections ll={ll} />
            </div>
          </Card>
        </div>
        <div className="lg:col-span-1">
          <Card title={`Apartments (${ll.units.length})`}>
            {ll.units.length === 0 ? (
              <p className="text-sm text-status-muted">No apartments linked to this landlord in ROCA Estates.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {ll.units.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => openUnit(u)}
                    className="flex items-center justify-between gap-3 border border-card-border rounded-card px-4 py-3 text-sm text-left hover:border-brand-accent cursor-pointer transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block font-bold text-brand-primary">{u.unit_ref}</span>
                      <span className="block text-xs text-status-muted truncate">{u.name}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <EstateStatus status={u.status} />
                      <ChevronRight size={15} className="text-gray-400" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
      {editing && (
        <EstatesLandlordForm
          landlord={ll}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); setReloadKey((k) => k + 1); }}
        />
      )}
      {deleting && (
        <EstatesDeleteModal
          kind="landlord"
          rocaemId={ll.id}
          confirmWord={ll.name}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate('/landlords', { replace: true })}
        />
      )}
    </DetailContainer>
  );
};
