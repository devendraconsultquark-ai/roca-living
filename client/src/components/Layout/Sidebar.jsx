import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Home, FileSpreadsheet, FolderOpen,
  Wrench, X, ChevronRight, ChevronLeft, ChevronDown,
  Shield, RefreshCw, Key, Search, TrendingUp, HelpCircle, User, Headphones
} from 'lucide-react';
import { Logo } from '../UI/Logo';
import { useAuth } from '../../context/AuthContext';
import { CirclePoundIcon } from '../UI/CirclePoundIcon';

export const Sidebar = ({ 
  collapsed, 
  setCollapsed, 
  mobileMenuOpen, 
  setMobileMenuOpen 
}) => {
  const location = useLocation();
  const { user } = useAuth();
  const [expandedItems, setExpandedItems] = useState({});

  const toggleExpand = (name) => {
    setExpandedItems(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // Navigation configuration matching the design specs
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Properties', path: '/properties', icon: Home },
    { name: 'Financials', path: '/financials', icon: CirclePoundIcon },
    { name: 'Statements', path: '/statements', icon: FileSpreadsheet },
    { 
      name: 'Compliance', 
      path: '/compliance', 
      icon: Shield, 
      chevron: 'down',
      subItems: [
        { name: 'Overview', path: '/compliance/overview' },
        { name: 'Tenant Compliance', path: '/compliance/tenant' },
        { name: 'Landlord Compliance', path: '/compliance/landlord' },
        { name: 'Certificates', path: '/compliance/certificates' },
        { name: 'Inspections', path: '/compliance/inspections' },
      ]
    },
    { name: 'Maintenance', path: '/maintenance', icon: Wrench},
    { name: 'Tenancy Lifecycle', path: '/tenancy', icon: RefreshCw },
    { name: 'Utilities & Access', path: '/utilities', icon: Key},
    { name: 'Documents', path: '/documents', icon: FolderOpen },
    { name: 'Support', path: '/support', icon: HelpCircle },
    { name: 'Profile', path: '/profile', icon: User },
  ];

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
            : 'text-sidebar-text-muted hover:text-sidebar-text hover:bg-sidebar-hover font'
          }
        `}
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span className="absolute left-0 top-[0%] bottom-[0%] w-[3.5px] bg-status-info rounded-r-full" />
            )}
            <Icon size={18} className="shrink-0" />
            {!isCollapsedState && (
              <>
                <span>{item.name}</span>
                {item.premium && (
                  <span className="ml-auto bg-status-info text-2xs text-white px-1.5 py-0.5 rounded uppercase tracking-wider leading-none">
                    Premium
                  </span>
                )}
                {item.chevron === 'right' && (
                  <ChevronRight size={14} className="ml-auto text-sidebar-text-muted group-hover:text-sidebar-text" />
                )}
                {item.chevron === 'down' && (
                  <ChevronDown size={14} className="ml-auto text-sidebar-text-muted group-hover:text-sidebar-text" />
                )}
              </>
            )}
            {isMobile && item.premium && (
              <span className="ml-auto bg-status-info text-2xs text-white px-1.5 py-0.5 rounded uppercase tracking-wider leading-none">
                Premium
              </span>
            )}
            {isMobile && item.chevron === 'right' && (
              <ChevronRight size={14} className="ml-auto text-sidebar-text-muted group-hover:text-sidebar-text" />
            )}
            {isMobile && item.chevron === 'down' && (
              <ChevronDown size={14} className="ml-auto text-sidebar-text-muted group-hover:text-sidebar-text" />
            )}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <>
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
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        
        {/* Navigation list */}
        <nav className="flex-grow flex flex-col gap-0.5 py-3 pr-3 overflow-y-auto no-scrollbar">
          {navItems.map(item => {
            const isExpanded = expandedItems[item.name];
            const isParentActive = location.pathname.startsWith(item.path);
            return (
              <React.Fragment key={item.name}>
                {item.subItems ? (
                  <div className="flex flex-col">
                    <button
                      onClick={() => toggleExpand(item.name)}
                      className={`
                        relative flex items-center gap-3 px-4 py-2.5 rounded-r-lg rounded-l-none text-sm-portal transition-all duration-100 group w-full text-left cursor-pointer
                        ${isParentActive
                          ? 'bg-sidebar-hover text-sidebar-text'
                          : 'text-sidebar-text-muted hover:text-sidebar-text hover:bg-sidebar-hover'
                        }
                      `}
                    >
                      {isParentActive && (
                        <span className="absolute left-0 top-[0%] bottom-[0%] w-[3.5px] bg-status-info rounded-r-full" />
                      )}
                      <item.icon size={18} className="shrink-0" />
                      {!collapsed && (
                        <>
                          <span>{item.name}</span>
                          <ChevronDown 
                            size={14} 
                            className={`ml-auto text-sidebar-text-muted group-hover:text-sidebar-text transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                          />
                        </>
                      )}
                    </button>
                    {isExpanded && !collapsed && (
                      <div className="flex flex-col pl-9 mt-1 gap-1">
                        {item.subItems.map(sub => (
                          <NavLink
                            key={sub.name}
                            to={sub.path}
                            className={({ isActive }) => `
                              relative flex items-center px-3 py-1.5 rounded-md text-sm-portal transition-colors gap-2
                              ${isActive 
                                ? 'text-sidebar-text bg-sidebar-hover' 
                                : 'text-sidebar-text-muted hover:text-sidebar-text'
                              }
                            `}
                          >
                            {({ isActive }) => (
                              <>
                                {isActive && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-status-info shrink-0" />
                                )}
                                <span className={isActive ? '' : 'pl-3.5'}>{sub.name}</span>
                              </>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  renderNavLink(item, false)
                )}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Help & Support Banner */}
        {!collapsed && (
          <div className="mx-4 my-3 p-4 bg-sidebar-help-bg rounded-xl border border-sidebar-accent flex flex-col gap-2.5">
            <div className="flex gap-3">
              <Headphones size={20} className="text-sidebar-text shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-sm-portal text-sidebar-text">Need help?</span>
                <span className="text-xs-portal leading-normal text-sidebar-text-muted">
                  Contact your property manager or visit our support centre.
                </span>
              </div>
            </div>
            <NavLink 
              to="/support" 
              className="flex items-center justify-between text-xs-portal text-sidebar-text hover:text-brand-accent transition-colors mt-1"
            >
              <span>Go to Support</span>
              <ChevronRight size={14} />
            </NavLink>
          </div>
        )}
        
        {/* Sidebar Footer Profile */}
        <div className={`p-4 border-t border-sidebar-accent ${collapsed ? 'flex justify-center' : 'flex items-center justify-between'} shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center text-sm shrink-0 uppercase">
              {user?.name
                ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2)
                : 'L'}
            </div>
            {!collapsed && (
              <div className="flex flex-col text-left">
                <span className="text-xs text-sidebar-text leading-tight">{user?.name || 'Landlord'}</span>
                <span className="text-[10px] text-sidebar-text-muted leading-tight">Landlord</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 2. MOBILE DRAWER OVERLAY */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-[#1A1A2E]/40 backdrop-blur-xs z-50 md:hidden"
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
              {navItems.map(item => {
                const isExpanded = expandedItems[item.name];
                const isParentActive = location.pathname.startsWith(item.path);
                if (item.subItems) {
                  return (
                    <div key={item.name} className="flex flex-col">
                      <button
                        onClick={() => toggleExpand(item.name)}
                        className={`
                          relative flex items-center gap-3 px-4 py-2.5 rounded-r-lg rounded-l-none text-sm-portal transition-all duration-100 group w-full text-left cursor-pointer
                          ${isParentActive
                            ? 'bg-sidebar-hover text-sidebar-text'
                            : 'text-sidebar-text-muted hover:text-sidebar-text hover:bg-sidebar-hover'
                          }
                        `}
                      >
                        {isParentActive && (
                          <span className="absolute left-0 top-[0%] bottom-[0%] w-[3.5px] bg-status-info rounded-r-full" />
                        )}
                        <item.icon size={18} className="shrink-0" />
                        <span>{item.name}</span>
                        <ChevronDown 
                          size={14} 
                          className={`ml-auto text-sidebar-text-muted group-hover:text-sidebar-text transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                        />
                      </button>
                      {isExpanded && (
                        <div className="flex flex-col pl-9 mt-1 gap-1">
                          {item.subItems.map(sub => (
                            <NavLink
                              key={sub.name}
                              to={sub.path}
                              onClick={() => setMobileMenuOpen(false)}
                              className={({ isActive }) => `
                                relative flex items-center px-3 py-1.5 rounded-md text-sm-portal transition-colors gap-2
                                ${isActive 
                                  ? 'text-sidebar-text bg-sidebar-hover' 
                                  : 'text-sidebar-text-muted hover:text-sidebar-text'
                                }
                              `}
                            >
                              {({ isActive }) => (
                                <>
                                  {isActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-status-info shrink-0" />
                                  )}
                                  <span className={isActive ? '' : 'pl-3.5'}>{sub.name}</span>
                                </>
                              )}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                return renderNavLink(item, true);
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
};
