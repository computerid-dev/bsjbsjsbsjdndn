/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Home, TrendingUp } from 'lucide-react';

export type ActiveTab = 'home' | 'foods' | 'progress';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    {
      id: 'home' as ActiveTab,
      label: 'HOME',
      icon: Home,
    },
    {
      id: 'progress' as ActiveTab,
      label: 'PROGRESS',
      icon: TrendingUp,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#0b0f19] border-t border-slate-800 safe-bottom">
      <div className="max-w-md mx-auto grid grid-cols-2 px-4 py-2 gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              data-testid={`nav-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl transition-all active:scale-95 ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon
                size={18}
                className={isActive ? 'text-emerald-400' : 'text-slate-400'}
              />
              <span className="text-sm tracking-wide font-bold">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

