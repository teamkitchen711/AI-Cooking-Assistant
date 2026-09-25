import React from 'react';

export default function RightWidgets({ onSelectPrompt, onNavigate, shoppingItems = [], savedCups = [] }) {
  const adventurousPrompts = [
    "Give me something quick",
    "Surprise me with a dinner idea",
    "What can I make with what I have?",
  ];

  const pendingItems = shoppingItems.filter((i) => !i.completed);

  // Deduplicate saved cups by id and lowercase name
  const seenIds = new Set();
  const seenNames = new Set();
  const uniqueCups = (savedCups || []).filter((cup) => {
    if (!cup) return false;
    const id = String(cup.id || '');
    const name = String(cup.name || '').trim().toLowerCase();
    if (id && seenIds.has(id)) return false;
    if (name && seenNames.has(name)) return false;
    if (id) seenIds.add(id);
    if (name) seenNames.add(name);
    return true;
  });

  return (
    <aside className="w-80 shrink-0 hidden xl:flex flex-col gap-5 p-5 bg-stone-50/50 border-l border-stone-100 overflow-y-auto select-none">
      {/* 1. Measuring Widget */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
            <span className="text-brand-red text-base">🧮</span>
            <span>Measuring</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('measuring')}
            title="Open Measuring tool"
            className="text-gray-400 hover:text-brand-red transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          Save your usual cups, scale, or spoons here so I can auto-convert every recipe for you.
        </p>

        <div className="flex items-center flex-wrap gap-2 pt-1">
          {uniqueCups.map((cup) => (
            <button
              key={cup.id}
              type="button"
              onClick={() => onNavigate?.('measuring')}
              className="px-2.5 py-1 bg-rose-50/80 hover:bg-rose-100 text-brand-red text-xs font-bold rounded-full border border-rose-200/80 transition cursor-pointer flex items-center gap-1"
            >
              <span>☕</span>
              <span>{cup.name} ({cup.volume_ml}ml)</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onNavigate?.('measuring')}
            className="px-2.5 py-1 text-xs font-semibold text-brand-red border border-brand-red/40 hover:border-brand-red hover:bg-rose-50/50 rounded-full transition-colors cursor-pointer"
          >
            + Add tool
          </button>
        </div>
      </div>

      {/* 2. Shopping List Widget */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
            <span className="text-brand-red text-base">🛒</span>
            <span>Shopping list</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('shopping')}
            title="Open Shopping list"
            className="text-gray-400 hover:text-brand-red transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          Ingredients you're missing will land here automatically.
        </p>

        {pendingItems.length > 0 ? (
          <div className="space-y-2 pt-1">
            <div className="space-y-1.5">
              {pendingItems.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs text-stone-700 bg-stone-50 px-2.5 py-1.5 rounded-lg">
                  <span className="truncate font-medium">{item.name}</span>
                  <span className="text-stone-400 text-[11px] shrink-0 ml-2 font-semibold">{item.amount}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNavigate?.('shopping')}
              className="w-full text-center text-xs font-bold text-brand-red hover:text-red-700 pt-1 cursor-pointer"
            >
              View all ({pendingItems.length} items) →
            </button>
          </div>
        ) : (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => onNavigate?.('shopping')}
              className="w-full py-2 bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Open shopping list
            </button>
          </div>
        )}
      </div>

      {/* 3. Feeling Adventurous? Widget */}
      <div className="bg-linear-to-br from-purple-50/60 to-pink-50/40 rounded-2xl p-5 border border-purple-100/80 shadow-xs space-y-3">
        <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
          <span className="text-purple-600 text-base">🔍</span>
          <span>Feeling adventurous?</span>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">
          Ask Chef Bon:
        </p>

        <div className="space-y-1.5 pt-1">
          {adventurousPrompts.map((promptText, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt?.(promptText)}
              className="w-full text-left p-2 rounded-xl bg-white/80 hover:bg-white text-xs text-purple-900 hover:text-purple-700 font-medium border border-purple-100 shadow-2xs transition cursor-pointer"
            >
              "{promptText}"
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
