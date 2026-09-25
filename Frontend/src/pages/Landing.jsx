import React, { useState } from 'react';
import Navbar from '../components/Navbar.jsx';
import FeatureItem from '../components/FeatureItem.jsx';
import Login from './LoginAndSignup.jsx';

// Asset Images
import recipeImg from '../assets/1.jpg';
import groceryImg from '../assets/landing_ingredient.jpg';
import calorieImg from '../assets/Fitia.jpg';
import healthImg from '../assets/health_tips.jpg';
import conversionImg from '../assets/conversion.jpg';
import chefImg from '../assets/chef.png';

const STYLES = {
  primaryBtn: "px-6 py-3 text-sm md:text-base font-bold text-white bg-brand-red hover:bg-brand-red-hover rounded-full shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer",
  secondaryOutlineBtn: "px-6 py-2.5 text-sm font-semibold text-brand-red border border-brand-red rounded-full hover:bg-brand-red-light transition-colors duration-200 text-center max-w-[300px]",
  sectionTitle: "text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight",
  sectionSubtitle: "text-xs sm:text-sm text-gray-600 leading-relaxed",
  cardWrapper: "w-full max-w-md h-80 sm:h-96 rounded-3xl overflow-hidden shadow-xl transform hover:scale-[1.02] transition-transform duration-300 relative",
};

