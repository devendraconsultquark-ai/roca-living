import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Home, FileSpreadsheet, FolderOpen,
  Eye, UserCircle, Menu, Wrench, X, Bell, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Logo } from '../UI/Logo';

export const LandlordLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  // Navigation configuration - All 7 sections matching the Landlord Portal specs
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'My Properties', path: '/properties', icon: Home },
    { name: 'Statements', path: '/statements', icon: FileSpreadsheet },
    { name: 'Documents', path: '/documents', icon: FolderOpen },
    { name: 'Inspections', path: '/inspections', icon: Eye },
    { name: 'Maintenance', path: '/maintenance', icon: Wrench },
    { name: 'Profile', path: '/profile', icon: UserCircle },
  ];

  // Render a single navigation link
  const renderNavLink = (item, isMobile = false) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.name}
        to={item.path}
        onClick={() => isMobile && setMobileMenuOpen(false)}
        className={({ isActive }) => `
          flex items-center gap-3 px-4 py-3 rounded-r-lg rounded-l-none text-[14px] transition-all duration-100 group
          ${isActive 
            ? 'bg-brand-accent/8 text-brand-accent border-l-[3px] border-l-brand-accent font-bold' 
            : 'text-gray-500 hover:text-[#1A1A1A] hover:bg-[#F2F2F2] font-semibold'
          }
        `}
      >
        <Icon size={18} className="shrink-0" />
        <span className={isMobile ? 'block' : (collapsed ? 'hidden' : 'hidden lg:block')}>{item.name}</span>
      </NavLink>
    );
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-app-bg text-[#1A1A1A]">
      
      {/* 1. SIDEBAR (DESKTOP/TABLET) */}
      <aside className={`hidden md:flex flex-col bg-white text-[#1A1A1A] transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-[72px] lg:w-[240px]'} shrink-0 border-r border-border-color h-full`}>
        {/* Brand Header */}
        <div className={`h-16 flex items-center ${collapsed ? 'justify-center px-4' : 'justify-start px-6'} border-b border-border-color shrink-0`}>
          <Logo collapsed={collapsed} />
        </div>
        
        {/* Collapse Button Row (Between Logo and Nav list) */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-end px-6'} py-2 border-b border-border-color shrink-0`}>
          <button 
            onClick={() => setCollapsed(!collapsed)} 
            className="p-1.5 hover:bg-[#F2F2F2] rounded text-gray-500 hover:text-[#1A1A1A] transition-colors cursor-pointer"
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        
        {/* Navigation list */}
        <nav className="flex-1 flex flex-col gap-1 py-3 pr-3 overflow-y-auto">
          {navItems.map(item => renderNavLink(item, false))}
        </nav>
        
        {/* Sidebar Footer */}
        <div className={`p-4 border-t border-border-color text-xs text-gray-400 ${collapsed ? 'hidden' : 'hidden lg:block'} shrink-0`}>
          Landlord Portal
        </div>
      </aside>

      {/* 2. MOBILE DRAWER OVERLAY */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-[#1A1A2E]/40 backdrop-blur-xs z-50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="w-[260px] h-full bg-white text-[#1A1A1A] flex flex-col p-4 shadow-xl border-r border-border-color"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-color">
              <Logo />
              <button onClick={() => setMobileMenuOpen(false)} className="text-gray-500 hover:text-black">
                <X size={24} />
              </button>
            </div>
            <nav className="flex-grow flex flex-col gap-1 overflow-y-auto pr-2">
              {navItems.map(item => renderNavLink(item, true))}
            </nav>
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-border-color flex items-center justify-between px-4 sticky top-0 z-40 shrink-0">
          {/* Mobile hamburger & page title */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 text-gray-500 hover:text-[#1A1A1A] hover:bg-gray-100 rounded-lg"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-base md:text-lg font-bold capitalize font-sans">
              {location.pathname.replace('/', '') || 'Dashboard'}
            </h1>
          </div>

          {/* Quick actions (notifications, profile) */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button className="p-2 text-gray-500 hover:text-brand-accent hover:bg-app-bg rounded-full relative transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-status-danger"></span>
            </button>

            {/* Profile Menu */}
            <div className="flex items-center gap-2 pl-2 border-l border-border-color">
              <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-sm">
                L
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold leading-tight">Landlord Client</p>
                <p className="text-xs text-gray-500 leading-tight">Client Portal</p>
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