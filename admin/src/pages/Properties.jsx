import { EstatesApartments } from '../components/UI/EstatesViews';

// Blocks and apartments come from ROCA Estates (read-only). Roca Living adds
// lettings on top: open a managed apartment for its tenant, rent and statements.
export const Properties = () => (
  <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
    <EstatesApartments />
  </div>
);
