import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Home, UserCheck,
  Wallet, Wrench, PiggyBank, Droplet,
  FolderOpen, BarChart3, Settings, Menu, X, Bell, User, ChevronLeft, ChevronRight,
  ChevronDown, LogOut, ClipboardCheck, Landmark, ShieldCheck, CalendarDays
} from 'lucide-react';
import { Logo } from '../UI/Logo';
import { GlobalSearch } from './GlobalSearch';
import { useAuth } from '../../context/AuthContext';
import api from '../../utilities/api';

// The single page header: each page's title/subtitle lives HERE (pages no
// longer render their own title block — this is the only header).
const HEADERS = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your managed portfolio and business performance.' },
  landlords: { title: 'Landlords Directory', subtitle: 'Review contact records, active portfolios, and compliance details for registered landlords.' },
  properties: { title: 'Properties Portfolio', subtitle: 'Manage standard parameters, safety compliance certificates, and occupancies.' },
  tenancies: { title: 'Tenancy Agreements', subtitle: 'Review active leases, rental terms, and upcoming expiries. New tenancies are created via the onboarding wizard.' },
  tenants: { title: 'Tenants CRM', subtitle: 'Manage tenant communications, contact directory, and ledger account balances.' },
  agents: { title: 'Letting Agents', subtitle: 'Review internal staff portfolios, active roles, branches, and client managers.' },
  accounting: { title: 'Accounting Hub', subtitle: 'Manage, reconcile, and audit the financial statements and cashflows.' },
  statements: { title: 'Landlord Statements Library', subtitle: 'Audit, export, and review statements issued to landlords.' },
  invoices: { title: 'Landlord Invoices', subtitle: 'Audit, export, and manage service charge invoices issued to landlords.' },
  maintenance: { title: 'Maintenance Board', subtitle: 'Drag and drop tickets to manage their progress lifecycle.' },
  contractors: { title: 'Contractors Directory', subtitle: 'Review contact records, active insurance statuses, and ratings of maintenance contractors.' },
  deposits: { title: 'Deposit Protection', subtitle: 'Track deposit scheme registrations and outstanding protection deadlines.' },
  inspections: { title: 'Property Inspections', subtitle: 'Log routine inspections and track when the next visit is due. Inspections appear on the landlord portal.' },
  utilities: { title: 'Utility Handover Dashboard', subtitle: 'Track energy, council tax, and water service transfers during tenant check-in and check-out periods.' },
  documents: { title: 'Documents Library', subtitle: 'Manage compliance certificates, signed tenancy agreements, and landlord utility documents.' },
  reports: { title: 'Reports Hub', subtitle: 'Portfolio revenue, occupancy, arrears, and compliance expiries — live from the ledger.' },
  settings: { title: 'System Settings', subtitle: 'Configure global fee values, deposit parameters, and client templates.' },
  profile: { title: 'Admin Profile', subtitle: 'Manage your administrative user information and profile settings.' },
  onboarding: { title: 'New-Let Onboarding Wizard', subtitle: 'Complete the 6 onboarding stages to register the landlord, property, and move-in details.' },
  'rent-reviews': { title: 'Rent Reviews', subtitle: 'Track, manage and process rent reviews across all tenancies.' },
  arrears: { title: 'Arrears', subtitle: 'Monitor and manage rent arrears across all tenancies.' },
  compliance: { title: 'Compliance', subtitle: 'Track safety certificates and compliance requirements across all properties.' },
  calendar: { title: 'Operations Calendar', subtitle: 'Key dates, deadlines and renewals across your portfolio — live from the system.' },
};

