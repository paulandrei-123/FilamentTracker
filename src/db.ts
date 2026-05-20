import type { Filament } from './types';

const DB_NAME = 'FilamentTrackerDB';
const STORE_NAME = 'filaments';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB database');
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const getAllFilaments = async (): Promise<Filament[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort filaments by updatedAt descending by default
      const filaments = request.result as Filament[];
      filaments.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(filaments);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const saveFilament = async (filament: Filament): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(filament);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const deleteFilament = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

// LocalStorage helpers for Settings
const SETTINGS_KEY = 'filament_tracker_settings';

export interface AppSettings {
  geminiKey: string;
  googleClientId: string;
  theme: 'dark' | 'light';
}

const DEFAULT_SETTINGS: AppSettings = {
  geminiKey: '',
  googleClientId: '',
  theme: 'dark',
};

export const getSettings = (): AppSettings => {
  try {
    const settingsJson = localStorage.getItem(SETTINGS_KEY);
    if (settingsJson) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) };
    }
  } catch (e) {
    console.error('Failed to read settings from localStorage', e);
  }
  return DEFAULT_SETTINGS;
};

export const saveSettings = (settings: Partial<AppSettings>): AppSettings => {
  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
};
