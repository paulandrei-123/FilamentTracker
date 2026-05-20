import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../db';
import type { Filament } from '../types';

interface SettingsPanelProps {
  onClose: () => void;
  onThemeChange: (theme: 'dark' | 'light') => void;
  allFilaments: Filament[];
  onRestoreData: (restored: Filament[]) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  onClose,
  onThemeChange,
  allFilaments,
  onRestoreData,
}) => {
  const [settings, setSettingsState] = useState(getSettings());
  const [showKey, setShowKey] = useState(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Load Google Identity Services script dynamically
  useEffect(() => {
    if ((window as any).google) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  const handleSaveGeminiKey = (key: string) => {
    const updated = saveSettings({ geminiKey: key });
    setSettingsState(updated);
  };

  const handleSaveClientId = (clientId: string) => {
    const updated = saveSettings({ googleClientId: clientId });
    setSettingsState(updated);
  };

  const handleToggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = saveSettings({ theme: nextTheme });
    setSettingsState(updated);
    onThemeChange(nextTheme);
  };

  // Manual Backup (JSON export)
  const handleExportJSON = () => {
    try {
      const dataStr = JSON.stringify(allFilaments, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `filament_tracker_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to export backup: ' + String(e));
    }
  };

  // Manual Restore (JSON import)
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!Array.isArray(parsed)) {
          throw new Error('Backup data must be an array of filament objects');
        }

        // Basic schema check
        if (parsed.length > 0) {
          const first = parsed[0];
          if (!first.id || !first.brand || !first.type || !first.color) {
            throw new Error('Invalid filament object format. Fields (id, brand, type, color) are mandatory.');
          }
        }

        if (window.confirm(`Are you sure you want to restore ${parsed.length} filaments? This will overwrite existing records with matching IDs.`)) {
          onRestoreData(parsed);
          alert('Data restored successfully!');
          onClose();
        }
      } catch (err) {
        alert('Failed to import backup: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
  };

  // Google Drive Auth & Sync Flow
  const handleConnectGoogle = () => {
    const clientId = settings.googleClientId.trim();
    if (!clientId) {
      alert('Please enter a valid Google Cloud Client ID first.');
      return;
    }

    try {
      const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file email',
        callback: (response: any) => {
          if (response.error) {
            console.error('Google OAuth error', response.error);
            setSyncMessage(`Auth failed: ${response.error}`);
            return;
          }
          if (response.access_token) {
            setGoogleToken(response.access_token);
            setSyncMessage('Connected to Google Drive!');
            
            // Try fetching user email
            fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` },
            })
              .then((res) => res.json())
              .then((userInfo) => {
                if (userInfo.email) {
                  setGoogleUserEmail(userInfo.email);
                }
              })
              .catch((err) => console.error('Failed to get email', err));
          }
        },
      });

      if (client) {
        client.requestAccessToken();
      } else {
        alert('Google client library could not be loaded. Please ensure you are online.');
      }
    } catch (err) {
      console.error(err);
      alert('Error initializing Google login: ' + String(err));
    }
  };

  // Helper to find file in Google Drive
  const findBackupFileInDrive = async (token: string): Promise<string | null> => {
    const q = encodeURIComponent("name = 'filament_tracker_backup.json' and trashed = false");
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Google Drive API search error: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.files && result.files.length > 0) {
      return result.files[0].id;
    }
    return null;
  };

  // Backup to Google Drive
  const handleBackupToDrive = async () => {
    if (!googleToken) {
      alert('Please connect your Google Account first.');
      return;
    }

    setIsSyncing(true);
    setSyncMessage('Backing up data...');

    try {
      const fileId = await findBackupFileInDrive(googleToken);
      const dataStr = JSON.stringify(allFilaments, null, 2);
      const fileBlob = new Blob([dataStr], { type: 'application/json' });

      if (fileId) {
        // Update existing backup file
        const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
        const res = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${googleToken}`,
            'Content-Type': 'application/json',
          },
          body: fileBlob,
        });

        if (!res.ok) throw new Error(`Update failed: ${res.statusText}`);
        setSyncMessage('Successfully updated backup file on Google Drive!');
      } else {
        // Create new backup file
        const metadata = {
          name: 'filament_tracker_backup.json',
          mimeType: 'application/json',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', fileBlob);

        const res = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${googleToken}`,
            },
            body: form,
          }
        );

        if (!res.ok) throw new Error(`Creation failed: ${res.statusText}`);
        setSyncMessage('Created new backup file on Google Drive!');
      }
    } catch (err) {
      console.error(err);
      setSyncMessage(`Backup failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Restore from Google Drive
  const handleRestoreFromDrive = async () => {
    if (!googleToken) {
      alert('Please connect your Google Account first.');
      return;
    }

    setIsSyncing(true);
    setSyncMessage('Searching for backup file...');

    try {
      const fileId = await findBackupFileInDrive(googleToken);
      if (!fileId) {
        setSyncMessage('No backup file (filament_tracker_backup.json) found on your Google Drive.');
        setIsSyncing(false);
        return;
      }

      setSyncMessage('Downloading backup...');
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${googleToken}` },
      });

      if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);

      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('Data in backup file is not a valid list of filaments.');
      }

      if (window.confirm(`We found ${data.length} filaments in Google Drive. Overwrite local library?`)) {
        onRestoreData(data);
        setSyncMessage('Library successfully sync-restored from Google Drive!');
        alert('Data restored successfully!');
        onClose();
      } else {
        setSyncMessage('Restore cancelled.');
      }
    } catch (err) {
      console.error(err);
      setSyncMessage(`Restore failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-header">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--accent-color)' }}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            App Configuration
          </h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="bottom-sheet-content">
          <div className="settings-section">
            {/* Dark Mode toggle */}
            <div className="settings-card" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="settings-title">Display Theme</span>
                <p className="settings-description">Toggle light and dark color schemes.</p>
              </div>
              <button className="btn-icon" onClick={handleToggleTheme} style={{ width: '48px', height: '48px' }}>
                {settings.theme === 'dark' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Gemini API Key */}
            <div className="settings-card">
              <span className="settings-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
                Gemini API Key
              </span>
              <p className="settings-description">
                Required for smart packaging scans. Get a free API Key from Google AI Studio. This key stays stored entirely in your device.
              </p>
              <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  className="form-input"
                  value={settings.geminiKey}
                  onChange={(e) => handleSaveGeminiKey(e.target.value)}
                  placeholder="Paste your AI Studio Key here"
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Google Drive Cloud Backup */}
            <div className="settings-card">
              <span className="settings-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21.2 15c.7-1.2 1-2.5.7-3.9-.3-2-1.8-3.6-3.8-3.9C17 4.1 14.1 2 11 2c-3.4 0-6.3 2.5-6.9 5.9C2 8.5 0 10.9 0 14c0 3.3 2.7 6 6 6h13c2.8 0 5-2.2 5-5 0-1.8-1-3.3-2.8-4z" />
                </svg>
                Google Drive Cloud Sync
              </span>
              <p className="settings-description">
                Backup or restore your library directly using Google Drive files. Needs a Google Client ID.
              </p>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>OAuth Client ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.googleClientId}
                  onChange={(e) => handleSaveClientId(e.target.value)}
                  placeholder="Paste Google Web OAuth Client ID"
                />
                <details style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', cursor: 'pointer' }}>
                  <summary style={{ fontWeight: 600, color: 'var(--accent-color)' }}>How to get a Client ID?</summary>
                  <ol style={{ paddingLeft: '16px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li>Open <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)' }}>Google Cloud Console</a>.</li>
                    <li>Create a project and go to <strong>OAuth consent screen</strong>. Configure external support.</li>
                    <li>Go to <strong>Credentials</strong> &rarr; <strong>Create Credentials</strong> &rarr; <strong>OAuth client ID</strong>.</li>
                    <li>Select <strong>Web application</strong>.</li>
                    <li>Add your local network IP (e.g. <code>http://localhost:5173</code>) and <code>http://localhost</code> under <strong>Authorized JavaScript origins</strong>.</li>
                    <li>Copy and paste the Client ID above.</li>
                  </ol>
                </details>
              </div>

              {googleToken ? (
                <div className="auth-status-bar">
                  <span>Signed in as: <strong style={{ color: 'var(--text-primary)' }}>{googleUserEmail || 'Connected'}</strong></span>
                  <span className="auth-badge connected">Sync Connected</span>
                </div>
              ) : (
                <div className="auth-status-bar">
                  <span>Not logged in</span>
                  <span className="auth-badge disconnected">Offline</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                {!googleToken ? (
                  <button className="btn-secondary" onClick={handleConnectGoogle}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    Connect Google Drive
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-primary" onClick={handleBackupToDrive} disabled={isSyncing} style={{ flex: 1 }}>
                      Backup to Drive
                    </button>
                    <button className="btn-secondary" onClick={handleRestoreFromDrive} disabled={isSyncing} style={{ flex: 1 }}>
                      Restore from Drive
                    </button>
                  </div>
                )}
              </div>

              {syncMessage && (
                <div style={{ fontSize: '0.8rem', padding: '8px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', borderLeft: '3px solid var(--accent-color)' }}>
                  {syncMessage}
                </div>
              )}
            </div>

            {/* Local Manual Backup */}
            <div className="settings-card">
              <span className="settings-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Manual Storage Backup
              </span>
              <p className="settings-description">
                No setup needed. Export your entire filament database + pictures into a local JSON file that you can save anywhere, and import it later.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-secondary" onClick={handleExportJSON} style={{ flex: 1 }}>
                  Export Backup File
                </button>
                <label className="btn-secondary" style={{ flex: 1, cursor: 'pointer', textAlign: 'center' }}>
                  Import Backup File
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
