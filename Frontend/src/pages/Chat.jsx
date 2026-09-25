import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import RightWidgets from '../components/RightWidgets.jsx';
import { sendChatMessage, fetchRecipes, fetchConversation, saveConversation } from '../services/api.js';
import { AudioStreamer } from '../services/audioStreamer.js';

import chefImg from '../assets/chef.png';
import pastaImg from '../assets/pasta.jpg';

export default function Chat({
  user,
  activeRecipe = null,
  isNewChatMode = false,
  onSelectRecipe,
  onStartNewChat,
  savedChatMessages = null,
  onSaveChatMessages,
  shoppingItems = [],
  savedCups = [],
  onAddShoppingItem,
  onAddCup,
  onTabChange,
  onLogout,
  onBackToHome,
}) {
  const [selectedRecipe, setSelectedRecipe] = useState(activeRecipe);
  const [dbRecipes, setDbRecipes] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLiveVoiceActive, setIsLiveVoiceActive] = useState(false);
  const [isConnectingVoice, setIsConnectingVoice] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(0);
  const [isChefThinking, setIsChefThinking] = useState(false);
  const messagesEndRef = useRef(null);

  const audioStreamerRef = useRef(null);
  const voiceWsRef = useRef(null);
  const currentLiveUserMsgIdRef = useRef(null);
  const currentLiveChefMsgIdRef = useRef(null);
  const hasUserInteractedRef = useRef(false);
  const currentSessionIdRef = useRef(Date.now());
  const isLiveVoiceActiveRef = useRef(false);

  // Fetch stored recipes from database on mount
  useEffect(() => {
    fetchRecipes().then((recipes) => {
      if (recipes && recipes.length > 0) {
        const formatted = recipes.map((r) => ({
          ...r,
          image: r.image_url || r.image || pastaImg,
        }));
        setDbRecipes(formatted);
      }
    });
  }, []);

  // Initial recipe welcome generator
  const getInitialRecipeMessages = (recipe) => {
    if (recipe) {
      return [
        {
          id: Date.now(),
          sender: 'chef',
          text: `Great choice! 🧑‍🍳 I've loaded "${recipe.title}" into your Recipe box. Do you have all the ingredients, or should we check your pantry?`,
        },
      ];
    }
    return [
      {
        id: 1,
        sender: 'chef',
        text: `Hey ${user?.name || 'Chef'}, that apron isn't going to dirty itself 🍳 — wanna cook something amazing with me today?`,
      },
      {
        id: 2,
        sender: 'chef',
        text: "Pick a dish from the Recipes catalog to cook step-by-step, or ask me any culinary question!",
      },
    ];
  };

  const [messages, setMessages] = useState(() => {
    if (!isNewChatMode && savedChatMessages && savedChatMessages.length > 0) {
      return savedChatMessages;
    }
    return getInitialRecipeMessages(activeRecipe);
  });

  // Sync when activeRecipe or newChatMode changes, loading from conversations table as single source of truth
  useEffect(() => {
    setSelectedRecipe(activeRecipe);
    let isCancelled = false;
    const thisSessionId = Date.now();
    currentSessionIdRef.current = thisSessionId;
    const recipeKey = activeRecipe?.id || 'general';

    // Disconnect any lingering voice session so a new chat starts completely fresh
    if (voiceWsRef.current) {
      try {
        voiceWsRef.current.close();
      } catch (_) {}
      voiceWsRef.current = null;
      setIsLiveVoiceActive(false);
      setIsConnectingVoice(false);
      setIsChefThinking(false);
    }
    audioStreamerRef.current?.stopPlayback();

    // When starting a NEW CHAT, initialize fresh greeting and NEVER load past messages
    if (isNewChatMode) {
      setIsLoadingConversation(false);
      hasUserInteractedRef.current = false;
      setMessages(getInitialRecipeMessages(activeRecipe));
      if (onSaveChatMessages) onSaveChatMessages([]);
      return;
    }

    // If continuing an active session that already has messages in memory
    if (savedChatMessages && savedChatMessages.length > 0) {
      setIsLoadingConversation(false);
      hasUserInteractedRef.current = false;
      setMessages(savedChatMessages);
      return;
    }

    // Fetch conversation from database for continuing chat
    setIsLoadingConversation(true);
    fetchConversation(recipeKey)
      .then((dbMsgs) => {
        if (isCancelled || currentSessionIdRef.current !== thisSessionId) return;
        setIsLoadingConversation(false);

        // CRITICAL GUARD: If user has ALREADY entered a prompt in this session, DO NOT overwrite!
        if (hasUserInteractedRef.current) return;

        if (dbMsgs && Array.isArray(dbMsgs) && dbMsgs.length > 0) {
          const formatted = dbMsgs.map((m) => ({
            id: m.id || `msg-${Date.now()}-${Math.random()}`,
            sender: (m.role === 'user' || m.sender === 'user') ? 'user' : 'chef',
            text: m.message || m.text || '',
          }));
          setMessages(formatted);
        } else {
          // Database is empty -> show fresh initial greeting
          setMessages(getInitialRecipeMessages(activeRecipe));
          if (onSaveChatMessages) onSaveChatMessages([]);
        }
      })
      .catch((err) => {
        console.warn('fetchConversation error:', err);
        if (!isCancelled && currentSessionIdRef.current === thisSessionId) {
          setIsLoadingConversation(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeRecipe?.id, isNewChatMode]);

  // Persist messages whenever chat updates, ONLY when user has actually started saying/typing something
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    // RULE 1: Only store if the user has actually interacted/sent/spoken during this session
    if (!hasUserInteractedRef.current) return;

    // RULE 2: Must contain at least one user message
    const hasUserSaidSomething = messages.some(
      (m) => m.sender === 'user' && m.text && m.text.trim().length > 0
    );
    if (!hasUserSaidSomething) return;

    if (onSaveChatMessages) {
      onSaveChatMessages(messages);
    }

    // Debounced save to Supabase conversations table
    const timeoutId = setTimeout(() => {
      const recipeKey = selectedRecipe?.id || activeRecipe?.id || 'general';
      saveConversation({
        recipeId: recipeKey,
        messages: messages.map((m) => ({
          role: m.sender === 'user' ? 'user' : 'chef',
          message: m.text,
        })),
      })
        .then(() => {
          // Persisted successfully to Supabase conversations table
        })
        .catch((err) => console.warn('Failed to save conversation:', err));
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [messages, selectedRecipe?.id, activeRecipe?.id]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChefThinking]);

  // Clean up Live Voice session on recipe change or unmount
  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, [activeRecipe?.id]);

  // Start a fresh new chat (clean session, no previous messages loaded)
  const handleStartNewChat = () => {
    stopLiveSession();
    currentSessionIdRef.current = Date.now();
    hasUserInteractedRef.current = false;
    setIsLoadingConversation(false);
    setMessages(getInitialRecipeMessages(selectedRecipe));
    if (onStartNewChat) {
      onStartNewChat();
    } else if (onSelectRecipe) {
      onSelectRecipe(selectedRecipe, { isNewChat: true });
    }
  };

  // Select a recipe to load into Recipe box as a clean new chat
  const handleLoadRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    if (onSelectRecipe) {
      onSelectRecipe(recipe, { isNewChat: true });
    } else {
      currentSessionIdRef.current = Date.now();
      hasUserInteractedRef.current = false;
      setIsLoadingConversation(false);
      setMessages(getInitialRecipeMessages(recipe));
    }
  };

  // Clear recipe and switch to clean general chat
  const handleClearRecipe = () => {
    setSelectedRecipe(null);
    if (onSelectRecipe) {
      onSelectRecipe(null, { isNewChat: true });
    } else {
      currentSessionIdRef.current = Date.now();
      hasUserInteractedRef.current = false;
      setIsLoadingConversation(false);
      setMessages(getInitialRecipeMessages(null));
    }
  };

  // -------------------------------------------------------------
  // Gemini Live Session Management (Shared by Text & Voice)
  // -------------------------------------------------------------
  const stopLiveSession = () => {
    isLiveVoiceActiveRef.current = false;
    if (audioStreamerRef.current) {
      audioStreamerRef.current.close();
      audioStreamerRef.current = null;
    }
    if (voiceWsRef.current) {
      try {
        voiceWsRef.current.close();
      } catch (_) {}
      voiceWsRef.current = null;
    }
    setIsLiveVoiceActive(false);
    setIsConnectingVoice(false);
    setIsChefThinking(false);
    setVoiceVolume(0);
    currentLiveUserMsgIdRef.current = null;
    currentLiveChefMsgIdRef.current = null;
  };

  const handleLiveTranscription = (role, text) => {
    if (!text) return;

    if (role === 'user') {
      hasUserInteractedRef.current = true;
      setMessages((prev) => {
        const currentId = currentLiveUserMsgIdRef.current;
        if (currentId && prev.some((m) => m.id === currentId)) {
          return prev.map((m) =>
            m.id === currentId ? { ...m, text: m.text + text } : m
          );
        } else {
          const newId = Date.now();
          currentLiveUserMsgIdRef.current = newId;
          return [...prev, { id: newId, sender: 'user', text }];
        }
      });
    } else if (role === 'model') {
      setIsChefThinking(false);
      setMessages((prev) => {
        const currentId = currentLiveChefMsgIdRef.current;
        if (currentId && prev.some((m) => m.id === currentId)) {
          return prev.map((m) =>
            m.id === currentId ? { ...m, text: m.text + text } : m
          );
        } else {
          const newId = Date.now() + 1;
          currentLiveChefMsgIdRef.current = newId;
          return [...prev, { id: newId, sender: 'chef', text }];
        }
      });
    }
  };

  const handleLiveToolExecuted = (data) => {
    if (data.tool === 'add_to_shopping_list' && data.item) {
      if (onAddShoppingItem) onAddShoppingItem(data.item);
      setMessages((prev) => {
        const currentId = currentLiveChefMsgIdRef.current;
        if (currentId && prev.some((m) => m.id === currentId)) {
          return prev.map((m) =>
            m.id === currentId ? { ...m, shoppingItemAdded: data.item } : m
          );
        }
        return [
          ...prev,
          {
            id: Date.now(),
            sender: 'chef',
            text: `Added ${data.item.amount || '1 unit'} of ${data.item.name} to your shopping list!`,
            shoppingItemAdded: data.item,
          },
        ];
      });
    } else if (data.tool === 'save_custom_cup' && data.cup) {
      if (onAddCup) onAddCup(data.cup);
      setMessages((prev) => {
        const currentId = currentLiveChefMsgIdRef.current;
        if (currentId && prev.some((m) => m.id === currentId)) {
          return prev.map((m) =>
            m.id === currentId ? { ...m, cupSaved: data.cup } : m
          );
        }
        return [
          ...prev,
          {
            id: Date.now(),
            sender: 'chef',
            text: `Saved your custom measuring cup "${data.cup.name}" (${data.cup.volume_ml} ml) into your kitchen tools!`,
            cupSaved: data.cup,
          },
        ];
      });
    }
  };

  const ensureLiveSession = () => {
    return new Promise((resolve, reject) => {
      // Re-use active WebSocket if already connected
      if (voiceWsRef.current && voiceWsRef.current.readyState === WebSocket.OPEN) {
        resolve(voiceWsRef.current);
        return;
      }

      // If connecting, wait for it to open
      if (voiceWsRef.current && voiceWsRef.current.readyState === WebSocket.CONNECTING) {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (voiceWsRef.current?.readyState === WebSocket.OPEN) {
            clearInterval(interval);
            resolve(voiceWsRef.current);
          } else if (!voiceWsRef.current || voiceWsRef.current.readyState === WebSocket.CLOSED || attempts > 60) {
            clearInterval(interval);
            reject(new Error('WebSocket connection timed out'));
          }
        }, 50);
        return;
      }

      // Initialize audio streamer for playback
      if (!audioStreamerRef.current) {
        audioStreamerRef.current = new AudioStreamer();
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.hostname || '127.0.0.1';
      const wsUrl = `${wsProtocol}//${wsHost}:5001`;

      const ws = new WebSocket(wsUrl);
      voiceWsRef.current = ws;

      ws.onopen = () => {
        console.log('[Live] WebSocket connected to Chef Bon Gemini Live bridge');
        ws.send(
          JSON.stringify({
            type: 'setup',
            userId: user?.id || user?.email || 'default_user',
            userName: user?.name || 'Chef',
            activeRecipe: selectedRecipe,
            healthGoal: 'Balanced & High Protein (~1,900 kcal)',
            savedCups: savedCups,
            history: isNewChatMode ? [] : messages,
          })
        );
        resolve(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ready') {
            console.log('[Live] Gemini Live session ready:', data.model, data.reconnected ? '(reconnected)' : '');
            setIsConnectingVoice(false);
            setIsChefThinking(false);
          } else if (data.type === 'interrupted') {
            audioStreamerRef.current?.stopPlayback();
            currentLiveChefMsgIdRef.current = null;
          } else if (data.type === 'audio') {
            audioStreamerRef.current?.playPcmChunk(data.data);
          } else if (data.type === 'transcription') {
            handleLiveTranscription(data.role, data.text);
          } else if (data.type === 'turn_complete') {
            setIsChefThinking(false);
            currentLiveUserMsgIdRef.current = null;
            currentLiveChefMsgIdRef.current = null;
          } else if (data.type === 'tool_executed') {
            handleLiveToolExecuted(data);
          }
        } catch (err) {
          console.error('[Live] Message parse error:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[Live] WebSocket error:', err);
        setIsChefThinking(false);
      };

      ws.onclose = () => {
        console.log('[Live] WebSocket closed');
        voiceWsRef.current = null;
        setIsChefThinking(false);

        // If the session was actively running and dropped, auto-reconnect
        if (isLiveVoiceActiveRef.current) {
          console.log('[Live] Voice connection closed unexpectedly. Auto-reconnecting in 1s...');
          setIsConnectingVoice(true);
          setTimeout(() => {
            if (isLiveVoiceActiveRef.current) {
              ensureLiveSession()
                .then(() => {
                  setIsConnectingVoice(false);
                  setIsLiveVoiceActive(true);
                })
                .catch((err) => {
                  console.error('[Live] Auto-reconnect failed:', err);
                  isLiveVoiceActiveRef.current = false;
                  stopLiveSession();
                });
            }
          }, 1000);
        } else {
          stopLiveSession();
        }
      };
    });
  };

  // Send a new message to Gemini Live API
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputMessage.trim() || isChefThinking || isLoadingConversation) return;

    hasUserInteractedRef.current = true;
    const userText = inputMessage.trim();
    setInputMessage('');

    // Stop any existing spoken audio so Chef Bon focuses on new question
    audioStreamerRef.current?.stopPlayback();

    // Append user message bubble
    const userMsgObj = { id: Date.now(), sender: 'user', text: userText };
    setMessages((prev) => [...prev, userMsgObj]);
    setIsChefThinking(true);

    // Reset current message IDs so that Chef Bon's reply streams into a new bubble
    currentLiveUserMsgIdRef.current = null;
    currentLiveChefMsgIdRef.current = null;

    try {
      const ws = await ensureLiveSession();
      ws.send(JSON.stringify({ type: 'text', text: userText }));
    } catch (err) {
      console.warn('[Live] Live WebSocket failed, falling back to HTTP:', err);
      try {
        const response = await sendChatMessage({
          message: userText,
          history: [...messages, userMsgObj],
          activeRecipe: selectedRecipe,
          healthGoal: 'Balanced & High Protein (~1,900 kcal)',
          savedCups: savedCups,
        });

        setIsChefThinking(false);

        let shoppingItemAdded = null;
        let cupSaved = null;

        if (response.actions && response.actions.length > 0) {
          response.actions.forEach((act) => {
            if (act.type === 'shopping_added') {
              shoppingItemAdded = act.item;
              if (onAddShoppingItem) onAddShoppingItem(act.item);
            } else if (act.type === 'cup_saved' && act.cup) {
              cupSaved = act.cup;
              if (onAddCup) onAddCup(act.cup);
            }
          });
        }

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'chef',
            text: response.reply,
            shoppingItemAdded,
            cupSaved,
          },
        ]);
      } catch (fallbackErr) {
        console.error('Chat error:', fallbackErr);
        setIsChefThinking(false);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'chef',
            text: "Chef Bon: My wooden spoon slipped! Ask me that one more time and let's keep cooking. 🍳",
          },
        ]);
      }
    }
  };

  const startLiveVoice = async () => {
    try {
      setIsConnectingVoice(true);
      isLiveVoiceActiveRef.current = true;
      const ws = await ensureLiveSession();

      if (!audioStreamerRef.current) {
        audioStreamerRef.current = new AudioStreamer();
      }

      await audioStreamerRef.current.startRecording({
        onAudioData: (base64Chunk) => {
          if (voiceWsRef.current && voiceWsRef.current.readyState === WebSocket.OPEN) {
            voiceWsRef.current.send(JSON.stringify({ type: 'audio', data: base64Chunk }));
          }
        },
        onVolumeChange: (vol) => {
          setVoiceVolume(vol);
        },
      });

      setIsConnectingVoice(false);
      setIsLiveVoiceActive(true);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: 'chef',
          text: "🎙️ I'm listening! Speak to me naturally about recipes, ingredients, measurements, or your shopping list.",
        },
      ]);
    } catch (err) {
      console.error('[Live Voice] Mic error:', err);
      isLiveVoiceActiveRef.current = false;
      stopLiveSession();
      alert('Could not access microphone. Please check your browser microphone permissions.');
    }
  };

  const handleToggleMic = () => {
    if (isLiveVoiceActive || isConnectingVoice) {
      isLiveVoiceActiveRef.current = false;
      stopLiveSession();
    } else {
      isLiveVoiceActiveRef.current = true;
      startLiveVoice();
    }
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  return (
    <div className="flex h-screen bg-[#FAF7F0] text-gray-900 font-sans overflow-hidden">
      {/* 1. Leftmost Navigation Icon Sidebar */}
      <Sidebar
        activeTab="chat"
        onTabChange={onTabChange}
        onLogout={onLogout}
        onBackToHome={onBackToHome}
        user={user}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="w-full bg-white/80 backdrop-blur-xs h-14 border-b border-stone-200/60 flex items-center justify-between px-6 lg:px-8 shrink-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <span className="text-base">🧑‍🍳</span>
              <span>Chef Bon Kitchen</span>
            </span>
            {selectedRecipe && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-brand-red border border-rose-200/70 rounded-full text-xs font-bold">
                <span>📖</span>
                <span className="truncate max-w-50">{selectedRecipe.title}</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleStartNewChat}
              className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-rose-50 text-brand-red border border-stone-200 hover:border-rose-300 rounded-full text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Start a fresh conversation"
            >
              <span>✨</span>
              <span>New Chat</span>
            </button>
          </div>

          {/* User Profile, Live Voice Status and Logout */}
          <div className="flex items-center gap-3">
            {/* Live Voice Indicator in Header */}
            {isLiveVoiceActive && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200 rounded-full text-xs font-bold text-red-700 shadow-2xs animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                <span>Live Voice Active</span>
                <div className="flex items-end gap-0.5 h-3">
                  <span
                    className="w-0.5 bg-red-600 rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(4, Math.min(12, voiceVolume * 18))}px` }}
                  ></span>
                  <span
                    className="w-0.5 bg-red-600 rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(6, Math.min(14, voiceVolume * 24))}px` }}
                  ></span>
                  <span
                    className="w-0.5 bg-red-600 rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(3, Math.min(10, voiceVolume * 14))}px` }}
                  ></span>
                </div>
              </div>
            )}

            {isConnectingVoice && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-amber-700 shadow-2xs animate-pulse">
                <span className="animate-spin text-xs">⏳</span>
                <span>Connecting Voice...</span>
              </div>
            )}

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

        {/* Content Body 3-Column Layout */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Column 1: Left Secondary Panel (Recipe Box & Health Goal) */}
          <section className="w-80 md:w-88 shrink-0 bg-white border-r border-stone-200/70 flex flex-col overflow-y-auto p-5 select-none space-y-6">
            {/* 1. Recipe Box Card */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 font-black text-gray-950 text-base">
                  <span className="text-brand-red">📕</span>
                  <span>Recipe box</span>
                </div>
                {selectedRecipe && (
                  <button
                    type="button"
                    onClick={handleClearRecipe}
                    className="text-xs text-brand-red hover:underline font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {!selectedRecipe ? (
                /* Empty state */
                <div className="bg-stone-50 border border-dashed border-stone-300 rounded-2xl p-5 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-rose-50 text-brand-red flex items-center justify-center mx-auto text-xl font-bold">
                    🍳
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">No recipe loaded</h4>
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                      Pick a dish from the recipe catalog to cook step-by-step with Chef Bon!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onTabChange?.('recipes')}
                    className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Browse Recipes Catalog →
                  </button>
                </div>
              ) : (
                /* Loaded recipe state */
                <div className="bg-white rounded-2xl border border-stone-200/80 p-3.5 shadow-xs space-y-4">
                  <div className="w-full h-40 rounded-xl overflow-hidden shadow-xs bg-stone-100">
                    <img
                      src={selectedRecipe.image || selectedRecipe.image_url || pastaImg}
                      alt={selectedRecipe.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div>
                    <h3 className="text-base font-black text-gray-950 leading-tight">
                      {selectedRecipe.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="px-2.5 py-0.5 bg-stone-100 text-stone-700 text-[11px] font-bold rounded-full">
                        ⏱️ {selectedRecipe.time}
                      </span>
                      <span className="px-2.5 py-0.5 bg-stone-100 text-stone-700 text-[11px] font-bold rounded-full">
                        🍽️ {selectedRecipe.servings}
                      </span>
                      <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 text-[11px] font-bold rounded-full">
                        🔥 {selectedRecipe.kcal}
                      </span>
                    </div>
                  </div>

                  {/* Ingredients Section */}
                  <div className="pt-2 border-t border-stone-100">
                    <h4 className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase mb-2">
                      INGREDIENTS
                    </h4>
                    <ul className="space-y-1.5 text-xs text-gray-700">
                      {selectedRecipe.ingredients?.map((ing, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-brand-red font-bold text-sm leading-none">•</span>
                          <span>{ing}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Steps Section */}
                  <div className="pt-3 border-t border-stone-100">
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase">
                        STEPS
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full">
                        {selectedRecipe.steps?.length || 0} steps
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {selectedRecipe.steps?.map((step, idx) => {
                        const stepId = typeof step === 'object' && step?.id ? step.id : idx + 1;
                        const stepText = typeof step === 'string' ? step : step?.text || '';
                        const stepNum = idx + 1;

                        return (
                          <div
                            key={stepId}
                            className="group relative p-3 rounded-2xl bg-stone-50/80 border border-stone-200/80 hover:bg-white hover:border-brand-red/30 hover:shadow-xs transition-all duration-200"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="inline-flex items-center justify-center text-[10px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-linear-to-r from-stone-900 to-stone-800 text-white group-hover:from-brand-red group-hover:to-rose-600 transition-all duration-300 shadow-2xs">
                                Step {stepNum}
                              </span>
                              <span className="text-[11px] font-black text-stone-300 font-mono group-hover:text-brand-red/40 transition-colors">
                                {String(stepNum).padStart(2, '0')}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed font-medium text-stone-700">
                              {stepText}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Recipe Suggestions (from database recipes) */}
            {!selectedRecipe && dbRecipes.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-black tracking-wider text-stone-400 uppercase">
                  Featured picks
                </h4>
                <div className="space-y-2.5">
                  {dbRecipes.slice(0, 3).map((recipe) => (
                    <div
                      key={recipe.id}
                      onClick={() => handleLoadRecipe(recipe)}
                      className="flex items-center gap-3 p-2.5 rounded-2xl border border-stone-200/80 bg-white hover:border-brand-red/50 hover:shadow-xs transition cursor-pointer"
                    >
                      <img
                        src={recipe.image || recipe.image_url || pastaImg}
                        alt={recipe.title}
                        className="w-12 h-12 rounded-xl object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-900 truncate">{recipe.title}</p>
                        <p className="text-[10px] text-gray-400">{recipe.time} • {recipe.kcal}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Health Goal Card
            <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-200/80 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-emerald-950 text-xs">
                  <span>💚</span>
                  <span>Health & Nutrition Goal</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-200/70 text-emerald-900 text-[10px] font-bold rounded-full">
                  Active
                </span>
              </div>

              <p className="text-xs text-emerald-900 font-medium leading-relaxed">
                Daily Budget: <span className="font-extrabold text-emerald-950">~1,900 kcal</span>
              </p>

              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="px-2 py-0.5 bg-white text-emerald-800 text-[10px] font-bold rounded-md border border-emerald-200">
                  High Protein
                </span>
                <span className="px-2 py-0.5 bg-white text-emerald-800 text-[10px] font-bold rounded-md border border-emerald-200">
                  Low Sodium
                </span>
              </div>

              <p className="text-[10px] text-emerald-800/80 leading-normal pt-1">
                Chef Bon automatically factors this into ingredient portion suggestions.
              </p>
            </div> */}
          </section>

          {/* Column 2: Center Chef Bon Chat Area */}
          <main className="flex-1 flex flex-col min-w-0 bg-[#FAF7F0] relative">
            {/* Scrollable Messages Stream */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Chef Bon Header Avatar Badge */}
              <div className="flex flex-col items-center justify-center pt-2 pb-2">
                <div className="relative w-22 h-22 rounded-full bg-rose-50 border-2 border-rose-200/80 flex items-center justify-center overflow-hidden shadow-xs hover:scale-105 transition-transform">
                  <img src={chefImg} alt="Chef Bon" className="w-full h-full object-cover" />
                  {isLiveVoiceActive && (
                    <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-ping"></span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-3 py-0.5 bg-rose-100 text-brand-red text-xs font-black rounded-full tracking-wide">
                    Chef Bon · AI Sous Chef
                  </span>
                  {isLiveVoiceActive && (
                    <span className="px-2.5 py-0.5 bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center gap-1 shadow-xs animate-pulse">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                      <span>Live Voice</span>
                    </span>
                  )}
                  {isConnectingVoice && (
                    <span className="px-2.5 py-0.5 bg-amber-500 text-white text-[10px] font-extrabold rounded-full shadow-xs animate-pulse">
                      Connecting...
                    </span>
                  )}
                </div>
              </div>

              {/* Messages list */}
              <div className="max-w-2xl mx-auto space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-lg px-5 py-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                        msg.sender === 'user'
                          ? 'bg-brand-red text-white rounded-br-none font-medium'
                          : 'bg-white text-gray-800 rounded-bl-none border border-stone-200/70 font-normal'
                      }`}
                    >
                      <div className="whitespace-pre-line">{msg.text}</div>

                      {/* Tool Action Badge: Shopping Item Added */}
                      {msg.shoppingItemAdded && (
                        <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                          <span>🛒</span>
                          <span>
                            Added <strong>{msg.shoppingItemAdded.name}</strong> ({msg.shoppingItemAdded.amount}) to shopping list!
                          </span>
                        </div>
                      )}

                      {/* Tool Action Badge: Custom Cup Saved */}
                      {msg.cupSaved && (
                        <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold">
                          <span>☕</span>
                          <span>
                            Saved <strong>{msg.cupSaved.name}</strong> ({msg.cupSaved.volume_ml} ml) to measuring tools!
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Chef Bon Thinking Indicator */}
                {isChefThinking && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-stone-200/70 text-gray-600 text-xs px-4 py-2.5 rounded-2xl rounded-bl-none flex items-center gap-2 shadow-2xs">
                      <span className="animate-spin text-sm">🍳</span>
                      <span className="font-medium text-stone-500">Chef Bon is thinking...</span>
                    </div>
                  </div>
                )}

                {/* Conversation Loading Indicator */}
                {isLoadingConversation && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-stone-200/70 text-gray-600 text-xs px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-2.5 shadow-2xs">
                      <span className="animate-spin text-sm">🍳</span>
                      <span className="font-medium text-stone-600">Loading your conversation with Chef Bon...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Bottom Interactive Message Bar */}
            <div className="p-4 sm:p-6 bg-transparent">
              <form
                onSubmit={handleSendMessage}
                className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-full px-4 py-2 flex items-center gap-2 shadow-sm focus-within:ring-2 focus-within:ring-brand-red/30 transition"
              >

                {/* Input Text Field */}
                <input
                  type="text"
                  disabled={isLoadingConversation}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={
                    isLoadingConversation
                      ? "Loading your conversation with Chef Bon..."
                      : "Ask Chef Bon for a recipe, ingredients, or a shopping list…"
                  }
                  className="flex-1 bg-transparent text-xs sm:text-sm text-gray-900 outline-hidden font-medium px-1 disabled:opacity-50"
                />

                {/* Microphone Button */}
                <button
                  type="button"
                  onClick={handleToggleMic}
                  title={
                    isLiveVoiceActive
                      ? "Stop Live Voice"
                      : isConnectingVoice
                      ? "Connecting to Chef Bon..."
                      : "Start Live Voice with Chef Bon"
                  }
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer shrink-0 ${
                    isLiveVoiceActive
                      ? 'bg-red-500 text-white ring-4 ring-red-200 shadow-md animate-pulse'
                      : isConnectingVoice
                      ? 'bg-amber-100 text-amber-700 animate-pulse'
                      : 'text-stone-400 hover:text-brand-red hover:bg-stone-100'
                  }`}
                >
                  {isConnectingVoice ? (
                    <span className="animate-spin text-xs">⏳</span>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>

                {/* Send Red Button */}
                <button
                  type="submit"
                  title="Send message"
                  className="w-9 h-9 rounded-full bg-brand-red hover:bg-brand-red-hover text-white flex items-center justify-center transition shadow-xs cursor-pointer shrink-0"
                >
                  <svg className="w-4 h-4 transform rotate-45 -translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          </main>

          {/* Column 3: Right Hand Tools & Widgets */}
          <RightWidgets
            onSelectPrompt={(promptText) => {
              setInputMessage(promptText);
            }}
            onNavigate={onTabChange}
            shoppingItems={shoppingItems}
            savedCups={savedCups}
          />
        </div>
      </div>
    </div>
  );
}