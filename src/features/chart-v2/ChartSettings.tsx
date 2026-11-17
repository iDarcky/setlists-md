import type { ComponentType, ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import * as PopoverJs from '@/ui/shadcn/popover';
import { Segmented as SegmentedJs } from '@/ui/shadcn/segmented';
import type { RibbonPosition, RibbonStyle } from './StructureRow';
import type { ChartMode } from './types';

// The shared JS parts, typed for the props this file passes.
type AnyProps = { children?: ReactNode; [key: string]: unknown };
const Popover = PopoverJs.Popover as unknown as ComponentType<AnyProps>;
const PopoverTrigger = PopoverJs.PopoverTrigger as unknown as ComponentType<AnyProps>;
const PopoverContent = PopoverJs.PopoverContent as unknown as ComponentType<AnyProps>;
interface Option { value: string; label: string }
const Segmented = SegmentedJs as unknown as ComponentType<{ value: string; options: Option[]; onChange: (v: string) => void; label: string; size?: string; fill?: boolean }>;

interface Props {
  style: RibbonStyle;
  position: RibbonPosition;
  setlistBar: boolean;
  mode: ChartMode;
  onSetting: (key: string, value: unknown) => void;
  onMode: (mode: ChartMode) => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * The settings the new chart already reads (owner, 2026-11-18: "bring the
 * settings back so I can test them"). They write the same keys as the old
 * reader's Aa menu, so a choice here carries over. "Preview" is for testing
 * only: it never changes the setlist, and the clock still decides live.
 */
export function ChartSettings({ style, position, setlistBar, mode, onSetting, onMode }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Chart settings"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-raised hover:text-foreground"
        >
          <SlidersHorizontal size={20} strokeWidth={1.8} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-80 flex-col gap-4">
        <Row label="Structure">
          <Segmented
            label="Structure style" size="sm" fill value={style}
            options={[{ value: 'codes', label: 'Boxes' }, { value: 'chips', label: 'Chips' }, { value: 'dots', label: 'Dots' }]}
            onChange={v => onSetting('ribbonStyle', v)}
          />
        </Row>
        <Row label="Position">
          <Segmented
            label="Structure position" size="sm" fill value={position}
            options={[{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'off', label: 'Off' }]}
            onChange={v => onSetting('structurePosition', v)}
          />
        </Row>
        <Row label="Setlist bar">
          <Segmented
            label="Setlist bar" size="sm" fill value={setlistBar ? 'setlist' : 'ribbon'}
            options={[{ value: 'ribbon', label: 'Off' }, { value: 'setlist', label: 'On' }]}
            onChange={v => onSetting('readerTopBar', v)}
          />
        </Row>
        <Row label="Preview (testing)">
          <Segmented
            label="Preview mode" size="sm" fill value={mode}
            options={[{ value: 'practice', label: 'Practice' }, { value: 'live', label: 'Live' }]}
            onChange={v => onMode(v as ChartMode)}
          />
        </Row>
      </PopoverContent>
    </Popover>
  );
}
