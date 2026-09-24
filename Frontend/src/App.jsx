import React, { useState, useEffect } from 'react';
import Landing from './pages/Landing.jsx';
import Chat from './pages/Chat.jsx';
import Recipes from './pages/Recipes.jsx';
import Measuring from './pages/Measuring.jsx';
import Shopping from './pages/Shopping.jsx';
import Admin from './pages/Admin.jsx';
import {
  getStoredToken,
  getStoredUser,
  clearAuthSession,
  fetchCurrentUser,
  fetchShoppingItems,
  createShoppingItem,
  toggleShoppingItemStatus,
  deleteShoppingItem,
  clearCompletedShopping,
  fetchCustomCups,
  fetchSelectedRecipes,
  cookRecipe,
} from './services/api.js';
import './index.css';

const INITIAL_CUSTOM_CUPS = [];
const INITIAL_SHOPPING_ITEMS = [];

function App() {
  const [user, setUser] = useState(getStoredUser());
  const [currentView, setCurrentView] = useState('landing');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [shoppingItems, setShoppingItems] = useState(INITIAL_SHOPPING_ITEMS);
  const [customCups, setCustomCups] = useState(INITIAL_CUSTOM_CUPS);

  const userKey = user?.email || user?.id || 'guest';

  // 1. Selected recipes list
  const [selectedRecipes, setSelectedRecipes] = useState([]);

  // 2. Chat history mapped by recipe ID (or 'general')
  const [recipeChats, setRecipeChats] = useState({});

  // 1. Verify JWT token with backend on initial load
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      fetchCurrentUser().then((verifiedUser) => {
        if (verifiedUser) {
          setUser(verifiedUser);
        } else {
          setUser(null);
          setCurrentView('landing');
        }
      });
    }
  }, []);

  // 2. Fetch shopping list items from backend API
  useEffect(() => {
    fetchShoppingItems().then((items) => {
      if (items !== null && Array.isArray(items)) {
        // Normalize fields if backend uses snake_case
        const normalized = items.map((i) => ({
          ...i,
          addedAt: i.added_at || i.created_at || 'Recently',
        }));
        setShoppingItems(normalized);
      }
    });
  }, [user]);

  const dedupeCups = (cups = []) => {
    const seenIds = new Set();
    const seenNames = new Set();
    return cups.filter((cup) => {
      if (!cup) return false;
      const id = String(cup.id || '');
      const name = String(cup.name || '').trim().toLowerCase();
      if (id && seenIds.has(id)) return false;
      if (name && seenNames.has(name)) return false;
      if (id) seenIds.add(id);
      if (name) seenNames.add(name);
      return true;
    });
  };

  useEffect(() => {
    fetchCustomCups().then((cups) => {
      if (cups !== null && Array.isArray(cups)) {
        setCustomCups(dedupeCups(cups));
      }
    });
  }, [user]);

  // 4. Sync selected recipes from API (cooking sessions stored in user_recipes)
  useEffect(() => {
    fetchSelectedRecipes().then((selectedList) => {
      if (Array.isArray(selectedList)) {
        setSelectedRecipes(selectedList);
      }
    });
  }, [user]);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    setCurrentView('chat');
  };

  const handleLogout = () => {
    clearAuthSession();
    setUser(null);
    setSelectedRecipes([]);
    setRecipeChats({});
    setCurrentView('landing');
  };

  const handleNavigateToChat = () => {
    if (user || getStoredToken()) {
      setCurrentView('chat');
    } else {
      setCurrentView('landing');
    }
  };

  const [isNewChatMode, setIsNewChatMode] = useState(false);
  const [chatSessionId, setChatSessionId] = useState(() => Date.now());

  const handleTabChange = (tabId) => {
    const validViews = ['chat', 'recipes', 'measuring', 'shopping', 'admin'];
    if (validViews.includes(tabId)) {
      if (tabId !== 'chat') {
        setIsNewChatMode(false);
      }
      setCurrentView(tabId);
    }
  };

  const handleSelectRecipe = (recipe, { isNewChat = false } = {}) => {
    if (recipe) {
      setSelectedRecipe(recipe);
      setIsNewChatMode(Boolean(isNewChat));
      if (isNewChat) {
        setChatSessionId(Date.now());
        setRecipeChats((prev) => ({ ...prev, [recipe.id]: [] }));
      }
    } else {
      setSelectedRecipe(null);
      setIsNewChatMode(Boolean(isNewChat));
      if (isNewChat) {
        setChatSessionId(Date.now());
        setRecipeChats((prev) => ({ ...prev, general: [] }));
      }
    }
    setCurrentView('chat');
  };

  const handleSaveRecipeChat = (recipeId, messages) => {
    const key = recipeId || 'general';
    setRecipeChats((prev) => ({ ...prev, [key]: messages }));

    // When a conversation for a recipe is saved, ensure it is added to selectedRecipes
    if (recipeId && recipeId !== 'general' && selectedRecipe && selectedRecipe.id === recipeId) {
      setSelectedRecipes((prev) => {
        const withoutCurrent = prev.filter((r) => r.id !== recipeId);
        const updated = [selectedRecipe, ...withoutCurrent];
        try {
          localStorage.setItem(
            `cooking_buddy_selected_recipes_${user?.email || user?.id || 'guest'}`,
            JSON.stringify(updated)
          );
        } catch (_) {}
        return updated;
      });
    }
  };

  // Shopping list CRUD actions connected to backend
  const handleToggleShoppingItem = async (id) => {
    const currentItem = shoppingItems.find((i) => i.id === id);
    const newCompleted = currentItem ? !currentItem.completed : true;

    // Optimistic UI update
    setShoppingItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: newCompleted } : item
      )
    );

    // Call backend API
    await toggleShoppingItemStatus(id, newCompleted);
  };

  const handleAddShoppingItem = async (newItem) => {
    // Call backend API
    const created = await createShoppingItem(newItem);
    const itemToStore = created
      ? { ...created, addedAt: created.added_at || 'Just now' }
      : { ...newItem, id: newItem.id || `shop-${Date.now()}`, addedAt: 'Just now' };

    setShoppingItems((prev) => [itemToStore, ...prev]);
  };

  const handleDeleteShoppingItem = async (id) => {
    // Optimistic delete
    setShoppingItems((prev) => prev.filter((item) => item.id !== id));
    // Call backend API
    await deleteShoppingItem(id);
  };

  const handleClearCompletedShopping = async () => {
    // Optimistic clear
    setShoppingItems((prev) => prev.filter((item) => !item.completed));
    // Call backend API
    await clearCompletedShopping();
  };

  const handleAddCup = (newCup) => {
    if (!newCup) return;
    setCustomCups((prev) => {
      const exists = prev.some(
        (c) =>
          String(c.id) === String(newCup.id) ||
          c.name.trim().toLowerCase() === newCup.name.trim().toLowerCase()
      );
      if (exists) {
        return prev.map((c) =>
          String(c.id) === String(newCup.id) ||
          c.name.trim().toLowerCase() === newCup.name.trim().toLowerCase()
            ? newCup
            : c
        );
      }
      return dedupeCups([...prev, newCup]);
    });
  };

  const handleDeleteCup = (cupId) => {
    setCustomCups((prev) => prev.filter((c) => String(c.id) !== String(cupId)));
  };

  return (
    <div className="min-h-screen w-full relative font-sans">
      {currentView === 'landing' && (
        <Landing
          user={user}
          onLoginSuccess={handleLoginSuccess}
          onLogout={handleLogout}
          onNavigateToChat={handleNavigateToChat}
        />
      )}

      {currentView === 'chat' && (
        <Chat
          key={`${selectedRecipe?.id || 'general'}-${isNewChatMode ? `new-${chatSessionId}` : 'saved'}`}
          user={user}
          activeRecipe={selectedRecipe}
          isNewChatMode={isNewChatMode}
          onSelectRecipe={handleSelectRecipe}
          onStartNewChat={() => handleSelectRecipe(selectedRecipe, { isNewChat: true })}
          savedChatMessages={isNewChatMode ? [] : recipeChats[selectedRecipe?.id || 'general']}
          onSaveChatMessages={(msgs) => handleSaveRecipeChat(selectedRecipe?.id, msgs)}
          shoppingItems={shoppingItems}
          savedCups={customCups}
          onAddShoppingItem={handleAddShoppingItem}
          onAddCup={handleAddCup}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          onBackToHome={() => {
            setIsNewChatMode(false);
            setCurrentView('landing');
          }}
        />
      )}

      {currentView === 'recipes' && (
        <Recipes
          user={user}
          selectedRecipesList={selectedRecipes}
          onSelectRecipe={handleSelectRecipe}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          onBackToHome={() => setCurrentView('landing')}
        />
      )}

      {currentView === 'measuring' && (
        <Measuring
          user={user}
          customCups={customCups}
          onAddCup={handleAddCup}
          onDeleteCup={handleDeleteCup}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          onBackToHome={() => setCurrentView('landing')}
        />
      )}

      {currentView === 'shopping' && (
        <Shopping
          user={user}
          items={shoppingItems}
          onToggleItem={handleToggleShoppingItem}
          onAddItem={handleAddShoppingItem}
          onDeleteItem={handleDeleteShoppingItem}
          onClearCompleted={handleClearCompletedShopping}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          onBackToHome={() => setCurrentView('landing')}
        />
      )}

      {currentView === 'admin' && (
        <Admin
          user={user}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          onBackToHome={() => setCurrentView('landing')}
        />
      )}
    </div>
  );
}

export default App;
