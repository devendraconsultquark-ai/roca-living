import { isNewsNew } from '../../utilities/news';

// Legislation & News items (managed under Settings): shared by the Dashboard
// card and the Legislation & News page.

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export const NewsList = ({ news }) => (
  <div className="flex flex-col">
    {news.map((item) => (
      <div key={item.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-card-border/60 last:border-0">
        <span className="flex items-start gap-2.5 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-accent mt-1.5 shrink-0" />
          <span className="min-w-0 text-xs font-semibold text-brand-primary leading-snug">
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer" className="hover:text-brand-accent transition-colors">
                {item.title}
              </a>
            ) : (
              item.title
            )}
            {isNewsNew(item) && (
              <span className="ml-2 px-1.5 py-0.5 rounded-sm bg-brand-accent/10 text-brand-accent text-2xs font-bold align-middle">
                New
              </span>
            )}
          </span>
        </span>
        <span className="text-2xs font-semibold text-gray-400 shrink-0">{fmtDate(item.published_on)}</span>
      </div>
    ))}
  </div>
);
