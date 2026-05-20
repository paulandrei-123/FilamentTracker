import React, { useRef, useEffect, useState } from 'react';

interface ColorPickerCanvasProps {
  pictureSrc: string;
  initialColor?: string;
  onColorPicked: (hex: string) => void;
  onClose: () => void;
}

export const ColorPickerCanvas: React.FC<ColorPickerCanvasProps> = ({
  pictureSrc,
  initialColor,
  onColorPicked,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>(initialColor || '#ffffff');
  const [loupePos, setLoupePos] = useState<{ x: number; y: number } | null>(null);
  const [loupeColor, setLoupeColor] = useState<string>(initialColor || '#ffffff');
  const [isPicking, setIsPicking] = useState<boolean>(false);

  // Redraw image to canvas on mount or src change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = pictureSrc;
    img.onload = () => {
      // Scale image to fit within viewport constraints
      const maxW = 500;
      const maxH = 400;
      let width = img.width;
      let height = img.height;

      if (width > maxW) {
        height = (maxW / width) * height;
        width = maxW;
      }
      if (height > maxH) {
        width = (maxH / height) * width;
        height = maxH;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
    };
  }, [pictureSrc]);

  const rgbToHex = (r: number, g: number, b: number): string => {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  };

  const handlePickColor = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(clientX - rect.left);
    const y = Math.floor(clientY - rect.top);

    // Bound check
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
      return;
    }

    try {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
      setSelectedColor(hex);
      setLoupeColor(hex);
      setLoupePos({ x: clientX - rect.left, y: clientY - rect.top });
    } catch (e) {
      console.error('Canvas pixel extraction failed', e);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsPicking(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePickColor(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPicking) return;
    handlePickColor(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsPicking(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    onColorPicked(selectedColor);
  };

  return (
    <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="bottom-sheet" style={{ borderRadius: 'var(--radius-lg)', maxHeight: '90vh' }}>
        <div className="bottom-sheet-header">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-color)' }}>
              <path d="m2 22 1-1c1.4-1.4 2.4-3.2 3-5.2L7 12h5l-4-4 4-4H7L3 8.3c-2 2-2 5.2 0 7.2l-1 1v5.5Z" />
              <path d="m14 10 7.3-7.3a2 2 0 0 1 2.8 2.8L16.8 12.8" />
            </svg>
            Color Eyedropper
          </h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="bottom-sheet-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <p className="eyedropper-instructions">
            Press, drag, and release your finger over the image to pick the filament's color.
          </p>

          <div ref={containerRef} className="picker-canvas-container">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{ touchAction: 'none' }}
            />
            {loupePos && isPicking && (
              <div
                className="color-picker-loupe"
                style={{
                  left: `${loupePos.x}px`,
                  top: `${loupePos.y - 50}px`, // Offset upwards to avoid finger block
                  borderColor: loupeColor,
                  backgroundColor: loupeColor,
                }}
              >
                <div className="color-picker-center-point" />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: selectedColor, border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Selected HEX</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'monospace' }}>{selectedColor.toUpperCase()}</span>
            </div>
          </div>

          <div className="form-actions" style={{ width: '100%' }}>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={() => onColorPicked(selectedColor)}>Use This Color</button>
          </div>
        </div>
      </div>
    </div>
  );
};
