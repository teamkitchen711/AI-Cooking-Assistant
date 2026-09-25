import { useState } from 'react';
import { loginUser, signupUser } from '../services/api.js';

const STYLES = {
  loginFields: "block text-xs font-bold text-gray-900 mb-1.5",
  inputField: "w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-sm text-gray-900 transition font-medium"
};

export default function Login({ isOpen, mode = 'login', onClose, onSwitchMode, onLoginSuccess }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone_number: '',
  });

  if (!isOpen) return null;

  const isLogin = mode === 'login';

  const handleChange = (e) => {
    setError(null);
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleModeChange = (newMode) => {
    setError(null);
    onSwitchMode(newMode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let res;
      if (isLogin) {
        res = await loginUser(formData.email, formData.password);
      } else {
        res = await signupUser({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone_number: formData.phone_number,
        });
      }

      console.log('JWT Auth success:', res);
      if (onLoginSuccess) {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'Authentication failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dimmed Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div 
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md bg-white rounded-3xl p-8 sm:p-9 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200 max-h-[95vh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          aria-label="Close modal"
          className="absolute top-5 right-5 w-8 h-8 rounded-full border border-gray-200 hover:border-gray-400 bg-white flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Brand Badge */}
        <div className="flex justify-center mb-3">
          <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center text-brand-red font-black text-xl shadow-xs">
            B
          </div>
        </div>

        {/* Header Title */}
        <div className="text-center mb-5">
          <h2 className="text-2xl font-black text-gray-950 tracking-tight">
            {isLogin ? "Welcome back" : "Create an account"}
          </h2>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            {isLogin ? "Sign in with your email and password" : "Enter your details to create your profile"}
          </p>
        </div>

        {/* Error Notification Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <svg className="w-4 h-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-left">

          {/* Signup only: Name */}
          {!isLogin && (
            <div>
              <label className={STYLES.loginFields}>
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Kasun Perera"
                required
                className={STYLES.inputField}
              />
            </div>
          )}

          {/* Email field (Both Login & Signup) */}
          <div>
            <label className={STYLES.loginFields}>
              Email address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="e.g. user@example.com"
              required
              className={STYLES.inputField}
            />
          </div>

          {/* Signup only: Phone Number */}
          {!isLogin && (
            <div>
              <label className={STYLES.loginFields}>
                Phone Number
              </label>
              <input
                type="tel"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                placeholder="e.g. 0771234567"
                required
                className={STYLES.inputField}
              />
            </div>
          )}

          {/* Password field (Both Login & Signup) */}
          <div>
            <label className={STYLES.loginFields}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={isLogin ? "Enter your password" : "Create a password (min 6 chars)"}
                required
                className={STYLES.inputField}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer text-sm flex items-center justify-center gap-2 ${
                loading ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {loading && (
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              )}
              {loading 
                ? (isLogin ? "Signing in..." : "Creating account...") 
                : (isLogin ? "Sign in" : "Sign up")}
            </button>
          </div>
        </form>

        {/* Switch between login and signup */}
        <div className="mt-5 text-center text-xs text-gray-600 font-medium">
          {isLogin ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => handleModeChange('signup')}
                className="font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => handleModeChange('login')}
                className="font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
