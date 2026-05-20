export interface Filament {
  id: string;               // Unique identifier (UUID/timestamp)
  name: string;             // Display name (auto-generated or custom)
  brand: string;            // e.g. eSUN, Hatchbox
  type: string;             // e.g. PLA, PETG, TPU
  color: string;            // e.g. Peak Green, Galaxy Black
  colorHex: string;         // Hex code representing the color
  pictures: string[];       // Array of base64-encoded image data URLs
  subTypes: string[];       // e.g. ["Matte", "High Flow"]
  nozzleTempMin: number | null;
  nozzleTempMax: number | null;
  bedTempMin: number | null;
  bedTempMax: number | null;
  printSpeed: number | null; // Speed in mm/s
  amount: number;           // Remaining spools (decimal, e.g. 1.25)
  description: string;      // Notes/comments
  links: Array<{ title: string; url: string }>; // Purchase/manufacturer URLs
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  geminiKey: string;
  googleClientId: string;
  theme: 'dark' | 'light';
}
