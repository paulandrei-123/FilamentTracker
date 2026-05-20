import React from 'react';
import type { Filament } from '../types';

interface FilamentCardProps {
  filament: Filament;
  onClick: () => void;
}

export const FilamentCard: React.FC<FilamentCardProps> = ({ filament, onClick }) => {
  // Use first image if available, else null
  const mainImage = filament.pictures && filament.pictures.length > 0 ? filament.pictures[0] : null;

  // Determine progress width (max out at 100% for 1 spool, or scale appropriately if multiple spools)
  // Let's cap the visual progress bar fill at 1.0 spools (100%), but display the true text
  const progressPercent = Math.min(100, Math.max(0, (filament.amount / 1.0) * 100));

  return (
    <div className="filament-card" onClick={onClick} id={`filament-card-${filament.id}`}>
      <div className="card-img-container">
        {mainImage ? (
          <img src={mainImage} alt={filament.name} className="card-img" loading="lazy" />
        ) : (
          <svg className="card-placeholder-img" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        )}

        {/* Floating overlays on card image */}
        <div className="card-badges">
          <span className="type-badge">{filament.type}</span>
        </div>

        <div className="color-dot-indicator" style={{ backgroundColor: filament.colorHex }} title={filament.color} />

        <div className="amount-overlay-badge">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <span>{filament.amount} Spools</span>
        </div>
      </div>

      <div className="card-info">
        <span className="card-brand">{filament.brand}</span>
        <h3 className="card-name" title={filament.name}>{filament.name}</h3>

        {filament.subTypes && filament.subTypes.length > 0 && (
          <div className="card-subtypes-row">
            {filament.subTypes.map((sub, idx) => (
              <span key={idx} className="subtype-tag">
                {sub}
              </span>
            ))}
          </div>
        )}

        <div className="spool-progress-container" title={`Spool level: ${filament.amount}`}>
          <div
            className="spool-progress-fill"
            style={{
              width: `${progressPercent}%`,
              background: filament.amount < 0.25 ? 'var(--danger-color)' : 'var(--accent-gradient)'
            }}
          />
        </div>
      </div>
    </div>
  );
};
