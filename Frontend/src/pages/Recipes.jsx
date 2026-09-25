import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import { fetchRecipes, fetchSelectedRecipes } from '../services/api.js';

// Asset Images
import chefImg from '../assets/chef.png';
import pastaImg from '../assets/pasta.jpg';

// Default Recipes Seed Data
const DEFAULT_RECIPES = [];

export default function Recipes({
  user,
  selectedRecipesList = [],
  onSelectRecipe,
  onTabChange,
  onLogout,
  onBackToHome
}) {
  const [recipes, setRecipes] = useState(DEFAULT_RECIPES);
  const [selectedRecipes, setSelectedRecipes] = useState(selectedRecipesList);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync selectedRecipesList prop if passed
  useEffect(() => {
    if (Array.isArray(selectedRecipesList)) {
      const formatted = selectedRecipesList.map((s) => ({
        ...s,
        image: s.image_url || s.image || pastaImg,
      }));
      setSelectedRecipes(formatted);
    }
  }, [selectedRecipesList]);

  // Fetch all recipes catalog and all user cooking sessions
  useEffect(() => {
    fetchRecipes().then((dbRecipes) => {
      if (dbRecipes && dbRecipes.length > 0) {
        const formatted = dbRecipes.map((r) => ({
          ...r,
          image: r.image_url || r.image || pastaImg,
        }));
        setRecipes(formatted);
      }
    });

    fetchSelectedRecipes().then((selectedList) => {
      const list = Array.isArray(selectedList) ? selectedList : [];
      const formatted = list.map((s) => ({
        ...s,
        image: s.image_url || s.image || pastaImg,
      }));
      setSelectedRecipes(formatted);
    });
  }, [user]);

  // Filter recipes based on search query
  const filteredRecipes = recipes.filter((r) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Starts a clean NEW CHAT for this recipe
  const handleCookWithAI = (recipe) => {
    if (!recipe) return;
    const fullRecipe = recipes.find((r) => r.id === (recipe.id || recipe.recipe_id)) || recipe;
    if (onSelectRecipe) {
      onSelectRecipe(fullRecipe, { isNewChat: true });
    }
  };

  // Continues PREVIOUS CHAT for this recipe
  const handleContinueCooking = (recipe) => {
    if (!recipe) return;
    const fullRecipe = recipes.find((r) => r.id === (recipe.id || recipe.recipe_id)) || recipe;
    if (onSelectRecipe) {
      onSelectRecipe(fullRecipe, { isNewChat: false });
    }
  };

  return (
    <div className="flex h-screen bg-[#FAF7F0] text-gray-900 font-sans overflow-hidden">
      {/* 1. Leftmost Navigation Icon Rail */}
      <Sidebar
        activeTab="recipes"
        onTabChange={onTabChange}
        onLogout={onLogout}
        onBackToHome={onBackToHome}
        user={user}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="w-full bg-white/80 backdrop-blur-xs h-14 border-b border-stone-200/60 flex items-center justify-between px-6 lg:px-10 shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <span className="text-base">📖</span>
              <span>Recipe Catalog</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Search Bar */}
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipes..."
                className="w-56 sm:w-72 pl-9 pr-10 py-1.5 rounded-full border border-stone-200 text-xs font-medium focus:ring-2 focus:ring-brand-red outline-none bg-stone-50"
              />
              <svg className="w-4 h-4 text-stone-400 absolute left-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <button
                type="button"
                className="w-6 h-6 rounded-full bg-brand-red text-white flex items-center justify-center absolute right-1.5 hover:bg-red-600 transition"
                title="Search"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>

            {/* User Profile avatar */}
            <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
              <div className="w-8 h-8 rounded-full bg-rose-100 text-brand-red flex items-center justify-center font-bold text-xs">
                👤
              </div>
            </div>
          </div>
        </header>

        {/* Content Container */}
        <main className="max-w-6xl w-full mx-auto px-6 lg:px-10 py-8 space-y-10">
          
          {/* SECTION 1: All Recipes */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-gray-950 tracking-tight">
                  All Recipes
                </h2>
                <span className="text-xs font-bold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200/60">
                  {filteredRecipes.length} {filteredRecipes.length === 1 ? 'recipe' : 'recipes'}
                </span>
              </div>
            </div>

            {/* Recipes Cards Grid */}
            {filteredRecipes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {filteredRecipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="bg-white rounded-2xl border border-stone-200/70 p-4 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-3"
                  >
                    {/* Top Stats Badges */}
                    <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-gray-600">
                      <div className="flex items-center gap-1 bg-stone-50 px-2.5 py-1 rounded-full border border-stone-100">
                        <span>🔥</span>
                        <span>{recipe.kcal}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-stone-50 px-2.5 py-1 rounded-full border border-stone-100">
                        <span>👥</span>
                        <span>{recipe.servings}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-stone-50 px-2.5 py-1 rounded-full border border-stone-100">
                        <span>⏱️</span>
                        <span>{recipe.time}</span>
                      </div>
                    </div>

                    {/* Photo */}
                    <div className="w-full h-44 rounded-xl overflow-hidden bg-stone-100">
                      <img
                        src={recipe.image}
                        alt={recipe.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>

                    {/* Title & Desc */}
                    <div>
                      <h3 className="font-bold text-sm text-gray-950 line-clamp-1">
                        {recipe.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                        {recipe.description}
                      </p>
                    </div>

                    {/* CTA Button */}
                    <button
                      type="button"
                      onClick={() => handleCookWithAI(recipe)}
                      className="w-full py-2.5 bg-brand-red hover:bg-brand-red-hover text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>📖</span>
                      <span>Cook with AI</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200/70 p-8 text-center space-y-2">
                <p className="text-sm font-semibold text-gray-700">
                  No recipes found matching "{searchQuery}"
                </p>
                <p className="text-xs text-stone-500">
                  Try searching with different ingredients or keywords.
                </p>
              </div>
            )}
          </section>

          {/* SECTION 2: "Health is Wealth / Try this today" Banner */}
          <section className="w-full bg-[#c7f99e] rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 border border-emerald-200/50">
            {/* Left Content Column */}
            <div className="space-y-4 max-w-md z-10">
              <div>
                <h3 className="text-3xl sm:text-4xl font-black text-gray-950 tracking-tight">
                  Health is Wealth
                </h3>
                <p className="text-sm font-bold text-red-600 mt-1">
                  Try this today
                </p>
              </div>

              {/* Mini Featured Recipe Card */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-200/70 max-w-xs space-y-3">
                <div className="w-full h-32 rounded-xl overflow-hidden">
                  <img
                    src={pastaImg}
                    alt="Garlic Butter Shrimp Pasta"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-950">
                    Garlic Butter Shrimp Pasta
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    Silky garlicky pasta tossed with buttery shrimp and a splash of lemon.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => recipes[0] && handleCookWithAI(recipes[0])}
                  className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
                >
                  Cook Recipe
                </button>
              </div>
            </div>

            {/* Right Mascot Illustration */}
            <div className="w-56 sm:w-72 md:w-80 shrink-0 flex justify-center items-center drop-shadow-xl">
              <img
                src={chefImg}
                alt="Chef Bon Doctor Stethoscope"
                className="w-full h-auto object-contain select-none pointer-events-none"
              />
            </div>
          </section>

          {/* SECTION 3: Your Selected Recipes */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black text-gray-950 tracking-tight">
              Your Selected Recipes
            </h2>

            {selectedRecipes && selectedRecipes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {selectedRecipes.map((recipe) => (
                  <div
                    key={`selected-${recipe.id}`}
                    className="bg-white rounded-2xl border border-stone-200/70 p-4 shadow-xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="w-full h-40 rounded-xl overflow-hidden bg-stone-100">
                        <img
                          src={recipe.image || recipe.image_url || pastaImg}
                          alt={recipe.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-gray-950 truncate">
                          {recipe.title}
                        </h4>
                        {(recipe.time || recipe.kcal) && (
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {recipe.time} {recipe.time && recipe.kcal ? '•' : ''} {recipe.kcal}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleContinueCooking(recipe)}
                      className="w-full py-2 bg-brand-red hover:bg-brand-red-hover text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>🍳</span>
                      <span>Continue Cooking</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-rose-50 text-brand-red flex items-center justify-center mx-auto text-xl font-bold">
                  🍳
                </div>
                <h3 className="font-bold text-sm text-gray-950">No selected recipes yet</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Pick any recipe from "All Recipes" above to start cooking and chatting with Chef Bon!
                </p>
              </div>
            )}
          </section>

        </main>
      </div>
    </div>
  );
}
