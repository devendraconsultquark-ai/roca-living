import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Home, Calendar, UserCheck, ShieldAlert,
  Wallet, FileSpreadsheet, Receipt, Wrench, UserCog, PiggyBank, Droplet,
  FolderOpen, BarChart3, Settings, Menu, X, Bell, User, ChevronLeft, ChevronRight,
  ClipboardCheck
} from 'lucide-react';
import { Logo } from '../UI/Logo';
import { useAuth } from '../../context/AuthContext';

// Header subtitles per section (mirrors the landlord portal's header pattern)
const SUBTITLES = {
  dashboard: 'Portfolio performance overview.',
  landlords: 'Manage landlord accounts, KYC and payment details.',
  properties: 'Manage standard parameters, safety compliance and occupancy.',
  tenancies: 'Review active leases, rental terms and upcoming expiries.',
  tenants: 'Review tenant records, balances and right-to-rent status.',
  agents: 'Manage letting agents, redress schemes and CMP providers.',
  accounting: 'Manage, reconcile and audit statements and cashflows.',
  statements: 'Generate and dispatch landlord statements.',
  invoices: 'Generate and track landlord invoices.',
  maintenance: 'Triage, quote and track maintenance tickets.',
  contractors: 'Manage contractor records and assignments.',
  deposits: 'Track deposit scheme registrations and deadlines.',
  inspections: 'Log and schedule property inspections.',
  utilities: 'Manage utility meters and access records.',
  documents: 'Manage compliance certificates, agreements and documents.',
  reports: 'Portfolio revenue, occupancy, arrears and compliance.',
  settings: 'Configure portal preferences.',
  profile: 'Manage your account details and preferences.',
  onboarding: 'Onboard a new landlord, property and tenancy.',
};

export const AdminLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Navigation configuration - All sections matching the Design Guide
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Landlords', path: '/landlords', icon: Users },
    { name: 'Properties', path: '/properties', icon: Home },
    { name: 'Tenancies', path: '/tenancies', icon: Calendar },
    { name: 'Tenants', path: '/tenants', icon: UserCheck },
    { name: 'Agents', path: '/agents', icon: ShieldAlert },
    { name: 'Accounting', path: '/accounting', icon: Wallet },
    { name: 'Statements', path: '/statements', icon: FileSpreadsheet },
    { name: 'Invoices', path: '/invoices', icon: Receipt },
    { name: 'Maintenance', path: '/maintenance', icon: Wrench },
    { name: 'Contractors', path: '/contractors', icon: UserCog },
    { name: 'Deposits', path: '/deposits', icon: PiggyBank },
    { name: 'Inspections', path: '/inspections', icon: ClipboardCheck },
    { name: 'Utilities', path: '/utilities', icon: Droplet },
    { name: 'Documents', path: '/documents', icon: FolderOpen },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: Settings },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  // Header title/subtitle derived from the current route (client-portal pattern)
  const sectionKey = location.pathname.split('/')[1] || 'dashboard';
  const activeItem = navItems.find((item) => location.pathname.startsWith(item.path));
  const headerTitle = activeItem?.name || (sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1).replace(/-/g, ' '));
  const headerSubtitle = SUBTITLES[sectionKey] || 'Staff portal overview.';

  // Render a single navigation link
  const renderNavLink = (item, isMobile = false) => {
    const Icon = item.icon;
    const isCollapsedState = !isMobile && collapsed;
    return (
      <NavLink
        key={item.name}
        to={item.path}
        onClick={() => isMobile && setMobileMenuOpen(false)}
        className={({ isActive }) => `
          relative flex items-center gap-3 px-4 py-2.5 rounded-r-lg rounded-l-none text-sm-portal transition-all duration-100 group
          ${isActive
            ? 'bg-sidebar-hover text-sidebar-text'
            : 'text-sidebar-text-muted hover:text-sidebar-text hover:bg-sidebar-hover'
          }
        `}
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span className="absolute left-0 top-[0%] bottom-[0%] w-[3.5px] bg-status-info rounded-r-full" />
            )}
            <Icon size={18} className="shrink-0" />
            <span className={isMobile ? 'block' : (isCollapsedState ? 'hidden' : 'hidden lg:block')}>{item.name}</span>
          </>
        )}
      </NavLink>
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
          {navItems.map(item => renderNavLink(item, false))}
        </nav>

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
          className="fixed inset-0 bg-sidebar-bg/40 backdrop-blur-xs z-50 md:hidden"
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
              {navItems.map(item => renderNavLink(item, true))}
            </nav>
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
                <h1 className="text-base-portal font-medium text-brand-primary leading-tight tracking-tight">
                  {headerTitle}
                </h1>
                <span className="text-xs-portal text-status-muted font-semibold leading-none mt-1">
                  {headerSubtitle}
                </span>
              </div>
            </div>

            {/* Right Section: Quick Actions */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Notifications */}
              <button className="w-11 h-11 rounded-full border border-card-border bg-white text-brand-primary flex items-center justify-center relative hover:border-gray-300 hover:shadow-xs cursor-pointer transition-all duration-150">
                <Bell size={20} className="text-brand-primary" />
                <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-status-danger"></span>
              </button>

              {/* User Profile outline */}
              <button
                onClick={() => navigate('/profile')}
                className="w-11 h-11 rounded-full border border-card-border bg-white flex items-center justify-center relative hover:border-gray-300 hover:shadow-xs cursor-pointer transition-all duration-150 shrink-0"
              >
                <div className="w-9 h-9 rounded-full bg-surface-light flex items-center justify-center text-status-muted">
                  <User size={18} />
                </div>
              </button>
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
