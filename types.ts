
export interface UserDetails {
  fullName: string;
  role: string;
  publicVideoUrl?: string;
}

export interface SopStep {
  stepNumber: number;
  description: string;
  timestampSeconds: number;
  screenshotUrl?: string; // Populated client-side after AI returns timestamps
}

export interface SopData {
  title: string;
  overview: string;
  steps: SopStep[];
}

export enum AppState {
  INPUT = 'INPUT',
  PROCESSING = 'PROCESSING',
  EDITING = 'EDITING',
  PREVIEW = 'PREVIEW',
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    html2pdf: any;
    aistudio?: AIStudio;
  }
}
