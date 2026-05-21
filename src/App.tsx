import { useEffect, useState, useMemo } from 'react';
import type { Filament } from './types';
import {
  getAllFilaments,
  saveFilament,
  deleteFilament,
  getSettings,
} from './db';
import { FilamentCard } from './components/FilamentCard';
import { FilamentDetail } from './components/FilamentDetail';
import { FilamentForm } from './components/FilamentForm';
import { SettingsPanel } from './components/SettingsPanel';

// Helper to convert hex to RGB
function hexToRgb(hex: string) {
  const cleanHex = hex.replace('#', '');
  const num = parseInt(cleanHex, 16);
  if (cleanHex.length === 3) {
    const r = (num >> 8) & 0xf;
    const g = (num >> 4) & 0xf;
    const b = num & 0xf;
    return {
      r: (r << 4) | r,
      g: (g << 4) | g,
      b: (b << 4) | b,
    };
  }
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

const EMOJI_COLORS = [
  { emoji: '⬜', r: 240, g: 240, b: 240 }, // White
  { emoji: '⬛', r: 30, g: 30, b: 30 },    // Black
  { emoji: '🟥', r: 220, g: 40, b: 40 },   // Red
  { emoji: '🟧', r: 240, g: 140, b: 40 },  // Orange
  { emoji: '🟨', r: 240, g: 210, b: 40 },  // Yellow
  { emoji: '🟩', r: 40, g: 180, b: 80 },   // Green
  { emoji: '🟦', r: 40, g: 100, b: 220 },  // Blue
  { emoji: '🟪', r: 140, g: 40, b: 220 },  // Purple
  { emoji: '🟫', r: 120, g: 80, b: 40 },   // Brown
];

function getClosestEmoji(hex: string) {
  if (!hex) return '⬜';
  try {
    const rgb = hexToRgb(hex);
    let minDistance = Infinity;
    let bestEmoji = '⬜';
    
    for (const ref of EMOJI_COLORS) {
      const distance = Math.sqrt(
        Math.pow(rgb.r - ref.r, 2) +
        Math.pow(rgb.g - ref.g, 2) +
        Math.pow(rgb.b - ref.b, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        bestEmoji = ref.emoji;
      }
    }
    return bestEmoji;
  } catch (e) {
    return '⬜';
  }
}

function App() {
  // DB States
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [appSettings, setAppSettings] = useState(getSettings());

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSubType, setSelectedSubType] = useState('');

  // Dialog / Drawer States
  const [selectedFilamentId, setSelectedFilamentId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Initialize DB and load files
  useEffect(() => {
    // Apply Theme
    document.documentElement.setAttribute('data-theme', appSettings.theme);
    
    // Load Filaments
    const loadData = async () => {
      try {
        const list = await getAllFilaments();
        setFilaments(list);
      } catch (err) {
        console.error('Failed to load database content', err);
      }
    };
    loadData();
  }, [appSettings.theme]);

  // Derived filter options from all filaments
  const filterOptions = useMemo(() => {
    const brands = new Set<string>();
    const types = new Set<string>();
    const colors = new Set<string>();
    const subTypes = new Set<string>();
    const colorToHexMap: Record<string, string> = {};

    filaments.forEach((f) => {
      if (f.brand) brands.add(f.brand);
      if (f.type) types.add(f.type);
      if (f.color) {
        colors.add(f.color);
        if (f.colorHex) {
          colorToHexMap[f.color] = f.colorHex;
        }
      }
      if (f.subTypes) {
        f.subTypes.forEach((sub) => {
          if (sub) subTypes.add(sub);
        });
      }
    });

    return {
      brands: Array.from(brands).sort(),
      types: Array.from(types).sort(),
      colors: Array.from(colors).sort(),
      subTypes: Array.from(subTypes).sort(),
      colorToHexMap,
    };
  }, [filaments]);

  // Filter logic (combined)
  const filteredFilaments = useMemo(() => {
    return filaments.filter((f) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = f.name.toLowerCase().includes(query);
        const matchesBrand = f.brand.toLowerCase().includes(query);
        const matchesType = f.type.toLowerCase().includes(query);
        const matchesColor = f.color.toLowerCase().includes(query);
        const matchesDesc = f.description.toLowerCase().includes(query);
        const matchesSubTypes = f.subTypes.some((s) => s.toLowerCase().includes(query));

        if (!matchesName && !matchesBrand && !matchesType && !matchesColor && !matchesDesc && !matchesSubTypes) {
          return false;
        }
      }

      // 2. Brand
      if (selectedBrand && f.brand !== selectedBrand) return false;

      // 3. Type
      if (selectedType && f.type !== selectedType) return false;

      // 4. Color
      if (selectedColor && f.color !== selectedColor) return false;

      // 5. SubType
      if (selectedSubType && !f.subTypes.includes(selectedSubType)) return false;

      return true;
    });
  }, [filaments, searchQuery, selectedBrand, selectedType, selectedColor, selectedSubType]);

  // Derived stats
  const { totalSpoolsCount, totalItemsCount } = useMemo(() => {
    const sum = filteredFilaments.reduce((acc, f) => acc + f.amount, 0);
    return {
      totalSpoolsCount: parseFloat(sum.toFixed(2)),
      totalItemsCount: filteredFilaments.length,
    };
  }, [filteredFilaments]);

  // Selected Filament details
  const activeFilament = useMemo(() => {
    if (!selectedFilamentId) return null;
    return filaments.find((f) => f.id === selectedFilamentId) || null;
  }, [filaments, selectedFilamentId]);

  // Database actions
  const handleSaveFilament = async (updatedFilament: Filament) => {
    try {
      await saveFilament(updatedFilament);
      // Refresh state from database
      const list = await getAllFilaments();
      setFilaments(list);
      
      // Close forms
      setIsAddingNew(false);
      setIsEditing(false);
      setIsDuplicating(false);
      
      // Select the new / edited filament to view its details
      setSelectedFilamentId(updatedFilament.id);
    } catch (e) {
      alert('Error saving filament spool: ' + String(e));
    }
  };

  const handleDeleteFilament = async (id: string) => {
    try {
      await deleteFilament(id);
      const list = await getAllFilaments();
      setFilaments(list);
      setSelectedFilamentId(null);
      setIsEditing(false);
    } catch (e) {
      alert('Error deleting filament spool: ' + String(e));
    }
  };

  const handleUpdateAmount = async (id: string, newAmount: number) => {
    const target = filaments.find((f) => f.id === id);
    if (!target) return;

    const updated: Filament = {
      ...target,
      amount: newAmount,
      updatedAt: Date.now(),
    };

    try {
      await saveFilament(updated);
      const list = await getAllFilaments();
      setFilaments(list);
    } catch (e) {
      console.error('Failed to update amount', e);
    }
  };

  const handleUpdatePictures = async (id: string, newPictures: string[]) => {
    const target = filaments.find((f) => f.id === id);
    if (!target) return;

    const updated: Filament = {
      ...target,
      pictures: newPictures,
      updatedAt: Date.now(),
    };

    try {
      await saveFilament(updated);
      const list = await getAllFilaments();
      setFilaments(list);
    } catch (e) {
      console.error('Failed to update pictures', e);
    }
  };

  const handleDuplicateIncrement = async (id: string) => {
    const target = filaments.find((f) => f.id === id);
    if (!target) return;

    const updated: Filament = {
      ...target,
      amount: target.amount + 1,
      updatedAt: Date.now(),
    };

    try {
      await saveFilament(updated);
      const list = await getAllFilaments();
      setFilaments(list);
      alert(`Success! Increased spool count of "${target.name}" to ${updated.amount}.`);
    } catch (e) {
      console.error('Failed to increment duplicate spool', e);
    }
  };

  const handleRestoreData = async (restoredFilaments: Filament[]) => {
    try {
      for (const item of restoredFilaments) {
        await saveFilament(item);
      }
      const list = await getAllFilaments();
      setFilaments(list);
    } catch (err) {
      console.error('Failed to restore data', err);
    }
  };

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setAppSettings((prev) => ({ ...prev, theme: newTheme }));
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedBrand('');
    setSelectedType('');
    setSelectedColor('');
    setSelectedSubType('');
  };

  const hasActiveFilters = searchQuery !== '' || selectedBrand !== '' || selectedType !== '' || selectedColor !== '' || selectedSubType !== '';

  return (
    <div className="app-container">
      {/* Header Area */}
      <header className="app-header">
        <div className="header-top">
          <h1 className="logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(15deg)', color: 'var(--accent-color)' }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a7 7 0 1 0 10 10" />
              <path d="M12 8a4 4 0 1 0 4 4" />
            </svg>
            SpoolFlow
          </h1>
          <div className="header-actions">
            <button className="btn-icon" onClick={() => setIsSettingsOpen(true)} title="Settings" aria-label="Open Settings">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="search-filter-section">
          <div className="search-bar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, brand, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filters-row">
            {/* Brands Filter */}
            <select
              className={`filter-select ${selectedBrand ? 'active' : ''}`}
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
            >
              <option value="">All Brands</option>
              {filterOptions.brands.map((b, idx) => (
                <option key={idx} value={b}>{b}</option>
              ))}
            </select>

            {/* Types Filter */}
            <select
              className={`filter-select ${selectedType ? 'active' : ''}`}
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="">All Materials</option>
              {filterOptions.types.map((t, idx) => (
                <option key={idx} value={t}>{t}</option>
              ))}
            </select>

            {/* Colors Filter */}
            <select
              className={`filter-select ${selectedColor ? 'active' : ''}`}
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
            >
              <option value="">All Colors</option>
              {filterOptions.colors.map((c, idx) => {
                const hex = filterOptions.colorToHexMap[c] || '#ffffff';
                const emoji = getClosestEmoji(hex);
                return (
                  <option key={idx} value={c}>
                    {emoji} {c}
                  </option>
                );
              })}
            </select>

            {/* Subtypes Filter */}
            <select
              className={`filter-select ${selectedSubType ? 'active' : ''}`}
              value={selectedSubType}
              onChange={(e) => setSelectedSubType(e.target.value)}
            >
              <option value="">All Sub-types</option>
              {filterOptions.subTypes.map((sub, idx) => (
                <option key={idx} value={sub}>{sub}</option>
              ))}
            </select>

            <button
              className={`clear-filters-btn ${hasActiveFilters ? 'active' : ''}`}
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              title="Reset all filters"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '2px' }}>
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <polyline points="3 3 3 8 8 8" />
              </svg>
              Reset Filters
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid View */}
      <main className="main-content">
        <div className="grid-header-stats">
          <span className="stats-label">Library Inventory</span>
          <span className="stats-count">
            <strong>{totalSpoolsCount}</strong> {totalSpoolsCount === 1 ? 'Spool' : 'Spools'} ({totalItemsCount} {totalItemsCount === 1 ? 'type' : 'types'})
          </span>
        </div>

        {filteredFilaments.length > 0 ? (
          <div className="filament-grid">
            {filteredFilaments.map((f) => (
              <FilamentCard
                key={f.id}
                filament={f}
                onClick={() => setSelectedFilamentId(f.id)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>No Filaments Found</h3>
            <p style={{ fontSize: '0.85rem' }}>
              {filaments.length === 0
                ? "Your library is empty. Click '+' to add your first filament!"
                : "No spools match your search and filter criteria."}
            </p>
            {hasActiveFilters && (
              <button className="btn-secondary" onClick={handleClearFilters} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                Reset Filters
              </button>
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <button
        className="fab-btn"
        onClick={() => setIsAddingNew(true)}
        aria-label="Add new filament spool"
        title="Add Spool"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Dialog: Detail Bottom Sheet */}
      {activeFilament && !isEditing && !isDuplicating && (
        <FilamentDetail
          filament={activeFilament}
          onClose={() => setSelectedFilamentId(null)}
          onEdit={() => setIsEditing(true)}
          onDuplicate={() => setIsDuplicating(true)}
          onDelete={handleDeleteFilament}
          onUpdateAmount={handleUpdateAmount}
          onUpdatePictures={handleUpdatePictures}
        />
      )}

      {/* Dialog: Form Bottom Sheet (Add/Edit/Duplicate) */}
      {(isAddingNew || (isEditing && activeFilament) || (isDuplicating && activeFilament)) && (
        <FilamentForm
          filament={(isEditing || isDuplicating) && activeFilament ? activeFilament : undefined}
          isDuplicate={isDuplicating}
          existingFilaments={filaments}
          geminiKey={appSettings.geminiKey}
          onSave={handleSaveFilament}
          onDuplicateIncrement={handleDuplicateIncrement}
          onClose={() => {
            setIsAddingNew(false);
            setIsEditing(false);
            setIsDuplicating(false);
          }}
        />
      )}

      {/* Dialog: Settings Panel Drawer */}
      {isSettingsOpen && (
        <SettingsPanel
          onClose={() => {
            setIsSettingsOpen(false);
            setAppSettings(getSettings()); // Reload settings state
          }}
          onThemeChange={handleThemeChange}
          allFilaments={filaments}
          onRestoreData={handleRestoreData}
        />
      )}
    </div>
  );
}

export default App;
