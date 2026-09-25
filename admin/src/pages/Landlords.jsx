import { EstatesLandlords } from '../components/UI/EstatesViews';

// Landlords are onboarded and managed in ROCA Estates; shown here read-only.
export const Landlords = () => (
  <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
    <EstatesLandlords />
  </div>
);
