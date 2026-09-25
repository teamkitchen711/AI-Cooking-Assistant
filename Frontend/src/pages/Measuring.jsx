import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import chefImg from '../assets/chef.png';
import { fetchCustomCups, createCustomCup, deleteCustomCup, convertMeasurements } from '../services/api.js';

const STANDARD_CUPS = [
  { id: 'std-us', name: 'Standard US Cup', volume_ml: 240, isStandard: true },
  { id: 'std-metric', name: 'Standard Metric Cup', volume_ml: 250, isStandard: true },
];

const dedupeCups = (cups = []) => {
  const seenIds = new Set();
  const seenNames = new Set();
  return (cups || []).filter((cup) => {
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

export default function Measuring({
  user,
  customCups: propCups,
  onAddCup,
  onDeleteCup,
  onTabChange,
  onLogout,
  onBackToHome,
}) {
  // Top-level toggle: 'scaler_to_cups' vs 'cups_to_scaler'
  const [activeMode, setActiveMode] = useState('scaler_to_cups');

  // Saved custom cups list
  const [savedCups, setSavedCups] = useState(() => dedupeCups(propCups || []));
  const [isSavingCup, setIsSavingCup] = useState(false);

  // Selected cup for 'scaler_to_cups' mode
  const [selectedCupId, setSelectedCupId] = useState('std-us');

  // Text inputs
  const [scalerInput, setScalerInput] = useState("240g flour\n200g sugar\n115g butter");
  const [scalerResult, setScalerResult] = useState('');
  const [isConvertingScaler, setIsConvertingScaler] = useState(false);

  const [cupsInput, setCupsInput] = useState("2 cups all-purpose flour\n1 cup granulated sugar\n1/2 cup butter, melted");
  const [cupsResult, setCupsResult] = useState('');
  const [isConvertingCups, setIsConvertingCups] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('know_volume'); // 'know_volume' | 'unknown_volume'
  const [newCupName, setNewCupName] = useState('');
  const [newCupVolume, setNewCupVolume] = useState('');
  const [cupHeight, setCupHeight] = useState('');
  const [cupDiameter, setCupDiameter] = useState('');
  const [modalError, setModalError] = useState('');

  // Sync if propCups passed, or fetch if not available
  useEffect(() => {
    if (propCups !== undefined && Array.isArray(propCups) && propCups.length > 0) {
      setSavedCups(dedupeCups(propCups));
    } else {
      fetchCustomCups().then((cups) => {
        if (cups !== null && Array.isArray(cups)) {
          setSavedCups(dedupeCups(cups));
        }
      });
    }
  }, [propCups, user]);

  // All unique saved cups
  const uniqueSavedCups = dedupeCups(savedCups);

  // All available cups for dropdown
  const allCupOptions = [
    ...STANDARD_CUPS,
    ...uniqueSavedCups.map((c) => ({ ...c, isStandard: false })),
  ];

  // Active selected cup object
  const activeSelectedCup =
    allCupOptions.find((c) => String(c.id) === String(selectedCupId)) || STANDARD_CUPS[0];

  // Live computed volume for "I don't know the volume" modal tab
  const computedUnknownVolume = (() => {
    const h = parseFloat(cupHeight);
    const d = parseFloat(cupDiameter);
    if (!h || !d || h <= 0 || d <= 0) return 0;
    const r = d / 2;
    // Cylinder formula: V = pi * r^2 * h (in cm^3 = ml)
    return Math.round(Math.PI * Math.pow(r, 2) * h);
  })();

  // Handle Save New Cup from Modal
  const handleSaveNewCup = async (e) => {
    e.preventDefault();
    if (isSavingCup) return;

    setModalError('');

    const trimmedName = newCupName.trim();
    if (!trimmedName) {
      setModalError('Please enter a cup name.');
      return;
    }

    // Check unique cup name (case-insensitive)
    const exists = allCupOptions.some(
      (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      setModalError(`A cup named "${trimmedName}" already exists. Please choose a unique name.`);
      return;
    }

    let finalVolume = 0;
    let h = null;
    let d = null;

    if (modalMode === 'know_volume') {
      finalVolume = parseFloat(newCupVolume);
      if (!finalVolume || finalVolume <= 0) {
        setModalError('Please enter a valid volume in milliliters (ml).');
        return;
      }
    } else {
      h = parseFloat(cupHeight);
      d = parseFloat(cupDiameter);
      if (!h || !d || h <= 0 || d <= 0) {
        setModalError('Please enter valid positive numbers for height and diameter.');
        return;
      }
      finalVolume = computedUnknownVolume;
    }

    setIsSavingCup(true);
    try {
      // Call API to persist cup in DB
      const result = await createCustomCup({
        name: trimmedName,
        volume_ml: finalVolume,
        height_cm: h,
        diameter_cm: d,
      });

      if (!result.success) {
        setModalError(result.error || 'Failed to save cup. Please try again.');
        setIsSavingCup(false);
        return;
      }

      const storedCup = result.cup;

      setSavedCups((prev) => dedupeCups([...prev, storedCup]));
      setSelectedCupId(storedCup.id);
      if (onAddCup) onAddCup(storedCup);

      // Reset and close modal
      setNewCupName('');
      setNewCupVolume('');
      setCupHeight('');
      setCupDiameter('');
      setModalError('');
      setIsModalOpen(false);
    } catch (err) {
      setModalError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSavingCup(false);
    }
  };

  // Handle Delete Cup
  const handleDeleteCup = async (cupId, e) => {
    e?.stopPropagation();
    setSavedCups((prev) => prev.filter((c) => String(c.id) !== String(cupId)));
    if (String(selectedCupId) === String(cupId)) {
      setSelectedCupId('std-us');
    }
    if (onDeleteCup) onDeleteCup(cupId);
    await deleteCustomCup(cupId);
  };

  // Convert Scaler to Cups with Gemini
  const handleConvertScalerToCups = async () => {
    if (!scalerInput.trim() || isConvertingScaler) return;
    setIsConvertingScaler(true);
    setScalerResult('');

    try {
      const res = await convertMeasurements({
        mode: 'scaler_to_cups',
        text: scalerInput.trim(),
        cup: {
          name: activeSelectedCup.name,
          volume_ml: activeSelectedCup.volume_ml,
        },
      });
      setScalerResult(res || 'Conversion complete.');
    } catch (err) {
      console.error(err);
      setScalerResult('Failed to convert. Please check your ingredients and try again.');
    } finally {
      setIsConvertingScaler(false);
    }
  };

  // Convert Cups to Scaler with Gemini
  const handleConvertCupsToScaler = async () => {
    if (!cupsInput.trim() || isConvertingCups) return;
    setIsConvertingCups(true);
    setCupsResult('');

    try {
      const res = await convertMeasurements({
        mode: 'cups_to_scaler',
        text: cupsInput.trim(),
        cup: {
          name: 'Standard US Cup',
          volume_ml: 240,
        },
      });
      setCupsResult(res || 'Conversion complete.');
    } catch (err) {
      console.error(err);
      setCupsResult('Failed to convert. Please check your ingredients and try again.');
    } finally {
      setIsConvertingCups(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#FAF7F0] text-gray-900 font-sans overflow-hidden">
      {/* 1. Leftmost Navigation Icon Rail */}
      <Sidebar
        activeTab="measuring"
        onTabChange={onTabChange}
        onLogout={onLogout}
        onBackToHome={onBackToHome}
        user={user}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="max-w-4xl w-full mx-auto px-6 py-10 space-y-8">
          {/* Top Hero Section */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-4 max-w-lg">
              <span className="text-xs font-bold text-gray-500 tracking-wider">
                Chef Bon · Measuring
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-gray-950 tracking-tight">
                Measuring, made simple
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                Type your ingredients, then convert them — or measure with your own cup.
              </p>
            </div>

            {/* Chef Bon 3D Mascot Illustration */}
            <div className="relative shrink-0 flex items-center justify-center">
              <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-rose-50/80 flex items-center justify-center p-2">
                <img
                  src={chefImg}
                  alt="Chef Bon with Measuring Scale and Cup"
                  className="w-full h-full object-contain filter drop-shadow-md hover:scale-105 transition-transform duration-300"
                />
              </div>
            </div>
          </div>

          {/* Main Tool Card: "Recipe measurements" */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
              <div>
                <h2 className="text-lg font-black text-gray-950">Recipe measurements</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Convert scale measurements to cups or transform cup recipes into grams.
                </p>
              </div>

              {/* Top-level Toggle: Scaler to Cups vs Cups to Scaler */}
              <div className="inline-flex p-1 bg-stone-100 rounded-2xl border border-stone-200/60 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveMode('scaler_to_cups')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeMode === 'scaler_to_cups'
                      ? 'bg-white text-gray-950 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  ⚖️ Scaler to Cups
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode('cups_to_scaler')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeMode === 'cups_to_scaler'
                      ? 'bg-white text-gray-950 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  🥣 Cups to Scaler
                </button>
              </div>
            </div>

            {/* ========================================================= */}
            {/* VIEW 1: SCALER TO CUPS */}
            {/* ========================================================= */}
            {activeMode === 'scaler_to_cups' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Cup Selection Dropdown & "Add new cup" Button */}
                <div className="bg-[#FAF7F0] p-5 rounded-2xl border border-stone-200/70 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <label className="block text-xs font-black text-gray-900 uppercase tracking-wide">
                        Select Target Cup
                      </label>
                      <p className="text-[11px] text-gray-500">
                        Choose a standard measuring cup or any custom cup you've saved.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-red hover:bg-brand-red-hover text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer self-start sm:self-auto"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add new cup</span>
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <select
                      value={selectedCupId}
                      onChange={(e) => setSelectedCupId(e.target.value)}
                      className="w-full sm:w-80 px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm font-bold text-gray-900 focus:ring-2 focus:ring-brand-red outline-hidden shadow-2xs cursor-pointer"
                    >
                      <optgroup label="Standard Sizes">
                        {STANDARD_CUPS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.volume_ml} ml)
                          </option>
                        ))}
                      </optgroup>
                      {uniqueSavedCups.length > 0 && (
                        <optgroup label="Your Saved Cups">
                          {uniqueSavedCups.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.volume_ml} ml)
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>

                    <span className="text-xs text-stone-500 font-medium hidden sm:inline">
                      Active: <strong className="text-gray-900">{activeSelectedCup.name}</strong> ({activeSelectedCup.volume_ml} ml)
                    </span>
                  </div>

                  {/* Saved Cups Quick Chips */}
                  {uniqueSavedCups.length > 0 && (
                    <div className="pt-2 border-t border-stone-200/50">
                      <span className="text-[11px] font-semibold text-gray-500 block mb-2">
                        Quick select or delete saved cups:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {uniqueSavedCups.map((c) => {
                          const isSelected = String(selectedCupId) === String(c.id);
                          return (
                            <div
                              key={c.id}
                              onClick={() => setSelectedCupId(c.id)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-rose-50 text-brand-red border border-rose-300 shadow-2xs font-bold'
                                  : 'bg-white text-gray-700 border border-stone-200 hover:bg-stone-50'
                              }`}
                            >
                              <span>☕</span>
                              <span>{c.name} ({c.volume_ml} ml)</span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteCup(c.id, e)}
                                title={`Delete ${c.name}`}
                                className="w-4 h-4 rounded-full text-stone-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center text-[10px] ml-1 transition cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Free-text Textarea for Scale Ingredients */}
                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-900 uppercase tracking-wide">
                    Paste / Type Scale Ingredients (Grams / Metric)
                  </label>
                  <p className="text-xs text-gray-500">
                    Enter one ingredient per line with its scale weight in grams:
                  </p>
                  <textarea
                    rows={4}
                    value={scalerInput}
                    onChange={(e) => setScalerInput(e.target.value)}
                    placeholder="240g flour&#10;200g sugar&#10;115g butter"
                    className="w-full p-4 rounded-2xl border border-stone-200 bg-stone-50/60 font-mono text-xs sm:text-sm text-gray-900 focus:ring-2 focus:ring-brand-red outline-hidden transition resize-y shadow-2xs"
                  />
                </div>

                {/* Convert Button */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleConvertScalerToCups}
                    disabled={isConvertingScaler}
                    className="px-6 py-2.5 bg-brand-red hover:bg-brand-red-hover text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {isConvertingScaler ? (
                      <>
                        <span className="animate-spin">⚖️</span>
                        <span>Chef Bon is converting...</span>
                      </>
                    ) : (
                      <>
                        <span>Convert to {activeSelectedCup.name}</span>
                        <span>➔</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Conversion Output Box */}
                {scalerResult && (
                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-950">
                      <span>✓</span>
                      <span>Converted Recipe (Measured in {activeSelectedCup.name})</span>
                    </div>
                    <div className="text-xs sm:text-sm text-emerald-900 font-medium whitespace-pre-line leading-relaxed">
                      {scalerResult}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 2: CUPS TO SCALER */}
            {/* ========================================================= */}
            {activeMode === 'cups_to_scaler' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="bg-[#FAF7F0] p-4 rounded-2xl border border-stone-200/70">
                  <p className="text-xs text-gray-700 leading-relaxed">
                    <span className="font-extrabold text-gray-950">🥣 Standard Cups Conversion:</span> Enter your recipe ingredients in cups (standard 240ml cups). Chef Bon will calculate ingredient densities and provide exact scale weight in grams (g) for flawless cooking and baking.
                  </p>
                </div>

                {/* Free-text Textarea for Cup Ingredients */}
                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-900 uppercase tracking-wide">
                    Paste / Type Recipe in Cups
                  </label>
                  <p className="text-xs text-gray-500">
                    Enter one ingredient per line in cup measurements:
                  </p>
                  <textarea
                    rows={4}
                    value={cupsInput}
                    onChange={(e) => setCupsInput(e.target.value)}
                    placeholder="2 cups all-purpose flour&#10;1 cup granulated sugar&#10;1/2 cup butter, melted"
                    className="w-full p-4 rounded-2xl border font-mono text-xs sm:text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-brand-red focus:border-brand-red outline-hidden transition resize-y shadow-2xs"
                  />
                </div>

                {/* Convert Button */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleConvertCupsToScaler}
                    disabled={isConvertingCups}
                    className="px-6 py-2.5 bg-brand-red hover:bg-brand-red-hover text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {isConvertingCups ? (
                      <>
                        <span className="animate-spin">⚖️</span>
                        <span>Chef Bon is weighing...</span>
                      </>
                    ) : (
                      <>
                        <span>Convert to Scale (Grams)</span>
                        <span>➔</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Conversion Output Box */}
                {cupsResult && (
                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-950">
                      <span>✓</span>
                      <span>Converted Recipe (Kitchen Scale Measurements)</span>
                    </div>
                    <div className="text-xs sm:text-sm text-emerald-900 font-medium whitespace-pre-line leading-relaxed">
                      {cupsResult}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ========================================================= */}
      {/* "ADD NEW CUP" MODAL */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-stone-200 shadow-xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">☕</span>
                <h3 className="font-black text-gray-950 text-lg">Add new cup</h3>
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

            {/* Error Message */}
            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {modalError}
              </div>
            )}

            {/* Modal Tabs: I know volume vs I don't know volume */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setModalMode('know_volume');
                  setModalError('');
                }}
                className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer text-center ${
                  modalMode === 'know_volume'
                    ? 'bg-white text-gray-950 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                I know the volume
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalMode('unknown_volume');
                  setModalError('');
                }}
                className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer text-center ${
                  modalMode === 'unknown_volume'
                    ? 'bg-white text-gray-950 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                I don't know volume
              </button>
            </div>

            <form onSubmit={handleSaveNewCup} className="space-y-4">
              {/* Cup Name (Unique) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Cup Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCupName}
                  onChange={(e) => {
                    setNewCupName(e.target.value);
                    setModalError('');
                  }}
                  placeholder="e.g. Blue Coffee Mug, Grandma's Teacup"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-medium focus:ring-2 focus:ring-brand-red focus:border-brand-red outline-hidden bg-stone-50"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  Must be unique so Chef Bon can easily recognize it.
                </span>
              </div>

              {/* PATH 1: I know the volume */}
              {modalMode === 'know_volume' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Volume Capacity (ml) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="2000"
                    step="1"
                    required
                    value={newCupVolume}
                    onChange={(e) => {
                      setNewCupVolume(e.target.value);
                      setModalError('');
                    }}
                    placeholder="e.g. 350"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-brand-red outline-hidden bg-stone-50"
                  />
                  <span className="text-[10px] text-stone-400 mt-1 block">
                    1 standard US cup is 240 ml. Mugs typically range from 300 to 400 ml.
                  </span>
                </div>
              )}

              {/* PATH 2: I don't know the volume (Compute via Cylinder Formula) */}
              {modalMode === 'unknown_volume' && (
                <div className="space-y-3 bg-[#FAF7F0] p-3.5 rounded-2xl border border-stone-200/60">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Inside Height (cm) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        step="0.1"
                        required
                        value={cupHeight}
                        onChange={(e) => {
                          setCupHeight(e.target.value);
                          setModalError('');
                        }}
                        placeholder="e.g. 10.5"
                        className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-medium focus:ring-2 focus:ring-brand-red outline-hidden bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Inside Diameter (cm) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        step="0.1"
                        required
                        value={cupDiameter}
                        onChange={(e) => {
                          setCupDiameter(e.target.value);
                          setModalError('');
                        }}
                        placeholder="e.g. 8.0"
                        className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-medium focus:ring-2 focus:ring-brand-red outline-hidden bg-white"
                      />
                    </div>
                  </div>

                  {/* Real-time Computed Volume Output */}
                  <div className="pt-2 border-t border-stone-200/50 flex items-center justify-between">
                    <span className="text-xs text-gray-600 font-medium">Computed Volume (V = π·r²·h):</span>
                    <span className="text-xs font-extrabold text-brand-red bg-white px-2.5 py-1 rounded-full border border-stone-200">
                      {computedUnknownVolume > 0 ? `${computedUnknownVolume} ml` : '—'}
                    </span>
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
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
                  disabled={isSavingCup}
                  className="px-5 py-2.5 bg-brand-red hover:bg-brand-red-hover disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
                >
                  {isSavingCup ? 'Saving cup...' : 'Save cup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
