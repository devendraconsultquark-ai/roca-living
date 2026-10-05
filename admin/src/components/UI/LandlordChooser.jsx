import { Input } from './Input';
import { Dropdown } from './Dropdown';

// When ROCA Estates has no owner on an apartment: pick a Roca Living landlord
// for its statements, or add a new one. Helpers: utilities/landlordChoice.js.
export const LandlordChooser = ({ landlords, choice, onChoice, newLandlord, onNewLandlord, error }) => {
  const setField = (key, value) => onNewLandlord({ ...newLandlord, [key]: value });
  return (
    <div className="flex flex-col gap-3 bg-status-warning/10 border border-status-warning/15 rounded-card p-4">
      <p className="text-xs-portal font-semibold text-status-warning">
        ROCA Estates has no owner on this apartment. Choose the landlord for Roca Living's statements (you can link the owner in ROCA Estates later).
      </p>
      <Dropdown
        label="Landlord"
        id="landlordChoice"
        options={[
          ...landlords.map((l) => ({ value: String(l.id), label: `${l.name}${l.email ? ` (${l.email})` : ''}` })),
          { value: 'new', label: '+ New landlord' },
        ]}
        value={choice}
        onChange={onChoice}
        placeholder="Search and select a landlord..."
        searchable
        error={error}
      />
      {choice === 'new' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input id="newLandlordName" label="Name (as on statements)" value={newLandlord.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Mr Paul Belema & Marcia E W Huizing" />
          <Input id="newLandlordEmail" label="Email" type="email" value={newLandlord.email} onChange={(e) => setField('email', e.target.value)} />
          <Input id="newLandlordPhone" label="Phone (optional)" value={newLandlord.phone} onChange={(e) => setField('phone', e.target.value)} />
          <div>
            <label htmlFor="newLandlordAddress" className="block text-xs font-semibold text-status-muted mb-1">Postal address (one line per row)</label>
            <textarea
              id="newLandlordAddress"
              rows={3}
              value={newLandlord.address}
              onChange={(e) => setField('address', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-accent bg-white resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};
