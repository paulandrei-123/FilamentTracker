import React, { useState } from 'react';
import type { Filament } from '../types';

interface FilamentDetailProps {
  filament: Filament;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onUpdateAmount: (id: string, newAmount: number) => void;
  onUpdatePictures: (id: string, newPictures: string[]) => void;
}

export const FilamentDetail: React.FC<FilamentDetailProps> = ({
  filament,
  onClose,
  onEdit,
  onDelete,
  onUpdateAmount,
  onUpdatePictures,
}) => {
  const [activeImgIndex, setActiveImgIndex] = useState<number>(0);

  const images = filament.pictures || [];
  const hasImages = images.length > 0;

  const handleNextImage = () => {
    if (images.length <= 1) return;
    setActiveImgIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevImage = () => {
    if (images.length <= 1) return;
    setActiveImgIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const adjustAmount = (delta: number) => {
    const val = parseFloat((filament.amount + delta).toFixed(2));
    onUpdateAmount(filament.id, Math.max(0, val));
  };

  const resizeImage = (base64Str: string, maxDimension = 1000): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((maxDimension / width) * height);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((maxDimension / height) * width);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileList = Array.from(files);
    const readPromises = fileList.map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const rawBase64 = reader.result as string;
          const resized = await resizeImage(rawBase64);
          resolve(resized);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readPromises).then((resizedBase64Strings) => {
      const updated = [...images, ...resizedBase64Strings];
      onUpdatePictures(filament.id, updated);
      setActiveImgIndex(updated.length - 1);
    });
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    const newPics = [...images];
    if (direction === 'left' && index > 0) {
      const temp = newPics[index];
      newPics[index] = newPics[index - 1];
      newPics[index - 1] = temp;
      onUpdatePictures(filament.id, newPics);
      if (activeImgIndex === index) setActiveImgIndex(index - 1);
      else if (activeImgIndex === index - 1) setActiveImgIndex(index);
    } else if (direction === 'right' && index < newPics.length - 1) {
      const temp = newPics[index];
      newPics[index] = newPics[index + 1];
      newPics[index + 1] = temp;
      onUpdatePictures(filament.id, newPics);
      if (activeImgIndex === index) setActiveImgIndex(index + 1);
      else if (activeImgIndex === index + 1) setActiveImgIndex(index);
    }
  };

  const deleteImage = (index: number) => {
    if (window.confirm('Remove this picture?')) {
      const newPics = images.filter((_, idx) => idx !== index);
      onUpdatePictures(filament.id, newPics);
      setActiveImgIndex(0);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${filament.name}"?`)) {
      onDelete(filament.id);
    }
  };

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', fontWeight: 700 }}>
              {filament.brand}
            </span>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{filament.name}</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-icon" onClick={onEdit} aria-label="Edit filament">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button className="btn-icon" onClick={onClose} aria-label="Close panel">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="bottom-sheet-content">
          {/* Main Picture Carousel */}
          <div className="detail-hero-carousel">
            {hasImages ? (
              <>
                <img
                  src={images[activeImgIndex]}
                  alt={`${filament.name} carousel ${activeImgIndex}`}
                  className="carousel-slide-img"
                />
                {images.length > 1 && (
                  <>
                    <button className="carousel-nav-btn prev" onClick={handlePrevImage} aria-label="Previous image">
                      ‹
                    </button>
                    <button className="carousel-nav-btn next" onClick={handleNextImage} aria-label="Next image">
                      ›
                    </button>
                    <span className="carousel-indicator">
                      {activeImgIndex + 1} / {images.length}
                    </span>
                  </>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: '8px' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>No pictures added yet</span>
              </div>
            )}
          </div>

          {/* Amount Adjuster Panel */}
          <div className="detail-amount-panel">
            <div>
              <h3 className="detail-section-title" style={{ marginBottom: 0 }}>Stock Amount</h3>
            </div>
            <div className="amount-counter">
              <button className="counter-btn" onClick={() => adjustAmount(-0.25)} title="-0.25 spool">
                -
              </button>
              <div className="amount-display">
                <span className="amount-num">{filament.amount}</span>
                <span className="amount-lbl">spools</span>
              </div>
              <button className="counter-btn" onClick={() => adjustAmount(0.25)} title="+0.25 spool">
                +
              </button>
            </div>
          </div>

          {/* Core Settings Spec Grid */}
          <h3 className="detail-section-title">Printing Specifications</h3>
          <div className="detail-quick-spec-grid">
            <div className="spec-box">
              <span className="spec-val">
                {filament.nozzleTempMin && filament.nozzleTempMax
                  ? `${filament.nozzleTempMin}-${filament.nozzleTempMax}°C`
                  : filament.nozzleTempMin
                  ? `${filament.nozzleTempMin}°C`
                  : 'N/A'}
              </span>
              <span className="spec-lbl">Nozzle Temp</span>
            </div>
            <div className="spec-box">
              <span className="spec-val">
                {filament.bedTempMin && filament.bedTempMax
                  ? `${filament.bedTempMin}-${filament.bedTempMax}°C`
                  : filament.bedTempMin
                  ? `${filament.bedTempMin}°C`
                  : 'N/A'}
              </span>
              <span className="spec-lbl">Bed Temp</span>
            </div>
            <div className="spec-box">
              <span className="spec-val">
                {filament.printSpeed ? `${filament.printSpeed} mm/s` : 'N/A'}
              </span>
              <span className="spec-lbl">Print Speed</span>
            </div>
          </div>

          {/* Subtypes tags */}
          {filament.subTypes && filament.subTypes.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 className="detail-section-title">Sub-types</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {filament.subTypes.map((sub, idx) => (
                  <span
                    key={idx}
                    className="subtype-tag"
                    style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: '12px' }}
                  >
                    {sub}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Color Display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', marginBottom: '20px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: filament.colorHex, border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Filament Color</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>{filament.color} <span style={{ fontFamily: 'monospace', fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({filament.colorHex})</span></span>
            </div>
          </div>

          {/* Links Section */}
          {filament.links && filament.links.length > 0 && (
            <div>
              <h3 className="detail-section-title">Purchased / Shop Links</h3>
              <div className="detail-links-list">
                {filament.links.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="detail-link-btn"
                  >
                    <span>{link.title || 'Shop Link'}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Notes / Description */}
          {filament.description && (
            <div style={{ marginBottom: '20px' }}>
              <h3 className="detail-section-title">Notes / Description</h3>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {filament.description}
              </div>
            </div>
          )}

          {/* Manage Images section */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }}>
            <h3 className="detail-section-title">Manage Pictures ({images.length})</h3>
            <div className="pictures-manager">
              <div className="pictures-grid">
                {images.map((img, idx) => (
                  <div key={idx} className="picture-slot">
                    <img src={img} alt={`thumbnail ${idx}`} onClick={() => setActiveImgIndex(idx)} style={{ cursor: 'pointer', border: activeImgIndex === idx ? '2px solid var(--accent-color)' : 'none' }} />
                    <div className="slot-controls">
                      {idx > 0 && (
                        <button className="slot-btn" onClick={() => moveImage(idx, 'left')} title="Move Left">
                          ‹
                        </button>
                      )}
                      {idx < images.length - 1 && (
                        <button className="slot-btn" onClick={() => moveImage(idx, 'right')} title="Move Right">
                          ›
                        </button>
                      )}
                      <button className="slot-btn" onClick={() => deleteImage(idx)} title="Delete Image" style={{ background: 'rgba(239, 68, 68, 0.8)' }}>
                        ×
                      </button>
                    </div>
                  </div>
                ))}

                {/* Option 1: Take Photo via Camera */}
                <label className="picture-upload-placeholder" title="Take photo using camera">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span>Camera</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </label>

                {/* Option 2: Upload from Gallery */}
                <label className="picture-upload-placeholder" title="Choose photo from gallery">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span>Gallery</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    multiple
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Delete Spool Panel */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '30px' }}>
            <button className="btn-danger" onClick={handleDelete} style={{ flex: 1 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              Delete Filament
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
