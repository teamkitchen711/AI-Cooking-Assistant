import React from 'react';

export default function Sidebar({ activeTab = 'chat', onTabChange, onLogout, onBackToHome, user }) {
  const normalizedTab = activeTab === 'home' ? 'chat' : activeTab;
  const isAdmin = Boolean(user?.isAdmin === true || user?.isAdmin === 'true');

  const navItems = [
    {
      id: 'chat',
      label: 'Home / Chat',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'recipes',
      label: 'Recipes',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'measuring',
      label: 'Measuring',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 18h12l3-18H3z M8 6v4 M12 6v4 M16 6v4" />
        </svg>
      ),
    },
    {
      id: 'shopping',
      label: 'Shopping List',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    ...(isAdmin ? [{
      id: 'admin',
      label: 'Admin Panel',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    }] : []),
  ];

  return (
    <aside className="w-16 md:w-18 bg-white border-r border-stone-200/80 flex flex-col items-center justify-between py-5 shrink-0 select-none z-30">
      {/* Top Section: Brand Icon & Nav List */}
      <div className="flex flex-col items-center gap-6 w-full">
        {/* Brand Logo Badge (Click to return to landing) */}
        <button
          type="button"
          onClick={onBackToHome}
          title="Back to Landing Page"
          className="w-10 h-10 rounded-2xl bg-brand-red-light flex items-center justify-center text-brand-red font-black text-xl shadow-xs cursor-pointer hover:scale-105 transition-transform"
        >
          B
        </button>

        {/* Navigation Items */}
        <nav className="flex flex-col items-center gap-3 w-full px-2">
          {navItems.map((item) => {
            const isActive = normalizedTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                onClick={() => onTabChange?.(item.id)}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                  isActive
                    ? 'bg-rose-50 text-brand-red font-bold shadow-xs ring-1 ring-rose-200'
                    : 'text-stone-400 hover:text-stone-700 hover:bg-stone-50'
                }`}
              >
                {item.icon}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Settings & Logout */}
      <div className="w-full px-2 flex flex-col items-center gap-2">

        {/* Log out Button */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            title="Log out"
            className="w-11 h-11 rounded-2xl text-red-500 hover:text-red-700 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  );
}
