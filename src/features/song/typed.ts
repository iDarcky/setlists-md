// The song page's JavaScript parts, typed once for the TypeScript screens
// (2026-11-20). Each cast lists only the props those screens pass.
import type { ComponentType, ReactNode } from 'react';
import { KeyChip as KeyChipJs, ArrangementChip as ArrangementChipJs, MenuSheet as MenuSheetJs } from './SongView';
import { Cover as CoverJs, SongMap as SongMapJs } from './SongParts';
import SongChartJs from './SongChart';

/** A song as the page reads it: one arrangement, resolved (`resolveSongView`). */
export type SongView = {
  id?: string;
  title?: string;
  artist?: string;
  key?: string;
  tempo?: number | string;
  time?: string;
  capo?: number | string;
  notes?: string;
  youtube?: string;
  spotify?: string;
  writers?: string;
  publishers?: string;
  label?: string;
  copyright?: string;
  ccli?: string;
  album?: string;
  year?: number | string;
  scripture?: string;
  vocalrange?: string;
  language?: string;
  originaltitle?: string;
  translator?: string;
  themes?: string | string[];
  tags?: string[];
  sections?: unknown[];
};

export type Arrangement = { id: string; name: string; key?: string; tempo?: number | string; capo?: number | string; isDefault?: boolean };
export type KeyControl = { shown: string; original: string; semis: number; onStep: (d: number) => void; onReset: () => void; onEveryone: (() => void) | null };
export type Facts = { plays: number; last: string | null; usualKey: string; usualTempo?: number };
export type MenuEntry = { label: string; sub?: string; danger?: boolean; onClick: () => void };
export type SectionCode = string | { code: string; fg?: string; bg?: string };

export const KeyChip = KeyChipJs as unknown as ComponentType<KeyControl>;
export const ArrangementChip = ArrangementChipJs as unknown as ComponentType<{
  arrangements: Arrangement[];
  current?: string;
  onPick: (id: string) => void;
  onNew?: (() => void) | null;
}>;
export const MenuSheet = MenuSheetJs as unknown as ComponentType<{ open: boolean; onOpenChange: (open: boolean) => void; title?: ReactNode; items: MenuEntry[] }>;
export const Cover = CoverJs as unknown as ComponentType<{ song: SongView; size?: number; className?: string }>;
export const SongMap = SongMapJs as unknown as ComponentType<{ codes: SectionCode[]; className?: string }>;
export const SongChart = SongChartJs as unknown as ComponentType<{
  song: SongView;
  semis?: number;
  sharps?: boolean;
  show?: 'chords' | 'lyrics';
  layout?: 'auto' | 'phone' | 'desk';
  notes?: boolean;
}>;

import FullscreenReaderJs from '@/features/reader/FullscreenReader';

export const FullscreenReader = FullscreenReaderJs as unknown as ComponentType<{
  song: SongView;
  settings?: Record<string, unknown>;
  onUpdateSettings?: (key: string, value: unknown) => void;
  mode?: 'live' | 'practice';
  practiceAlways?: boolean;
  practiceNote?: string;
  displayMode?: 'chords' | 'lyrics';
  selectedKey?: string;
  onSelectKey?: (key: string) => void;
  footer?: ReactNode;
  onClose: () => void;
}>;