export default function Landing({ user, onLoginSuccess, onLogout, onNavigateToChat }) {
  const [authModal, setAuthModal] = useState({
    isOpen: false,
    mode: 'login', // 'login' | 'signup'
  });

  const openLogin = () => setAuthModal({ isOpen: true, mode: 'login' });
  const openSignup = () => setAuthModal({ isOpen: true, mode: 'signup' });
  const closeAuth = () => setAuthModal((prev) => ({ ...prev, isOpen: false }));
  const switchMode = (mode) => setAuthModal({ isOpen: true, mode });

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased flex flex-col relative">
      {/* Auth Modal (Login / Signup Popup) */}
      <Login
        isOpen={authModal.isOpen}
        mode={authModal.mode}
        onClose={closeAuth}
        onSwitchMode={switchMode}
        onLoginSuccess={(userData) => {
          closeAuth();
          if (onLoginSuccess) onLoginSuccess(userData);
        }}
      />

      {/* 1. Navbar Component */}
      <Navbar
        user={user}
        onLogout={onLogout}
        onNavigateToChat={onNavigateToChat}
        onOpenLogin={openLogin}
        onOpenSignup={openSignup}
      />

      {/* 2. Hero Section */}
      <section className="relative w-full max-w-7xl mx-auto px-6 lg:px-12 pt-8 pb-16 md:pt-12 md:pb-24 grid grid-cols-1 md:grid-cols-12 items-center gap-8 min-h-125">
        {/* Left Headline & CTA */}
        <div className="md:col-span-4 flex flex-col items-start z-10 space-y-6">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-gray-950">
            Create <br />
            meals you <br />
            love with <br />
            <span className="text-brand-red">BonAppetit</span>
          </h1>

          {user ? (
            <button 
              type="button"
              onClick={onNavigateToChat}
              className={STYLES.primaryBtn}
            >
              Enter Chef Bon Workspace 🍳
            </button>
          ) : (
            <button 
              type="button"
              onClick={openSignup}
              className={STYLES.primaryBtn}
            >
              Join BonAppetit Free
            </button>
          )}
        </div>

        {/* Center Character Illustration */}
        <div className="md:col-span-5 flex justify-center items-end relative">
          <div className="w-64 sm:w-80 md:w-96 lg:w-105 max-w-full drop-shadow-2xl transition-transform duration-300 hover:scale-105">
            <img
              src={chefImg}
              alt="BonAppetit Chef Mascot"
              className="w-full h-auto object-contain select-none pointer-events-none"
            />
          </div>
        </div>

        {/* Right Secondary CTA */}
        <div className="md:col-span-3 flex justify-center md:justify-end items-center">
          {user ? (
            <button 
              type="button"
              onClick={onLogout}
              className={STYLES.secondaryOutlineBtn}
            >
              Sign out ({user.name || user.email})
            </button>
          ) : (
            <button 
              type="button"
              onClick={openLogin}
              className={STYLES.secondaryOutlineBtn}
            >
              I already have an account
            </button>
          )}
        </div>
      </section>

      {/* 3. Main Feature Section Container */}
      <section className="w-full bg-brand-bg py-16 px-6 lg:px-12 border-t border-gray-200">
        <div className="max-w-6xl mx-auto space-y-20">
          {/* Section Title Header */}
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className={STYLES.sectionTitle}>
              Turn inspiration into delicious meals
            </h2>
            <p className={STYLES.sectionSubtitle}>
              With BonAppetit, discover recipes, plan your meals, track calories, and convert measurements in one place. Your ultimate kitchen assistant.
            </p>
          </div>

          {/* Staggered Feature Cards List */}
          <div className="space-y-24 md:space-y-32">
            {/* Feature 1: Discover recipes you'll love */}
            <FeatureItem
              title="Discover recipes you'll love"
              description="Find delicious, easy-to-make recipes tailored to your taste, dietary preferences, and what's in your fridge."
            >
              <div className={`${STYLES.cardWrapper} bg-slate-900`}>
                <img
                  src={recipeImg}
                  alt="Discover Recipes"
                  className="w-full h-full object-cover rounded-3xl"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-black/20 rounded-3xl pointer-events-none" />
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <span className="bg-brand-red text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider text-white">
                    Featured Recipe
                  </span>
                  <h4 className="text-lg font-bold mt-2">Fresh Avocado & Citrus Summer Salad</h4>
                  <p className="text-xs text-gray-200 mt-1">Ready in 15 mins • 320 kcal</p>
                </div>
              </div>
            </FeatureItem>

            {/* Feature 2: Shop smarter with your list */}
            <FeatureItem
              title="Shop smarter with your list"
              description="Organize your ingredients and streamline your grocery shopping experience. Never miss an item again."
              reverse
            >
              <div className={`${STYLES.cardWrapper} bg-white border border-stone-200`}>
                <img
                  src={groceryImg}
                  alt="Grocery List"
                  className="w-full h-full object-cover rounded-3xl"
                />
              </div>
            </FeatureItem>

            {/* Feature 3: Track your calories with ease */}
            <FeatureItem
              title="Track your calories with ease"
              description="Snap a photo of your meal or search our vast database to instantly track your calories and macros effortlessly."
            >
              <div className={`${STYLES.cardWrapper} bg-slate-900 border border-slate-800`}>
                <img
                  src={calorieImg}
                  alt="Track Calories"
                  className="w-full h-full object-cover rounded-3xl"
                />
              </div>
            </FeatureItem>

            {/* Feature 4: Customize your health goals */}
            <FeatureItem
              title="Customize your health goals"
              description="Set custom goals for weight, protein, carbs, and track your daily wellness, balance, and physical progress over time."
              reverse
            >
              <div className={`${STYLES.cardWrapper} bg-white border border-gray-200`}>
                <img
                  src={healthImg}
                  alt="Health Goals"
                  className="w-full h-full object-cover rounded-3xl"
                />
              </div>
            </FeatureItem>

            {/* Feature 5: Convert units with ease */}
            <FeatureItem
              title="Convert units with ease"
              description="Convert measurements on the fly so you can focus on cooking without guessing volume, weight, or temperature."
            >
              <div className={`${STYLES.cardWrapper} bg-amber-50 border border-amber-200`}>
                <img
                  src={conversionImg}
                  alt="Cooking Unit Conversion"
                  className="w-full h-full object-cover rounded-3xl"
                />
              </div>
            </FeatureItem>
          </div>
        </div>
      </section>

      {/* 4. Footer Section */}
      <footer className="w-full bg-white border-t border-gray-200 py-10 px-6 lg:px-12 text-center text-xs text-gray-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="font-bold text-brand-red text-lg">
            BonAppetit
          </div>
          <div>
            © {new Date().getFullYear()} BonAppetit. All rights reserved. Your ultimate kitchen companion.
          </div>
          <div className="flex gap-4 font-medium text-gray-600">
            <a href="#" className="hover:text-brand-red transition-colors">Privacy</a>
            <a href="#" className="hover:text-brand-red transition-colors">Terms</a>
            <a href="#" className="hover:text-brand-red transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
