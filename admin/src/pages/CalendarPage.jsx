import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '../components/UI/Skeleton';
import { Button } from '../components/UI/Button';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

// Event types the backend aggregates — all from dates the system already tracks.
const EVENT_TYPES = {
  compliance: { label: 'Compliance', color: '#3A7D44' },
  inspection: { label: 'Inspections', color: '#0A58CA' },
  rent: { label: 'Rent Due', color: '#4F46E5' },
  move_in: { label: 'Move-ins', color: '#0E9384' },
  tenancy: { label: 'Move-outs', color: '#7C3AED' },
  utility: { label: 'Utility Handovers', color: '#0891B2' },
  rent_review: { label: 'Rent Reviews', color: '#F16900' },
  deposit: { label: 'Deposits', color: '#E8A020' },
};

const pad = (n) => String(n).padStart(2, '0');
const monthKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const CalendarPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [view, setView] = useState('month'); // 'month' | 'week'
  const [month, setMonth] = useState(monthKeyOf(new Date()));
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState({}); // type -> true when filtered out

  const weekFrom = ymdOf(weekStart);
  const weekTo = ymdOf(addDays(weekStart, 6));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = view === 'week' ? { from: weekFrom, to: weekTo } : { month };
        const res = await api.get('/reports/calendar', { params });
        setEvents(res.data.data || []);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load calendar', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [view, month, weekFrom, weekTo, addToast]);

  const [year, monthNum] = month.split('-').map(Number);
  const monthLabel = new Date(year, monthNum - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const rangeLabel = view === 'week' ? weekLabel : monthLabel;
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const leadingBlanks = (new Date(year, monthNum - 1, 1).getDay() + 6) % 7; // Monday-first
  const todayStr = ymdOf(new Date());

  const shift = (delta) => {
    if (view === 'week') setWeekStart((w) => addDays(w, delta * 7));
    else setMonth(monthKeyOf(new Date(year, monthNum - 1 + delta, 1)));
  };
  const goToday = () => {
    setMonth(monthKeyOf(new Date()));
    setWeekStart(mondayOf(new Date()));
  };
  const chooseView = (v) => {
    // Keep the place: week view opens on the shown month (or this week if it is the current month)
    if (v === 'week' && view === 'month') {
      setWeekStart(month === monthKeyOf(new Date()) ? mondayOf(new Date()) : mondayOf(new Date(year, monthNum - 1, 1)));
    }
    if (v === 'month' && view === 'week') setMonth(monthKeyOf(weekStart));
    setView(v);
  };

  const visibleEvents = events.filter((e) => !hidden[e.type]);
  const byDay = visibleEvents.reduce((acc, e) => {
    (acc[e.date] = acc[e.date] || []).push(e);
    return acc;
  }, {});

  const cells = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const EventChip = ({ e }) => (
    <button
      onClick={() => navigate(e.link)}
      title={`${e.title} — ${e.place}`}
      className="text-left text-2xs font-semibold leading-tight rounded px-1.5 py-1 truncate cursor-pointer hover:opacity-80 transition-opacity"
      style={{ backgroundColor: `${EVENT_TYPES[e.type].color}1A`, color: EVENT_TYPES[e.type].color }}
    >
      {e.title}
    </button>
  );

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={goToday}>Today</Button>
          <button onClick={() => shift(-1)} aria-label={view === 'week' ? 'Previous week' : 'Previous month'} className="p-2 rounded-lg border border-card-border bg-white hover:bg-surface-light cursor-pointer transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => shift(1)} aria-label={view === 'week' ? 'Next week' : 'Next month'} className="p-2 rounded-lg border border-card-border bg-white hover:bg-surface-light cursor-pointer transition-colors">
            <ChevronRight size={16} />
          </button>
          <h2 className="text-base-portal font-bold ml-2">{rangeLabel}</h2>
          <div className="flex border border-card-border rounded-lg overflow-hidden ml-3">
            {['month', 'week'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => chooseView(v)}
                className={`px-3 py-1.5 text-xs font-bold cursor-pointer ${view === v ? 'bg-brand-accent text-white' : 'bg-white text-status-muted hover:bg-surface-hover'}`}
              >
                {v === 'month' ? 'Month' : 'Week'}
              </button>
            ))}
          </div>
        </div>

        {/* Type filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(EVENT_TYPES).map(([key, t]) => (
            <button
              key={key}
              onClick={() => setHidden((h) => ({ ...h, [key]: !h[key] }))}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs font-bold border transition-colors cursor-pointer ${
                hidden[key] ? 'border-card-border text-gray-400 bg-white opacity-60' : 'border-transparent text-brand-primary bg-surface-hover'
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Month / week grid */}
        <div className="card-bg border border-card-border rounded-card shadow-premium p-4 xl:col-span-3">
          {loading ? (
            <Skeleton radius="card" className="h-[480px] w-full" />
          ) : view === 'week' ? (
            <div className="grid grid-cols-7">
              {weekDays.map((d) => {
                const dateStr = ymdOf(d);
                const dayEvents = byDay[dateStr] || [];
                const isToday = dateStr === todayStr;
                return (
                  <div key={dateStr} className="min-h-[420px] border-r border-card-border/40 last:border-r-0 flex flex-col">
                    <div className="px-2 py-2 border-b border-card-border flex items-center gap-2">
                      <span className="text-2xs font-bold text-gray-400 capitalize">{WEEKDAYS[(d.getDay() + 6) % 7]}</span>
                      <span className={`text-2xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-accent text-white' : 'text-brand-primary'}`}>
                        {d.getDate()}
                      </span>
                    </div>
                    <div className="p-1.5 flex flex-col gap-1">
                      {dayEvents.length === 0
                        ? <span className="text-2xs text-gray-300 px-1.5">—</span>
                        : dayEvents.map((e, i) => <EventChip key={i} e={e} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 border-b border-card-border">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="px-2 py-2 text-2xs font-bold text-gray-400 capitalize">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((day, idx) => {
                  if (day === null) return <div key={`blank-${idx}`} className="min-h-24 border-b border-r border-card-border/40 bg-surface-light/40" />;
                  const dateStr = `${month}-${pad(day)}`;
                  const dayEvents = byDay[dateStr] || [];
                  const isToday = dateStr === todayStr;
                  return (
                    <div key={dateStr} className="min-h-24 border-b border-r border-card-border/40 p-1.5 flex flex-col gap-1 overflow-hidden">
                      <span className={`text-2xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-brand-accent text-white' : 'text-gray-400'
                      }`}>
                        {day}
                      </span>
                      {dayEvents.slice(0, 3).map((e, i) => <EventChip key={i} e={e} />)}
                      {dayEvents.length > 3 && (
                        <span className="text-2xs font-bold text-gray-400 px-1.5">+{dayEvents.length - 3} more</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Agenda */}
        <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-3">
          <h3 className="text-sm-portal font-bold text-brand-primary border-b border-card-border pb-3">
            {rangeLabel} Agenda
          </h3>
          {loading ? (
            <Skeleton radius="card" className="h-64 w-full" />
          ) : visibleEvents.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-8 text-center">No key dates this {view}.</p>
          ) : (
            <div className="flex flex-col overflow-y-auto max-h-[520px] pr-1">
              {visibleEvents.map((e, i) => (
                <button
                  key={i}
                  onClick={() => navigate(e.link)}
                  className="flex items-start gap-3 py-2.5 border-b border-card-border/60 last:border-0 text-left cursor-pointer hover:bg-surface-light/60 rounded-lg px-2 transition-colors"
                >
                  <span className="flex flex-col items-center shrink-0 w-9">
                    <span className="text-sm font-bold leading-none">{new Date(e.date).getDate()}</span>
                    <span className="text-2xs font-semibold text-gray-400">
                      {new Date(e.date).toLocaleDateString('en-GB', { month: 'short' })}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-brand-primary leading-tight">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: EVENT_TYPES[e.type].color }} />
                      <span className="truncate">{e.title}</span>
                    </span>
                    <span className="block text-2xs font-semibold text-gray-400 truncate mt-0.5">{e.place}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
