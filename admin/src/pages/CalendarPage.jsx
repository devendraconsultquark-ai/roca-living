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
  tenancy: { label: 'Tenancy Ends', color: '#7C3AED' },
  rent_review: { label: 'Rent Reviews', color: '#F16900' },
  deposit: { label: 'Deposits', color: '#E8A020' },
};

const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const CalendarPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [month, setMonth] = useState(monthKeyOf(new Date()));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState({}); // type -> true when filtered out

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get('/reports/calendar', { params: { month } });
        setEvents(res.data.data || []);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load calendar', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [month, addToast]);

  const [year, monthNum] = month.split('-').map(Number);
  const monthLabel = new Date(year, monthNum - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const leadingBlanks = (new Date(year, monthNum - 1, 1).getDay() + 6) % 7; // Monday-first
  const todayStr = new Date().toISOString().split('T')[0];

  const shiftMonth = (delta) => {
    setMonth(monthKeyOf(new Date(year, monthNum - 1 + delta, 1)));
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

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setMonth(monthKeyOf(new Date()))}>Today</Button>
          <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg border border-card-border bg-white hover:bg-surface-light cursor-pointer transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => shiftMonth(1)} className="p-2 rounded-lg border border-card-border bg-white hover:bg-surface-light cursor-pointer transition-colors">
            <ChevronRight size={16} />
          </button>
          <h2 className="text-base-portal font-bold ml-2">{monthLabel}</h2>
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
        {/* Month grid */}
        <div className="card-bg border border-card-border rounded-card shadow-premium p-4 xl:col-span-3">
          {loading ? (
            <Skeleton radius="card" className="h-[480px] w-full" />
          ) : (
            <>
              <div className="grid grid-cols-7 border-b border-card-border">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="px-2 py-2 text-2xs font-bold text-gray-400 uppercase tracking-wider">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((day, idx) => {
                  if (day === null) return <div key={`blank-${idx}`} className="min-h-24 border-b border-r border-card-border/40 bg-surface-light/40" />;
                  const dateStr = `${month}-${String(day).padStart(2, '0')}`;
                  const dayEvents = byDay[dateStr] || [];
                  const isToday = dateStr === todayStr;
                  return (
                    <div key={dateStr} className="min-h-24 border-b border-r border-card-border/40 p-1.5 flex flex-col gap-1 overflow-hidden">
                      <span className={`text-2xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-brand-accent text-white' : 'text-gray-400'
                      }`}>
                        {day}
                      </span>
                      {dayEvents.slice(0, 3).map((e, i) => (
                        <button
                          key={i}
                          onClick={() => navigate(e.link)}
                          title={`${e.title} — ${e.place}`}
                          className="text-left text-2xs font-semibold leading-tight rounded px-1.5 py-1 truncate cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: `${EVENT_TYPES[e.type].color}1A`, color: EVENT_TYPES[e.type].color }}
                        >
                          {e.title}
                        </button>
                      ))}
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
            {monthLabel} Agenda
          </h3>
          {loading ? (
            <Skeleton radius="card" className="h-64 w-full" />
          ) : visibleEvents.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-8 text-center">No key dates this month.</p>
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
