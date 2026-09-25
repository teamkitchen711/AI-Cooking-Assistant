import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import {
  fetchAdminStats,
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  fetchRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
} from '../services/api.js';

export default function Admin({ user, onTabChange, onLogout, onBackToHome }) {
  const [activeSubTab, setActiveSubTab] = useState('users'); // 'users' | 'recipes'
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_users: 0,
    total_admins: 0,
    total_regular_users: 0,
    total_recipes: 0,
  });

  // Users state
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    phone_number: '',
    isAdmin: false,
  });
  const [userError, setUserError] = useState('');
  const [userSubmitting, setUserSubmitting] = useState(false);

  // Recipes state
  const [recipes, setRecipes] = useState([]);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [recipeForm, setRecipeForm] = useState({
    id: '',
    title: '',
    description: '',
    time: '25 min',
    servings: '2 servings',
    kcal: '450 kcal',
    image_url: 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80',
    ingredients: '',
    steps: '',
  });
  const [recipeError, setRecipeError] = useState('');
  const [recipeSubmitting, setRecipeSubmitting] = useState(false);

  // Toast / notification
  const [notification, setNotification] = useState(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Check if current user is admin
  const isCurrentUserAdmin = Boolean(user?.isAdmin === true || user?.isAdmin === 'true');

  // Load initial data
  const loadData = async () => {
    if (!isCurrentUserAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [statsData, usersData, recipesData] = await Promise.all([
        fetchAdminStats().catch(() => null),
        fetchAdminUsers().catch(() => []),
        fetchRecipes().catch(() => []),
      ]);

      if (statsData) setStats(statsData);
      if (usersData) setUsers(usersData);
      if (recipesData) setRecipes(recipesData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      showNotification('Failed to fetch some admin data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // --------------------------------------------------------------------------
  // User Management Handlers
  // --------------------------------------------------------------------------
  const openAddUserModal = () => {
    setEditingUser(null);
    setUserForm({
      name: '',
      email: '',
      password: '',
      phone_number: '',
      isAdmin: false,
    });
    setUserError('');
    setUserModalOpen(true);
  };

  const openEditUserModal = (u) => {
    setEditingUser(u);
    setUserForm({
      name: u.name || '',
      email: u.email || '',
      password: '', // blank if leaving unchanged
      phone_number: u.phone_number || '',
      isAdmin: Boolean(u.isAdmin === true || u.isAdmin === 'true'),
    });
    setUserError('');
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setUserError('');
    if (!userForm.name.trim() || !userForm.email.trim()) {
      setUserError('Name and email are required.');
      return;
    }

    if (!editingUser && (!userForm.password || userForm.password.length < 6)) {
      setUserError('Password must be at least 6 characters long.');
      return;
    }

    if (editingUser && userForm.password && userForm.password.length < 6) {
      setUserError('New password must be at least 6 characters long.');
      return;
    }

    setUserSubmitting(true);
    try {
      if (editingUser) {
        const payload = {
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          phone_number: userForm.phone_number.trim(),
          isAdmin: userForm.isAdmin,
        };
        if (userForm.password.trim()) {
          payload.password = userForm.password.trim();
        }
        await updateAdminUser(editingUser.id, payload);
        showNotification('User updated successfully!');
      } else {
        await createAdminUser(userForm);
        showNotification('New user created successfully!');
      }
      setUserModalOpen(false);
      loadData();
    } catch (err) {
      setUserError(err.message || 'Action failed');
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    const targetId = targetUser.id;
    const currentId = user?.id || user?.sub;
    if (String(targetId) === String(currentId)) {
      alert('You cannot delete your own admin account while logged in.');
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to permanently delete user "${targetUser.name || targetUser.email}"?`
      )
    ) {
      return;
    }

    try {
      await deleteAdminUser(targetId);
      showNotification('User deleted successfully!');
      loadData();
    } catch (err) {
      showNotification(err.message || 'Failed to delete user', 'error');
    }
  };

  // --------------------------------------------------------------------------
  // Recipe Management Handlers
  // --------------------------------------------------------------------------
  const openAddRecipeModal = () => {
    setEditingRecipe(null);
    setRecipeForm({
      id: '',
      title: '',
      description: '',
      time: '20 min',
      servings: '2 servings',
      kcal: '450 kcal',
      image_url: 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80',
      ingredients: '2 eggs\n1 tbsp olive oil\nSalt and pepper',
      steps: 'Heat pan with olive oil.\nWhisk eggs and season.\nCook until golden.',
    });
    setRecipeError('');
    setRecipeModalOpen(true);
  };

  const openEditRecipeModal = (r) => {
    setEditingRecipe(r);
    const ingredientsStr = Array.isArray(r.ingredients)
      ? r.ingredients.join('\n')
      : String(r.ingredients || '');
    const stepsStr = Array.isArray(r.steps)
      ? r.steps.join('\n')
      : String(r.steps || '');

    setRecipeForm({
      id: r.id || '',
      title: r.title || '',
      description: r.description || '',
      time: r.time || '20 min',
      servings: r.servings || '2 servings',
      kcal: r.kcal || '450 kcal',
      image_url: r.image_url || '',
      ingredients: ingredientsStr,
      steps: stepsStr,
    });
    setRecipeError('');
    setRecipeModalOpen(true);
  };

  const handleSaveRecipe = async (e) => {
    e.preventDefault();
    setRecipeError('');
    if (!recipeForm.title.trim()) {
      setRecipeError('Recipe title is required.');
      return;
    }

    const ingredientsList = recipeForm.ingredients
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const stepsList = recipeForm.steps
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      title: recipeForm.title.trim(),
      description: recipeForm.description.trim(),
      time: recipeForm.time.trim() || '20 min',
      servings: recipeForm.servings.trim() || '2 servings',
      kcal: recipeForm.kcal.trim() || '450 kcal',
      image_url:
        recipeForm.image_url.trim() ||
        'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80',
      ingredients: ingredientsList,
      steps: stepsList,
    };

    setRecipeSubmitting(true);
    try {
      if (editingRecipe) {
        await updateRecipe(editingRecipe.id, payload);
        showNotification('Recipe updated successfully!');
      } else {
        if (recipeForm.id.trim()) {
          payload.id = recipeForm.id.trim();
        }
        await createRecipe(payload);
        showNotification('Recipe added successfully!');
      }
      setRecipeModalOpen(false);
      loadData();
    } catch (err) {
      setRecipeError(err.message || 'Action failed');
    } finally {
      setRecipeSubmitting(false);
    }
  };

  const handleDeleteRecipe = async (r) => {
    if (!window.confirm(`Are you sure you want to delete the recipe "${r.title}"?`)) {
      return;
    }

    try {
      await deleteRecipe(r.id);
      showNotification('Recipe deleted successfully!');
      loadData();
    } catch (err) {
      showNotification(err.message || 'Failed to delete recipe', 'error');
    }
  };

  // Filtered lists
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone_number && u.phone_number.includes(q))
    );
  }, [users, userSearch]);

  const filteredRecipes = useMemo(() => {
    if (!recipeSearch.trim()) return recipes;
    const q = recipeSearch.toLowerCase();
    return recipes.filter(
      (r) =>
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [recipes, recipeSearch]);

  // If not admin, block view
  if (!isCurrentUserAdmin) {
    return (
      <div className="flex h-screen bg-[#FAF7F0] text-gray-900 font-sans overflow-hidden">
        <Sidebar
          activeTab="admin"
          onTabChange={onTabChange}
          onLogout={onLogout}
          onBackToHome={onBackToHome}
          user={user}
        />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-red-100 text-red-600 flex items-center justify-center mb-4 shadow-xs">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-stone-800 mb-2">Access Denied</h2>
          <p className="text-stone-500 max-w-md mb-6 text-sm leading-relaxed">
            This dashboard is restricted to verified administrators. Your account currently does not possess administrative privileges.
          </p>
          <button
            onClick={() => onTabChange('chat')}
            className="px-5 py-2.5 bg-[#E2583E] hover:bg-[#d04a32] text-white rounded-xl font-bold text-sm shadow-sm transition-all"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#FAF7F0] text-gray-900 font-sans overflow-hidden">
      {/* 1. Left Sidebar */}
      <Sidebar
        activeTab="admin"
        onTabChange={onTabChange}
        onLogout={onLogout}
        onBackToHome={onBackToHome}
        user={user}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="w-full bg-white/90 backdrop-blur-md h-16 border-b border-stone-200/70 flex items-center justify-between px-6 lg:px-10 shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#E2583E] flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-black text-stone-900 tracking-tight">Admin Console</h1>
              <p className="text-xs text-stone-500 font-medium">Manage users, roles, and recipe catalog</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Admin Session: {user?.email || 'Admin'}
            </span>
          </div>
        </header>

        {/* Notification Toast */}
        {notification && (
          <div
            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 transition-all ${
              notification.type === 'error'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {notification.type === 'error' ? '❌' : '✅'}
            {notification.msg}
          </div>
        )}

        <main className="max-w-7xl w-full mx-auto px-6 lg:px-10 py-8 space-y-8">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Total Users</p>
                <p className="text-2xl font-black text-stone-900 mt-1">{stats.total_users || users.length}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                👥
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Administrators</p>
                <p className="text-2xl font-black text-amber-600 mt-1">{stats.total_admins || users.filter(u => u.isAdmin).length}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg">
                🛡️
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Regular Users</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">{stats.total_regular_users || users.filter(u => !u.isAdmin).length}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                🧑‍🍳
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Total Recipes</p>
                <p className="text-2xl font-black text-[#E2583E] mt-1">{stats.total_recipes || recipes.length}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#E2583E] flex items-center justify-center font-bold text-lg">
                🍲
              </div>
            </div>
          </div>

          {/* Sub-Tabs: Users vs Recipes */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSubTab('users')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  activeSubTab === 'users'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                }`}
              >
                Users Directory ({users.length})
              </button>
              <button
                onClick={() => setActiveSubTab('recipes')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  activeSubTab === 'recipes'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                }`}
              >
                Recipe Catalog ({recipes.length})
              </button>
            </div>

            {activeSubTab === 'users' ? (
              <button
                onClick={openAddUserModal}
                className="px-4 py-2 bg-[#E2583E] hover:bg-[#d04a32] text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add New User
              </button>
            ) : (
              <button
                onClick={openAddRecipeModal}
                className="px-4 py-2 bg-[#E2583E] hover:bg-[#d04a32] text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add New Recipe
              </button>
            )}
          </div>

          {/* --------------------------------------------------------------- */}
          {/* TAB 1: USERS DIRECTORY                                          */}
          {/* --------------------------------------------------------------- */}
          {activeSubTab === 'users' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users by name, email, or phone..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#E2583E]/20 focus:border-[#E2583E]"
                  />
                </div>
              </div>

              {/* Users Table */}
              <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold text-xs uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Phone</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-8 text-center text-stone-400 font-medium">
                            No users found matching "{userSearch}"
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => {
                          const isRowAdmin = Boolean(u.isAdmin === true || u.isAdmin === 'true');
                          const isSelf = String(u.id) === String(user?.id || user?.sub);

                          return (
                            <tr key={u.id} className="hover:bg-stone-50/60 transition-colors">
                              <td className="py-3.5 px-4 font-semibold text-stone-800 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center font-black text-xs uppercase">
                                  {(u.name || u.email || 'U')[0]}
                                </div>
                                <div>
                                  <span>{u.name || 'Unnamed'}</span>
                                  {isSelf && (
                                    <span className="ml-2 text-[10px] bg-stone-100 text-stone-600 font-bold px-1.5 py-0.5 rounded">
                                      You
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-stone-600">{u.email}</td>
                              <td className="py-3.5 px-4 text-stone-500">{u.phone_number || '—'}</td>
                              <td className="py-3.5 px-4">
                                {isRowAdmin ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800">
                                    🛡️ Admin
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-600">
                                    User
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right space-x-2">
                                <button
                                  onClick={() => openEditUserModal(u)}
                                  className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                >
                                  Modify
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  disabled={isSelf}
                                  title={isSelf ? 'Cannot delete your own active account' : 'Delete user'}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                    isSelf
                                      ? 'bg-stone-100 text-stone-300 cursor-not-allowed'
                                      : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                                  }`}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 2: RECIPE CATALOG                                           */}
          {/* --------------------------------------------------------------- */}
          {activeSubTab === 'recipes' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={recipeSearch}
                    onChange={(e) => setRecipeSearch(e.target.value)}
                    placeholder="Search recipes by title or description..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#E2583E]/20 focus:border-[#E2583E]"
                  />
                </div>
              </div>

              {/* Recipe Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredRecipes.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-stone-400 font-medium bg-white rounded-2xl border border-stone-200/80">
                    No recipes found matching "{recipeSearch}"
                  </div>
                ) : (
                  filteredRecipes.map((r) => (
                    <div
                      key={r.id}
                      className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow group"
                    >
                      <div>
                        {/* Image header */}
                        <div className="h-40 w-full overflow-hidden bg-stone-100 relative">
                          <img
                            src={r.image_url || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80'}
                            alt={r.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.target.src = 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80';
                            }}
                          />
                          <span className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-xs text-white text-xs px-2 py-0.5 rounded-md font-medium">
                            {r.time || '20 min'}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="p-4 space-y-2">
                          <h3 className="font-bold text-stone-900 line-clamp-1">{r.title}</h3>
                          <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                            {r.description || 'No description provided.'}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-stone-500 pt-1">
                            <span>🔥 {r.kcal || '450 kcal'}</span>
                            <span>🍽️ {r.servings || '2 servings'}</span>
                            <span>📝 {(r.ingredients || []).length} ingredients</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="px-4 py-3 bg-stone-50/70 border-t border-stone-100 flex items-center justify-between">
                        <span className="text-[11px] text-stone-400 font-mono">ID: {r.id}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditRecipeModal(r)}
                            className="px-3 py-1 bg-stone-200/80 hover:bg-stone-300 text-stone-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Modify
                          </button>
                          <button
                            onClick={() => handleDeleteRecipe(r)}
                            className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* MODAL: ADD / EDIT USER                                              */}
      {/* ------------------------------------------------------------------- */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-stone-100 pb-3">
              <h3 className="text-lg font-black text-stone-900">
                {editingUser ? 'Modify User' : 'Add New User'}
              </h3>
              <button
                onClick={() => setUserModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {userError && (
              <div className="p-3 mb-4 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl">
                {userError}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="e.g. Gordon Ramsay"
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E2583E]/20 focus:border-[#E2583E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="e.g. chef@kitchen.com"
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E2583E]/20 focus:border-[#E2583E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {editingUser ? 'Change Password (Leave blank to keep current)' : 'Password (min 6 characters)'}
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder={editingUser ? '•••••••• (unchanged)' : 'Enter strong password'}
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E2583E]/20 focus:border-[#E2583E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={userForm.phone_number}
                  onChange={(e) => setUserForm({ ...userForm, phone_number: e.target.value })}
                  placeholder="e.g. +1 555-0199"
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E2583E]/20 focus:border-[#E2583E]"
                />
              </div>

              <div className="pt-2 flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
                <div>
                  <p className="text-xs font-bold text-stone-800">Administrator Privileges (isAdmin)</p>
                  <p className="text-[11px] text-stone-500">Enable full permissions to modify users and recipes</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userForm.isAdmin}
                    onChange={(e) => setUserForm({ ...userForm, isAdmin: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E2583E]"></div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userSubmitting}
                  className="px-5 py-2 bg-[#E2583E] hover:bg-[#d04a32] text-white rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {userSubmitting ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL: ADD / EDIT RECIPE                                            */}
      {/* ------------------------------------------------------------------- */}
      {recipeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between mb-4 border-b border-stone-100 pb-3">
              <h3 className="text-lg font-black text-stone-900">
                {editingRecipe ? 'Modify Recipe' : 'Add New Recipe'}
              </h3>
              <button
                onClick={() => setRecipeModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {recipeError && (
              <div className="p-3 mb-4 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl">
                {recipeError}
              </div>
            )}

            <form onSubmit={handleSaveRecipe} className="space-y-4 text-sm max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Recipe Title *</label>
                <input
                  type="text"
                  required
                  value={recipeForm.title}
                  onChange={(e) => setRecipeForm({ ...recipeForm, title: e.target.value })}
                  placeholder="e.g. Creamy Tuscan Garlic Chicken"
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E2583E]/20 focus:border-[#E2583E]"
                />
              </div>

              {!editingRecipe && (
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Recipe Slug / ID (Optional, auto-generated from title if blank)
                  </label>
                  <input
                    type="text"
                    value={recipeForm.id}
                    onChange={(e) => setRecipeForm({ ...recipeForm, id: e.target.value })}
                    placeholder="e.g. tuscan-garlic-chicken"
                    className="w-full px-3.5 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E2583E]/20 focus:border-[#E2583E]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Description</label>
                <textarea
                  rows="2"
                  value={recipeForm.description}
                  onChange={(e) => setRecipeForm({ ...recipeForm, description: e.target.value })}
                  placeholder="Short, mouthwatering overview of the dish..."
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E2583E]/20 focus:border-[#E2583E]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Cooking Time</label>
                  <input
                    type="text"
                    value={recipeForm.time}
                    onChange={(e) => setRecipeForm({ ...recipeForm, time: e.target.value })}
                    placeholder="e.g. 25 min"
                    className="w-full px-3.5 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E2583E]/20 focus:border-[#E2583E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Servings</label>
                  <input
                    type="text"
                    value={recipeForm.servings}
                    onChange={(e) => setRecipeForm({ ...recipeForm, servings: e.target.value })}
                    placeholder="e.g. 2 servings"
                    className="w-full px-3.5 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E2583E]/20 focus:border-[#E2583E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Calories</label>
                  <input
                    type="text"
                    value={recipeForm.kcal}
                    onChange={(e) => setRecipeForm({ ...recipeForm, kcal: e.target.value })}
                    placeholder="e.g. 520 kcal"
                    className="w-full px-3.5 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E2583E]/20 focus:border-[#E2583E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Photo Image URL</label>
                <input
                  type="url"
                  value={recipeForm.image_url}
                  onChange={(e) => setRecipeForm({ ...recipeForm, image_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E2583E]/20 focus:border-[#E2583E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Ingredients (One per line)
                </label>
                <textarea
                  rows="4"
                  value={recipeForm.ingredients}
                  onChange={(e) => setRecipeForm({ ...recipeForm, ingredients: e.target.value })}
                  placeholder="2 chicken breasts&#10;1 cup heavy cream&#10;2 cloves garlic, minced&#10;1/2 cup sun-dried tomatoes"
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#E2583E]/20 focus:border-[#E2583E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Cooking Steps (One per line)
                </label>
                <textarea
                  rows="4"
                  value={recipeForm.steps}
                  onChange={(e) => setRecipeForm({ ...recipeForm, steps: e.target.value })}
                  placeholder="Season chicken breasts with salt, pepper, and Italian seasoning.&#10;Sear chicken in olive oil for 5 minutes per side.&#10;Stir in garlic, cream, and tomatoes; simmer until thick."
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#E2583E]/20 focus:border-[#E2583E]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setRecipeModalOpen(false)}
                  className="px-4 py-2 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recipeSubmitting}
                  className="px-5 py-2 bg-[#E2583E] hover:bg-[#d04a32] text-white rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {recipeSubmitting ? 'Saving...' : editingRecipe ? 'Update Recipe' : 'Add Recipe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