// Navigation configuration — grouped sections with sub-tabs per the approved
// design spec. Every entry maps to a page that actually exists; spec groups
// whose pages don't exist yet (Communications, Tasks & Alerts, …) are omitted
// rather than rendered as dead links.
const NAV_ITEMS = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  {
    name: 'Landlords', icon: Users,
    children: [
      { name: 'All Landlords', path: '/landlords' },
      { name: 'Onboarding', path: '/onboarding' },
      { name: 'Letting Agents', path: '/agents' },
    ],
  },
  { name: 'Properties', path: '/properties', icon: Home },
  {
    name: 'Tenants & Tenancies', icon: UserCheck,
    children: [
      { name: 'All Tenants', path: '/tenants' },
      { name: 'Tenancies', path: '/tenancies' },
      { name: 'Rent Reviews', path: '/rent-reviews' },
      { name: 'Arrears', path: '/arrears' },
    ],
  },
  { heading: 'Accounting' },
  {
    name: 'Accounting', icon: Wallet,
    children: [
      { name: 'Overview', path: '/accounting' },
      { name: 'Invoices', path: '/invoices' },
      { name: 'Statements', path: '/statements' },
    ],
  },
  { name: 'Deposits', path: '/deposits', icon: PiggyBank },
  { heading: 'Compliance' },
  { name: 'Compliance', path: '/compliance', icon: ShieldCheck },
  { heading: 'Operations' },
  {
    name: 'Maintenance', icon: Wrench,
    children: [
      { name: 'Maintenance Board', path: '/maintenance' },
      { name: 'Contractors', path: '/contractors' },
    ],
  },
  { name: 'Calendar', path: '/calendar', icon: CalendarDays },
  { name: 'Inspections', path: '/inspections', icon: ClipboardCheck },
  { name: 'Utilities & Access', path: '/utilities', icon: Droplet },
  { name: 'Documents', path: '/documents', icon: FolderOpen },
  { heading: 'Administration' },
  { name: 'Reports', path: '/reports', icon: BarChart3 },
  {
    name: 'System Administration', icon: Settings,
    children: [
      { name: 'Settings', path: '/settings' },
      { name: 'My Profile', path: '/profile' },
    ],
  },
];

