// Base URL for Flask backend
const API_BASE_URL = 'http://127.0.0.1:5000/api';

/**
 * Helper to build auth headers
 */
function getAuthHeaders() {
  const token = getStoredToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// =========================================================================
// Authentication Endpoints
// =========================================================================
export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Login failed. Invalid email or password.');
  }

  saveAuthSession(data.token, data.user);
  return data;
}

export async function signupUser({ name, email, password, phone_number }) {
  const res = await fetch(`${API_BASE_URL}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, phone_number }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Signup failed. Please check your details.');
  }

  saveAuthSession(data.token, data.user);
  return data;
}

export async function fetchCurrentUser() {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      clearAuthSession();
      return null;
    }

    const data = await res.json();
    return data.user;
  } catch (err) {
    console.error('Failed to fetch user with token:', err);
    return null;
  }
}

export function saveAuthSession(token, user) {
  if (token) localStorage.setItem('auth_token', token);
  if (user) localStorage.setItem('auth_user', JSON.stringify(user));
}

export function getStoredToken() {
  return localStorage.getItem('auth_token');
}

export function getStoredUser() {
  try {
    const userStr = localStorage.getItem('auth_user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
}


// =========================================================================
// Recipes Endpoints
// =========================================================================
export async function fetchRecipes() {
  try {
    const res = await fetch(`${API_BASE_URL}/recipes`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch recipes');
    const data = await res.json();
    return data.recipes || [];
  } catch (err) {
    console.warn('Using local recipes (backend unreachable):', err);
    return null;
  }
}

export async function fetchCompletedRecipes() {
  try {
    const res = await fetch(`${API_BASE_URL}/recipes/completed`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch completed recipes');
    const data = await res.json();
    console.log(" Completed Recipes", data.completed)
    return data.completed || [];
  } catch (err) {
    console.warn('Completed recipes fallback:', err);
    return [];
  }
}

export async function fetchSelectedRecipes() {
  try {
    const res = await fetch(`${API_BASE_URL}/recipes/selected`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch selected recipes');
    const data = await res.json();
    return data.selected || [];
  } catch (err) {
    console.warn('Selected recipes fallback:', err);
    return [];
  }
}


export async function cookRecipe(recipeId, title, imageUrl) {
  try {
    const res = await fetch(`${API_BASE_URL}/recipes/${recipeId}/cook`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, image_url: imageUrl }),
    });
    return await res.json();
  } catch (err) {
    console.warn('Cook recipe record error:', err);
    return null;
  }
}


// =========================================================================
// Custom Cups & Measuring Tools Endpoints
// =========================================================================
export async function fetchCustomCups() {
  try {
    const res = await fetch(`${API_BASE_URL}/cups`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch cups');
    const data = await res.json();
    return data.cups || [];
  } catch (err) {
    console.warn('Using local cups (backend unreachable):', err);
    return null;
  }
}

export async function createCustomCup({ name, volume_ml, height_cm, diameter_cm }) {
  try {
    const res = await fetch(`${API_BASE_URL}/cups`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, volume_ml, height_cm, diameter_cm }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to save cup' };
    }
    return { success: true, cup: data.cup };
  } catch (err) {
    console.warn('Cup save request error:', err);
    return { success: false, error: err.message || 'Network error while saving cup' };
  }
}

export async function deleteCustomCup(cupId) {
  try {
    const res = await fetch(`${API_BASE_URL}/cups/${cupId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch (err) {
    console.warn('Cup delete fallback:', err);
    return false;
  }
}

export async function convertMeasurements({ mode, text, cup }) {
  try {
    const res = await fetch(`${API_BASE_URL}/convert`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ mode, text, cup }),
    });
    if (!res.ok) throw new Error('Failed to convert measurements');
    const data = await res.json();
    return data.converted || '';
  } catch (err) {
    console.error('convertMeasurements error:', err);
    return null;
  }
}


// =========================================================================
// Shopping List Endpoints
// =========================================================================
export async function fetchShoppingItems() {
  try {
    const res = await fetch(`${API_BASE_URL}/shopping`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch shopping items');
    const data = await res.json();
    return data.items || [];
  } catch (err) {
    console.warn('Using local shopping items (backend unreachable):', err);
    return null;
  }
}

export async function createShoppingItem({ name, amount, category, source }) {
  try {
    const res = await fetch(`${API_BASE_URL}/shopping`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, amount, category, source }),
    });
    if (!res.ok) throw new Error('Failed to add shopping item');
    const data = await res.json();
    return data.item;
  } catch (err) {
    console.warn('Add shopping item fallback:', err);
    return null;
  }
}

