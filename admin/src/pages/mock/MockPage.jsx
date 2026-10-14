import { DummyBanner } from './MockKit';
import { MOCK_PAGES } from './index';

// A design page that is not built yet: the "Dummy data" banner (with links to
// what to use today) above a copy of the design filled with sample data.
export const MockPage = ({ slug, related }) => {
  const Content = MOCK_PAGES[slug];
  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <DummyBanner related={related} />
      {Content && <Content />}
    </div>
  );
};