export const AdminLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // User chip dropdown (header right)
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const userInitials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').substring(0, 2)
    : 'A';

  // Notifications dropdown (header bell)
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState(null); // null = not fetched yet
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef(null);

  // Close the notifications panel on outside click (same pattern as UI/Dropdown)
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  const handleBellClick = () => {
    setNotifOpen((open) => !open);
    // Fetch once, on first open this session
    if (notifItems === null && !notifLoading) {
      setNotifLoading(true);
      api.get('/reports/recent-activity')
        .then((res) => setNotifItems(res.data.data || []))
        .catch(() => setNotifItems([]))
        .finally(() => setNotifLoading(false));
    }
  };

  // Collapsible nav groups. Open state is DERIVED: a group is open when the
  // user explicitly toggled it (override) or, absent an override, when it
  // contains the active route — so the current section's group auto-opens
  // without any state syncing in effects.
  const [groupOverrides, setGroupOverrides] = useState({});

  const isGroupOpen = (item) =>
    groupOverrides[item.name] ?? item.children.some((c) => location.pathname.startsWith(c.path));

  const handleGroupClick = (item) => {
    // In icon-only mode a group has nowhere to show its children — expand first.
    if (collapsed) {
      setCollapsed(false);
      setGroupOverrides((g) => ({ ...g, [item.name]: true }));
      return;
    }
    setGroupOverrides((g) => ({ ...g, [item.name]: !isGroupOpen(item) }));
  };

  // Management Fee Account tile (sidebar footer) — live YTD fees from the ledger
  const [feeAccount, setFeeAccount] = useState(null);
  const [feeTileOpen, setFeeTileOpen] = useState(true);

  useEffect(() => {
    api.get('/reports/mgmt-fee-account')
      .then((res) => setFeeAccount(res.data.data))
      .catch(() => setFeeAccount(null));
  }, []);

  // Header title/subtitle derived from the current route (client-portal pattern)
  const sectionKey = location.pathname.split('/')[1] || 'dashboard';
  const flatNav = NAV_ITEMS
    .filter((item) => !item.heading)
    .flatMap((item) => (item.children ? item.children : [item]));
  const activeItem = flatNav.find((item) => location.pathname.startsWith(item.path));

  // Breadcrumb trail for nested routes (e.g. Landlords / #12)
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const crumbs = pathSegments.length > 1
    ? pathSegments.map((seg, i) => {
        const path = '/' + pathSegments.slice(0, i + 1).join('/');
        const navMatch = flatNav.find((item) => item.path === path);
        const label = navMatch?.name
          || (/^\d+$/.test(seg) ? `#${seg}` : seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '));
        return { path, label, isLast: i === pathSegments.length - 1 };
      })
    : null;
  const headerEntry = HEADERS[sectionKey];
  const headerTitle = headerEntry?.title || activeItem?.name || (sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1).replace(/-/g, ' '));
  const headerSubtitle = headerEntry?.subtitle || 'Staff portal overview.';

  // Render one nav entry: a section heading, a plain link, or a collapsible group
  const renderNavItem = (item, isMobile = false) => {
    if (item.heading) {
      return (
        <p
          key={`heading-${item.heading}`}
          className={`px-6 pt-4 pb-1 text-2xs font-bold text-sidebar-text-muted/70 tracking-widest select-none ${
            isMobile ? 'block' : (collapsed ? 'hidden' : 'hidden lg:block')
          }`}
          style={{ textTransform: 'uppercase' }}
        >
          {item.heading}
        </p>
      );
    }

    const Icon = item.icon;
    const isCollapsedState = !isMobile && collapsed;
    const labelClass = isMobile ? 'block' : (isCollapsedState ? 'hidden' : 'hidden lg:block');
    // Icon-only rows (collapsed toggle, or md screens where labels are hidden)
    // center their icon; label mode left-aligns with the usual padding.
    const rowLayout = isMobile
      ? 'justify-start px-3.5'
      : isCollapsedState
        ? 'justify-center px-2'
        : 'justify-center px-2 lg:justify-start lg:px-3.5';

    if (!item.children) {
      return (
        <NavLink
          key={item.name}
          to={item.path}
          onClick={() => isMobile && setMobileMenuOpen(false)}
          className={({ isActive }) => `
            relative flex items-center gap-3 mx-3 py-2.5 rounded-lg text-sm-portal transition-all duration-100 group border ${rowLayout}
            ${isActive
              ? 'bg-brand-accent/20 text-white border-brand-accent/40'
              : 'text-sidebar-text-muted hover:text-sidebar-text hover:bg-sidebar-hover border-transparent'
            }
          `}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand-accent rounded-r-full" />
              )}
              <Icon size={18} className="shrink-0" />
              <span className={labelClass}>{item.name}</span>
            </>
          )}
        </NavLink>
      );
    }

    const isOpen = isGroupOpen(item);
    const childActive = item.children.some((c) => location.pathname.startsWith(c.path));
    const showChildren = isOpen && (isMobile || !collapsed);

    return (
      <div key={item.name} className="flex flex-col gap-0.5">
        <button
          onClick={() => (isMobile
            ? setGroupOverrides((g) => ({ ...g, [item.name]: !isOpen }))
            : handleGroupClick(item))}
          className={`
            relative flex items-center gap-3 mx-3 py-2.5 rounded-lg text-sm-portal transition-all duration-100 border cursor-pointer text-left ${rowLayout}
            ${childActive && !showChildren
              ? 'bg-brand-accent/20 text-white border-brand-accent/40'
              : 'text-sidebar-text-muted hover:text-sidebar-text hover:bg-sidebar-hover border-transparent'
            }
          `}
        >
          {childActive && !showChildren && (
            <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand-accent rounded-r-full" />
          )}
          <Icon size={18} className="shrink-0" />
          <span className={`flex-1 ${labelClass}`}>{item.name}</span>
          <ChevronDown
            size={14}
            className={`shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''} ${labelClass}`}
          />
        </button>

        {showChildren && (
          <div className={`flex-col gap-0.5 ${isMobile ? 'flex' : 'hidden lg:flex'}`}>
            {item.children.map((child) => (
              <NavLink
                key={child.name}
                to={child.path}
                onClick={() => isMobile && setMobileMenuOpen(false)}
                className={({ isActive }) => `
                  flex items-center mx-3 pl-11 pr-3.5 py-2 rounded-lg text-xs-portal transition-all duration-100 border
                  ${isActive
                    ? 'bg-brand-accent/20 text-white border-brand-accent/40'
                    : 'text-sidebar-text-muted hover:text-sidebar-text hover:bg-sidebar-hover border-transparent'
                  }
                `}
              >
                {child.name}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-app-bg text-text-primary">

      {/* 1. SIDEBAR (DESKTOP/TABLET) */}
      <aside className={`hidden md:flex flex-col bg-sidebar-bg text-sidebar-text transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-[72px] lg:w-[240px]'} shrink-0 border-r border-sidebar-accent h-full`}>
        {/* Brand Header */}
        <div className={`h-16 flex items-center ${collapsed ? 'justify-center px-4' : 'justify-start px-6'} shrink-0`}>
          <Logo collapsed={collapsed} />
        </div>

        {/* Collapse Button Row (Between Logo and Nav list) */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-end px-6'} py-2 shrink-0`}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 hover:bg-sidebar-hover rounded text-sidebar-text-muted hover:text-sidebar-text transition-colors cursor-pointer"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-grow flex flex-col gap-0.5 py-3 pr-3 overflow-y-auto no-scrollbar">
          {NAV_ITEMS.map(item => renderNavItem(item, false))}
        </nav>

        {/* Management Fee Account tile (live YTD ledger figure) */}
        {!collapsed && feeAccount && (
          <div className="hidden lg:block px-3 pb-3 shrink-0">
            <div className="bg-sidebar-help-bg border border-sidebar-accent rounded-xl p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-2xs font-bold text-sidebar-text-muted min-w-0">
                  <Landmark size={13} className="shrink-0" />
                  <span className="truncate">Management Fee Account</span>
                </span>
                <button
                  onClick={() => setFeeTileOpen((o) => !o)}
                  className="p-1 rounded hover:bg-sidebar-hover text-sidebar-text-muted hover:text-sidebar-text transition-colors cursor-pointer shrink-0"
                  title={feeTileOpen ? 'Collapse' : 'Expand'}
                >
                  <ChevronDown size={14} className={`transition-transform duration-150 ${feeTileOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {feeTileOpen && (
                <>
                  <p className="text-lg font-bold text-white mt-2 leading-none">
                    £{Number(feeAccount.total).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-2xs text-sidebar-text-muted font-semibold mt-1.5">
                    Fees {feeAccount.year} · as at {new Date(feeAccount.as_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  <NavLink
                    to="/accounting"
                    className="mt-3 block text-center bg-white/10 hover:bg-white/20 text-white text-2xs font-bold rounded-lg py-2 transition-colors"
                  >
                    View Account
                  </NavLink>
                </>
              )}
            </div>
          </div>
        )}

        {/* Sidebar Footer Profile */}
        <div className={`p-4 border-t border-sidebar-accent ${collapsed ? 'flex justify-center' : 'flex items-center justify-between'} shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center text-sm shrink-0 uppercase">
              {user?.name
                ? user.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                : 'A'}
            </div>
            {!collapsed && (
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs text-sidebar-text leading-tight">
                  {user?.name || 'Admin User'}
                </span>
                <span className="text-2xs text-sidebar-text-muted leading-tight">
                  Staff Portal
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 2. MOBILE DRAWER OVERLAY */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-overlay backdrop-blur-sm z-50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-[260px] h-full bg-sidebar-bg text-sidebar-text flex flex-col p-4 shadow-xl border-r border-sidebar-accent"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-sidebar-accent">
              <Logo />
              <button onClick={() => setMobileMenuOpen(false)} className="text-sidebar-text-muted hover:text-sidebar-text">
                <X size={24} />
              </button>
            </div>
            <nav className="flex-grow flex flex-col gap-1 overflow-y-auto pr-2 no-scrollbar">
              {NAV_ITEMS.map(item => renderNavItem(item, true))}
            </nav>

            {/* Management Fee Account tile (mobile drawer) */}
            {feeAccount && (
              <div className="pt-3 shrink-0">
                <div className="bg-sidebar-help-bg border border-sidebar-accent rounded-xl p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-2xs font-bold text-sidebar-text-muted min-w-0">
                      <Landmark size={13} className="shrink-0" />
                      <span className="truncate">Management Fee Account</span>
                    </span>
                    <button
                      onClick={() => setFeeTileOpen((o) => !o)}
                      className="p-1 rounded hover:bg-sidebar-hover text-sidebar-text-muted hover:text-sidebar-text transition-colors cursor-pointer shrink-0"
                      title={feeTileOpen ? 'Collapse' : 'Expand'}
                    >
                      <ChevronDown size={14} className={`transition-transform duration-150 ${feeTileOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {feeTileOpen && (
                    <>
                      <p className="text-lg font-bold text-white mt-2 leading-none">
                        £{Number(feeAccount.total).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-2xs text-sidebar-text-muted font-semibold mt-1.5">
                        Fees {feeAccount.year} · as at {new Date(feeAccount.as_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <NavLink
                        to="/accounting"
                        onClick={() => setMobileMenuOpen(false)}
                        className="mt-3 block text-center bg-white/10 hover:bg-white/20 text-white text-2xs font-bold rounded-lg py-2 transition-colors"
                      >
                        View Account
                      </NavLink>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">

        {/* Top Header Bar */}
        <header className="h-24 py-8 bg-white shadow-sm sticky top-0 z-40 shrink-0 font-sans w-full flex items-center px-8">
          <div className="max-w-[1440px] w-full mx-auto flex items-center justify-between">
            {/* Left Section: Hamburger & Title Info */}
            <div className="flex items-center gap-4 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-1.5 text-status-muted hover:text-brand-primary hover:bg-surface-hover rounded-lg shrink-0"
              >
                <Menu size={22} />
              </button>

              <div className="flex flex-col min-w-0">
                {crumbs && (
                  <nav className="flex items-center gap-1 text-2xs font-semibold text-status-muted mb-0.5 min-w-0">
                    {crumbs.map((c) => (
                      <span key={c.path} className="flex items-center gap-1 min-w-0">
                        {c.isLast ? (
                          <span className="text-brand-primary font-bold truncate">{c.label}</span>
                        ) : (
                          <>
                            <NavLink to={c.path} className="hover:text-brand-accent transition-colors truncate">
                              {c.label}
                            </NavLink>
                            <span className="text-gray-400">/</span>
                          </>
                        )}
                      </span>
                    ))}
                  </nav>
                )}
                <h1 className="text-base-portal font-medium text-brand-primary leading-tight tracking-tight">
                  {headerTitle}
                </h1>
                <span className="text-xs-portal text-status-muted font-semibold leading-none mt-1">
                  {headerSubtitle}
                </span>
              </div>
            </div>

            {/* Center Section: Global search (design-spec header) */}
            <div className="hidden md:block flex-1 max-w-md mx-8">
              <GlobalSearch />
            </div>

            {/* Right Section: Quick Actions */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={handleBellClick}
                  className="p-2 rounded-lg text-brand-primary relative hover:bg-surface-hover cursor-pointer transition-colors duration-150"
                  title="Recent activity"
                >
                  <Bell size={20} className="text-brand-primary" />
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 card-bg border border-card-border rounded-card shadow-premium max-h-96 overflow-y-auto z-50">
                    <div className="px-4 py-3 border-b border-card-border sticky top-0 card-bg">
                      <h4 className="text-xs-portal font-bold text-brand-primary uppercase tracking-wider select-none">Recent Activity</h4>
                    </div>
                    {notifLoading ? (
                      <p className="text-xs text-gray-400 font-semibold px-4 py-6 text-center">Loading activity...</p>
                    ) : !notifItems || notifItems.length === 0 ? (
                      <p className="text-xs text-gray-400 font-semibold px-4 py-6 text-center">No recent activity.</p>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {notifItems.map((act) => (
                          <div key={act.id} className="px-4 py-3 hover:bg-surface-light/50 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                                  act.type === 'success' ? 'bg-status-success' : act.type === 'danger' ? 'bg-status-danger' : 'bg-brand-accent'
                                }`} />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-brand-primary leading-tight">{act.title}</p>
                                  <p className="text-2xs text-gray-400 font-semibold mt-1">{act.desc}</p>
                                </div>
                              </div>
                              <span className="text-2xs font-bold text-gray-400 shrink-0">{act.time}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User identity chip (design-spec header) */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((open) => !open)}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors duration-150"
                >
                  <span className="w-9 h-9 rounded-full bg-brand-accent text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                    {userInitials}
                  </span>
                  <span className="hidden sm:flex flex-col text-left leading-tight">
                    <span className="text-xs font-bold text-brand-primary">{user?.name || 'Admin'}</span>
                    <span className="text-2xs text-status-muted font-semibold">Administrator</span>
                  </span>
                  <ChevronDown size={14} className={`text-status-muted transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-44 card-bg border border-card-border rounded-card shadow-premium z-50 py-1">
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/profile'); }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-brand-primary hover:bg-surface-light flex items-center gap-2.5 cursor-pointer"
                    >
                      <User size={15} className="text-status-muted" /> My Profile
                    </button>
                    <button
                      onClick={logout}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-status-danger hover:bg-status-danger-bg/60 flex items-center gap-2.5 cursor-pointer"
                    >
                      <LogOut size={15} /> Log Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Viewport content area */}
        <main className="flex-grow overflow-y-auto max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

    </div>
  );
};
