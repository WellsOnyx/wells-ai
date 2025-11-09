'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  ListTodo,
  Coins,
  Users,
  Bot,
  Menu,
  X,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/ai-ops/agent', icon: LayoutDashboard },
  { name: 'Workspace', href: '/ai-ops/agent/workspace', icon: Briefcase },
  { name: 'Task Queue', href: '/ai-ops/agent/queue', icon: ListTodo },
  { name: 'Earnings', href: '/ai-ops/agent/earnings', icon: Coins },
  { name: 'Clients', href: '/ai-ops/agent/clients', icon: Users },
  { name: 'AI Assistant', href: '/ai-ops/agent/assistant', icon: Bot },
];

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Mock data - in production, fetch from API/context
  const agentData = {
    name: 'Agent Alpha',
    role: 'Senior AI Ops Specialist',
    grainBalance: 2847,
    tasksToday: 12,
    hoursLogged: 6.5,
    notifications: 3,
  };

  const isActive = (href: string) => {
    if (href === '/ai-ops/agent') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 z-40">
        <div className="flex items-center justify-between h-full px-4">
          {/* Left: Mobile menu + Logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center font-bold">
                W
              </div>
              <span className="font-semibold text-lg">Wells Onyx</span>
            </div>
          </div>

          {/* Right: Agent info + Actions */}
          <div className="flex items-center gap-4">
            {/* Agent Name (hidden on mobile) */}
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium">{agentData.name}</span>
              <span className="text-xs text-gray-400">{agentData.role}</span>
            </div>

            {/* Notifications */}
            <button
              className="relative p-2 hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {agentData.notifications > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full"></span>
              )}
            </button>

            {/* Settings Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>

              {showSettingsMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSettingsMenu(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20">
                    <Link
                      href="/ai-ops/agent/settings"
                      className="flex items-center gap-2 px-4 py-3 hover:bg-gray-700 transition-colors"
                      onClick={() => setShowSettingsMenu(false)}
                    >
                      <Settings className="w-4 h-4" />
                      <span className="text-sm">Settings</span>
                    </Link>
                    <button
                      className="flex items-center gap-2 px-4 py-3 hover:bg-gray-700 transition-colors w-full text-left text-red-400"
                      onClick={() => {
                        // Handle sign out
                        setShowSettingsMenu(false);
                      }}
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar - Desktop */}
      <aside
        className={`hidden lg:flex flex-col fixed top-16 left-0 bottom-0 bg-gray-900 border-r border-gray-800 transition-all duration-300 z-30 ${
          isSidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo & Brand */}
        <div className="p-4 border-b border-gray-800">
          {isSidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center font-bold text-lg">
                W
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg">Wells Onyx</span>
                <span className="text-xs text-gray-400">AI Ops Platform</span>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center font-bold text-lg mx-auto">
              W
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${
                  active
                    ? 'bg-purple-600/20 text-purple-400 border border-purple-600/30'
                    : 'hover:bg-gray-800 text-gray-400 hover:text-gray-100'
                } ${!isSidebarOpen && 'justify-center'}`}
                title={!isSidebarOpen ? item.name : undefined}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-purple-400' : ''}`} />
                {isSidebarOpen && (
                  <span className="text-sm font-medium">{item.name}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Stats & Balance */}
        <div className="p-4 border-t border-gray-800 space-y-3">
          {isSidebarOpen ? (
            <>
              {/* Quick Stats */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Tasks Today
                  </span>
                  <span className="font-semibold text-purple-400">
                    {agentData.tasksToday}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Hours Logged
                  </span>
                  <span className="font-semibold text-purple-400">
                    {agentData.hoursLogged}h
                  </span>
                </div>
              </div>

              {/* GRAIN Balance */}
              <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-600/30 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-yellow-400" />
                    <span className="text-xs text-gray-400">GRAIN</span>
                  </div>
                  <span className="font-bold text-lg text-yellow-400">
                    {agentData.grainBalance.toLocaleString()}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Coins className="w-6 h-6 text-yellow-400" />
              <span className="text-xs font-bold text-yellow-400">
                {(agentData.grainBalance / 1000).toFixed(1)}k
              </span>
            </div>
          )}
        </div>

        {/* Collapse Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center hover:bg-purple-600 hover:border-purple-500 transition-colors"
          aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isSidebarOpen ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </aside>

      {/* Sidebar - Mobile */}
      {isMobileMenuOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>

          {/* Slide-in Menu */}
          <aside className="fixed top-16 left-0 bottom-0 w-64 bg-gray-900 border-r border-gray-800 z-50 lg:hidden transform transition-transform duration-300">
            {/* Navigation Items */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                      active
                        ? 'bg-purple-600/20 text-purple-400 border border-purple-600/30'
                        : 'hover:bg-gray-800 text-gray-400 hover:text-gray-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-purple-400' : ''}`} />
                    <span className="text-sm font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Stats & Balance - Mobile */}
            <div className="p-4 border-t border-gray-800 space-y-3">
              {/* Quick Stats */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Tasks Today
                  </span>
                  <span className="font-semibold text-purple-400">
                    {agentData.tasksToday}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Hours Logged
                  </span>
                  <span className="font-semibold text-purple-400">
                    {agentData.hoursLogged}h
                  </span>
                </div>
              </div>

              {/* GRAIN Balance */}
              <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-600/30 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-yellow-400" />
                    <span className="text-xs text-gray-400">GRAIN</span>
                  </div>
                  <span className="font-bold text-lg text-yellow-400">
                    {agentData.grainBalance.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Main Content Area */}
      <main
        className={`pt-16 min-h-screen transition-all duration-300 ${
          isSidebarOpen ? 'lg:pl-64' : 'lg:pl-20'
        }`}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
