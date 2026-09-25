import React from 'react';

// Reusable styling variables for Navbar elements
const NAV_STYLES = {
  logo: "text-xl md:text-2xl font-extrabold tracking-tight text-brand-red cursor-pointer",
  loginBtn: "px-5 py-1.5 text-xs md:text-sm font-semibold text-brand-red border border-brand-red rounded-full hover:bg-brand-red-light transition-colors duration-200 cursor-pointer",
  signupBtn: "px-5 py-1.5 text-xs md:text-sm font-semibold text-white bg-brand-red hover:bg-red-600 rounded-full transition-colors duration-200 cursor-pointer",
  chatBtn: "px-4 py-1.5 text-xs md:text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-full shadow-sm transition-all duration-200 cursor-pointer flex items-center gap-1.5",
  logoutBtn: "px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 rounded-full transition-colors cursor-pointer",
};

export default function Navbar({ user, onLogout, onNavigateToChat, onOpenLogin, onOpenSignup }) {
  return (
    <nav className="w-full bg-white py-4 px-6 md:px-12 flex items-center justify-between border-b border-gray-100 sticky top-0 z-40 shadow-xs">
      {/* Brand Logo */}
      <div className="flex items-center">
        <a href="#" className={NAV_STYLES.logo}>
          BonAppetit
        </a>
      </div>

      {/* Auth Actions */}
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-200 rounded-full text-xs font-medium text-gray-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{user.name || user.email}</span>
            </div>
            <button
              type="button"
              onClick={onNavigateToChat}
              className={NAV_STYLES.chatBtn}
            >
              <span>Workspace</span>
              <span>🍳</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className={NAV_STYLES.logoutBtn}
              title="Sign out"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onOpenLogin}
              className={NAV_STYLES.loginBtn}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={onOpenSignup}
              className={NAV_STYLES.signupBtn}
            >
              Sign up
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