export async function toggleShoppingItemStatus(itemId, completed) {
  try {
    const res = await fetch(`${API_BASE_URL}/shopping/${itemId}/toggle`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ completed }),
    });
    if (!res.ok) throw new Error('Failed to toggle shopping item');
    const data = await res.json();
    return data.item;
  } catch (err) {
    console.warn('Toggle shopping item fallback:', err);
    return null;
  }
}

export async function deleteShoppingItem(itemId) {
  try {
    const res = await fetch(`${API_BASE_URL}/shopping/${itemId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch (err) {
    console.warn('Delete shopping item fallback:', err);
    return false;
  }
}

export async function clearCompletedShopping() {
  try {
    const res = await fetch(`${API_BASE_URL}/shopping/clear-completed`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch (err) {
    console.warn('Clear completed shopping fallback:', err);
    return false;
  }
}

// =========================================================================
// AI Chat Endpoints (Chef Bon / Gemini)
// =========================================================================
export async function sendChatMessage({
  message,
  history = [],
  activeRecipe = null,
  healthGoal = null,
  savedCups = [],
}) {
  try {
    const res = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        message,
        history,
        active_recipe: activeRecipe,
        health_goal: healthGoal,
        saved_cups: savedCups,
      }),
    });

    if (!res.ok) {
      throw new Error(`Chat API error: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error('sendChatMessage error:', err);
    return {
      reply: "Chef Bon says: That apron looks great on you! My kitchen timer beeped for a second—ask me again and let's get cooking! 🍳",
      actions: [],
    };
  }
}


// =========================================================================
// Conversations Endpoints (conversations table)
// =========================================================================
export async function fetchConversation(recipeId = 'general') {
  try {
    const res = await fetch(`${API_BASE_URL}/conversations?recipe_id=${encodeURIComponent(recipeId || 'general')}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch conversation');
    const data = await res.json();
    return data.messages || [];
  } catch (err) {
    console.warn('fetchConversation fallback:', err);
    return null;
  }
}

export async function saveConversation({ recipeId = 'general', messages = [] }) {
  try {
    // Client-side pre-check: only store if user has actually said/typed something!
    const hasUserSpoken = (messages || []).some(
      (m) => (m.role === 'user' || m.sender === 'user') && (m.message || m.text || '').trim()
    );
    if (!hasUserSpoken) {
      return { success: true, saved_count: 0 };
    }

    const formattedMessages = messages.map((m) => ({
      role: (m.role === 'user' || m.sender === 'user') ? 'user' : 'chef',
      message: m.message || m.text || '',
    })).filter((m) => m.message.trim().length > 0);

    const res = await fetch(`${API_BASE_URL}/conversations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        recipe_id: recipeId || 'general',
        messages: formattedMessages,
      }),
    });
    if (!res.ok) throw new Error('Failed to save conversation');
    return await res.json();
  } catch (err) {
    console.warn('saveConversation error:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteConversation(recipeId = 'general') {
  try {
    const res = await fetch(`${API_BASE_URL}/conversations?recipe_id=${encodeURIComponent(recipeId || 'general')}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete conversation');
    return await res.json();
  } catch (err) {
    console.warn('deleteConversation error:', err);
    return { success: false, error: err.message };
  }
}

// =========================================================================
// Admin Management Endpoints
// =========================================================================
export async function fetchAdminStats() {
  const res = await fetch(`${API_BASE_URL}/admin/stats`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch admin stats');
  return data.stats;
}

export async function fetchAdminUsers() {
  const res = await fetch(`${API_BASE_URL}/admin/users`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
  return data.users || [];
}

export async function createAdminUser({ name, email, password, phone_number, isAdmin }) {
  const res = await fetch(`${API_BASE_URL}/admin/users`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, email, password, phone_number, isAdmin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create user');
  return data;
}

export async function updateAdminUser(userId, userData) {
  const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(userData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update user');
  return data;
}

export async function deleteAdminUser(userId) {
  const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete user');
  return data;
}

export async function createRecipe(recipeData) {
  const res = await fetch(`${API_BASE_URL}/recipes`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(recipeData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create recipe');
  return data;
}

export async function updateRecipe(recipeId, recipeData) {
  const res = await fetch(`${API_BASE_URL}/recipes/${recipeId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(recipeData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update recipe');
  return data;
}

export async function deleteRecipe(recipeId) {
  const res = await fetch(`${API_BASE_URL}/recipes/${recipeId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete recipe');
  return data;
}

