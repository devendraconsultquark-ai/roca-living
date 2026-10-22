import { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import { Card, DetailContainer, DetailSkeleton, DetailHeader } from '../components/UI/DetailComponents';
import { ApartmentSections, ReadOnlyNote, EstateStatus, ManageApartmentButton } from '../components/UI/EstatesViews';
import { EstatesApartmentForm } from '../components/UI/EstatesApartmentForm';
import { useEstatesEditable } from '../utilities/useEstatesEditable';
import { EstatesDeleteModal } from '../components/UI/EstatesDeleteModal';
import api from '../utilities/api';

// A ROCA Estates apartment Roca Living doesn't manage: its details and a
// "Manage with ROCA Living" button. Once managed, it has a lettings record and
// opens /properties/:id (tenancy, rent, statements, compliance) instead.
export const EstatesApartmentPage = () => {
  const { rocaemId } = useParams();
  const navigate = useNavigate();
  // Kept with the id it was loaded for, so moving to another record shows
  // the skeleton, never the previous record.
  const [loaded, setLoaded] = useState({ id: null, record: null, error: null });
  const current = loaded.id === rocaemId;
  const unit = current ? loaded.record : null;
  const error = current ? loaded.error : null;
  const editable = useEstatesEditable();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/estates/properties/${rocaemId}`, { skipInterceptorError: true });
        setLoaded({ id: rocaemId, record: res.data.data, error: null });
      } catch (err) {
        setLoaded({ id: rocaemId, record: null, error: err.response?.data?.message || 'Failed to load the apartment from ROCA Estates' });
      }
    };
    load();
  }, [rocaemId, reloadKey]);

  if (unit?.roca_living?.property_id) return <Navigate to={`/properties/${unit.roca_living.property_id}`} replace />;
  if (error) {
    return (
      <DetailContainer>
        <DetailHeader backPath="/properties" backLabel="Back to Properties" title="Apartment" />
        <div className="border border-status-danger/15 bg-status-danger-bg rounded-card p-6 text-center text-status-danger font-semibold">{error}</div>
      </DetailContainer>
    );
  }
  if (!unit) return <DetailSkeleton />;

  return (
    <DetailContainer>
      <DetailHeader
        backPath="/properties"
        backLabel="Back to Properties"
        title={[unit.unit_ref, unit.name].filter(Boolean).join(' · ')}
        badge={<EstateStatus status={unit.status} />}
        subtitle={[unit.property_reference, unit.building_name, 'ROCA Estates apartment'].filter(Boolean).join(' • ')}
        editLabel="Edit Details"
        onEdit={editable ? () => setEditing(true) : undefined}
        deleteLabel="Delete"
        onDelete={editable ? () => setDeleting(true) : undefined}
      />

      <div className="flex flex-col md:flex-row md:items-center gap-4 border border-status-info/20 bg-status-info-bg rounded-card p-4 mb-6">
        <div className="flex items-start gap-3 text-sm text-brand-primary flex-1">
          <Info size={18} className="text-status-info shrink-0 mt-0.5" />
          <p>
            <span className="font-bold">Not managed by Roca Living.</span> Tenancy, rent, statements and compliance
            appear here once Roca Living manages this apartment.
          </p>
        </div>
        <ManageApartmentButton unit={unit} onManaged={(propertyId) => navigate(`/properties/${propertyId}`, { replace: true })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title="Apartment (ROCA Estates)">
            <div className="flex flex-col gap-5">
              <ReadOnlyNote editable={editable} />
              <ApartmentSections unit={unit} />
            </div>
          </Card>
        </div>
        <div className="lg:col-span-1">
          <Card title="Owner">
            {unit.landlord_id ? (
              <button
                type="button"
                onClick={() => navigate(`/landlords/estates/${unit.landlord_id}`)}
                className="w-full text-left border border-card-border rounded-card px-4 py-3 hover:border-brand-accent cursor-pointer transition-colors"
              >
                <span className="block font-bold text-brand-primary">{unit.landlord_name}</span>
                <span className="block text-xs text-status-muted">{unit.landlord_email || 'No email in ROCA Estates'}</span>
              </button>
            ) : (
              <p className="text-sm text-status-muted">ROCA Estates has no owner for this apartment. You'll be asked to choose one when you manage it.</p>
            )}
          </Card>
        </div>
      </div>
      {editing && (
        <EstatesApartmentForm
          rocaemId={unit.id}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); setReloadKey((k) => k + 1); }}
        />
      )}
      {deleting && (
        <EstatesDeleteModal
          kind="apartment"
          rocaemId={unit.id}
          confirmWord={unit.unit_ref || unit.name}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate('/properties', { replace: true })}
        />
      )}
    </DetailContainer>
  );
};
