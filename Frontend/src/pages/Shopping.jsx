import React, { useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import shopImg from '../assets/shop.png';

export default function Shopping({
  user,
  items = [],
  onToggleItem,
  onAddItem,
  onDeleteItem,
  onClearCompleted,
  onTabChange,
  onLogout,
  onBackToHome,
}) {
  // Local filter: 'all' | 'pending' | 'completed'
  const [filter, setFilter] = useState('all');

  // Tip banner visibility
  const [showTip, setShowTip] = useState(true);

  // Add Item Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemAmount, setItemAmount] = useState('');
  const [itemCategory, setItemCategory] = useState('Produce');

  // Fallback internal state if items not passed via props
  const [localItems, setLocalItems] = useState([]);

  const activeItems = items.length > 0 ? items : localItems;

  const handleToggle = (id) => {
    if (onToggleItem) {
      onToggleItem(id);
    } else {
      setLocalItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, completed: !item.completed } : item
        )
      );
    }
  };

  const handleDelete = (id) => {
    if (onDeleteItem) {
      onDeleteItem(id);
    } else {
      setLocalItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleClear = () => {
    if (onClearCompleted) {
      onClearCompleted();
    } else {
      setLocalItems((prev) => prev.filter((item) => !item.completed));
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    const newItem = {
      id: `shop-${Date.now()}`,
      name: itemName.trim(),
      amount: itemAmount.trim() || '1 item',
      category: itemCategory,
      source: 'Manual',
      completed: false,
      addedAt: 'Just now',
    };

    if (onAddItem) {
      onAddItem(newItem);
    } else {
      setLocalItems((prev) => [newItem, ...prev]);
    }

    setItemName('');
    setItemAmount('');
    setItemCategory('Produce');
    setIsModalOpen(false);
  };

  // Counts
  const totalCount = activeItems.length;
  const completedCount = activeItems.filter((i) => i.completed).length;
  const pendingCount = totalCount - completedCount;

  // Filtered items
  const displayItems = activeItems.filter((item) => {
    if (filter === 'pending') return !item.completed;
    if (filter === 'completed') return item.completed;
    return true;
  });

  return (
    <div className="flex h-screen bg-[#FAF7F0] text-gray-900 font-sans overflow-hidden">
      {/* 1. Left Navigation Rail */}
      <Sidebar
        activeTab="shopping"
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
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-stone-50 border border-stone-200 rounded-full text-xs font-medium text-gray-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{user?.name || user?.email || 'Chef Bon Guest'}</span>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-full transition cursor-pointer"
              >
                Sign out
              </button>
            )}
          </div>
        </header>

        {/* Inner Content Body */}
        <main className="max-w-5xl mx-auto w-full px-6 lg:px-8 py-8 space-y-6">
          {/* Hero Banner with Chef Bon pushing cart */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="space-y-3 z-10 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200/60 text-brand-red text-xs font-black tracking-wide uppercase">
                <span>🛒</span>
                <span>Chef Bon · Smart Shopping</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-950 tracking-tight leading-tight">
                Your shopping list
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                Missing ingredients from your recipes, items caught during AI voice sessions, or items you quickly added by hand. Check them off as you navigate the grocery aisles!
              </p>
            </div>

            {/* Mascot Illustration */}
            <div className="relative shrink-0 flex items-center justify-center">
              <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-orange-50/80 flex items-center justify-center p-2">
                <img
                  src={shopImg}
                  alt="Chef Bon with Shopping Cart"
                  className="w-full h-full object-contain filter drop-shadow-md hover:scale-105 transition-transform duration-300"
                />
              </div>
            </div>
          </div>

          {/* Dismissible Tip Banner */}
          {showTip && (
            <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex items-start justify-between gap-3 text-emerald-950 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-xs leading-relaxed font-medium">
                  <span className="font-extrabold text-emerald-900">Pro Tip:</span> Tap the circle next to any item once you've tossed it into your shopping basket. Tap <strong>Clear completed</strong> to remove purchased goods.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowTip(false)}
                title="Dismiss tip"
                className="text-emerald-700 hover:text-emerald-950 p-1 rounded-lg hover:bg-emerald-100/50 transition cursor-pointer shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Stat Badges & Action Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
            {/* Stat Pills */}
            <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition cursor-pointer ${
                  filter === 'all'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>Total items:</span>
                <span className="font-extrabold">{totalCount}</span>
              </button>

              <button
                type="button"
                onClick={() => setFilter('pending')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition cursor-pointer ${
                  filter === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 border border-amber-200/60 hover:bg-amber-100/80'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>To buy:</span>
                <span className="font-extrabold">{pendingCount}</span>
              </button>

              <button
                type="button"
                onClick={() => setFilter('completed')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition cursor-pointer ${
                  filter === 'completed'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200/60 hover:bg-emerald-100/80'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Purchased:</span>
                <span className="font-extrabold">{completedCount}</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Add Item Button */}
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
                <span>Add item</span>
              </button>
              {/* Clear completed */}
              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition cursor-pointer"
                >
                  Clear completed
                </button>
              )}
            </div>
          </div>

          {/* List Table / Cards */}
          <div className="bg-white rounded-3xl border border-stone-200/80 shadow-xs overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3.5 bg-stone-50 border-b border-stone-200/60 text-[11px] font-bold tracking-wider text-stone-400 uppercase">
              <div className="col-span-6 sm:col-span-5 flex items-center gap-3">
                <span>ITEM</span>
              </div>
              <div className="col-span-3 sm:col-span-2">
                <span>AMOUNT</span>
              </div>
              <div className="hidden sm:block sm:col-span-3">
                <span>SOURCE / ORIGIN</span>
              </div>
              <div className="col-span-3 sm:col-span-2 text-right">
                <span>ACTIONS</span>
              </div>
            </div>

            {/* List Rows */}
            <div className="divide-y divide-stone-100">
              {displayItems.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto text-2xl">
                    🛒
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm">No items to show</h4>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    {filter === 'completed'
                      ? "You haven't checked off any items yet."
                      : "Your shopping list is empty! Click '+ Add item' or ask Chef Bon during chat to add missing ingredients."}
                  </p>
                </div>
              ) : (
                displayItems.map((item) => (
                  <div
                    key={item.id}
                    className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors ${
                      item.completed ? 'bg-stone-50/50' : 'hover:bg-stone-50/70'
                    }`}
                  >
                    {/* Item Name + Checkbox */}
                    <div className="col-span-6 sm:col-span-5 flex items-center gap-3.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggle(item.id)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition shrink-0 cursor-pointer ${
                          item.completed
                            ? 'bg-emerald-500 text-white shadow-2xs'
                            : 'border-2 border-stone-300 hover:border-brand-red'
                        }`}
                        title={item.completed ? 'Mark as to-buy' : 'Mark as bought'}
                      >
                        {item.completed && (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      <div className="min-w-0">
                        <p
                          className={`text-xs sm:text-sm font-bold truncate transition ${
                            item.completed
                              ? 'line-through text-stone-400 font-medium'
                              : 'text-gray-900'
                          }`}
                        >
                          {item.name}
                        </p>
                        <span className="text-[10px] text-stone-400 font-medium sm:hidden">
                          {item.category} • {item.addedAt}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="col-span-3 sm:col-span-2">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                          item.completed
                            ? 'bg-stone-100 text-stone-400'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {item.amount}
                      </span>
                    </div>

                    {/* Source / Category */}
                    <div className="hidden sm:flex sm:col-span-3 items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/50">
                        {item.category}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          item.source === 'AI Voice'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                            : item.source.startsWith('Recipe')
                            ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {item.source}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="w-8 h-8 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition cursor-pointer"
                        title="Delete item"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-stone-200 shadow-xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-50 text-brand-red flex items-center justify-center font-black">
                  🛒
                </div>
                <h3 className="font-black text-gray-950 text-lg">Add shopping item</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Item name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Extra Virgin Olive Oil"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-medium focus:ring-2 focus:ring-brand-red focus:border-brand-red outline-hidden bg-stone-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Amount / Quantity</label>
                  <input
                    type="text"
                    value={itemAmount}
                    onChange={(e) => setItemAmount(e.target.value)}
                    placeholder="e.g. 2 tbsp or 200g"
                    className="w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-medium focus:ring-2 focus:ring-brand-red focus:border-brand-red outline-hidden bg-stone-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-brand-red outline-hidden bg-stone-50"
                  >
                    <option value="Produce">Produce (Veg/Fruit)</option>
                    <option value="Dairy">Dairy & Eggs</option>
                    <option value="Pantry">Pantry & Grains</option>
                    <option value="Meat & Seafood">Meat & Seafood</option>
                    <option value="Spices & Herbs">Spices & Herbs</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:text-stone-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-brand-red hover:bg-brand-red-hover text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
                >
                  Add to list
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
