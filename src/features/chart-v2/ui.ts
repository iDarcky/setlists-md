// The shared JavaScript parts the new chart uses, typed once here for the
// props it passes. When src/ui moves to TypeScript these casts go away.
import type { ComponentType, ReactNode } from 'react';
import * as PopoverJs from '@/ui/shadcn/popover';
import * as DialogJs from '@/ui/shadcn/dialog';
import { Segmented as SegmentedJs } from '@/ui/shadcn/segmented';
import { BottomSheet as BottomSheetJs } from '@/ui/shadcn/bottom-sheet';
import { Switch as SwitchJs } from '@/ui/shadcn/switch';
import { useMediaQuery as useMediaQueryJs } from '@/lib/useMediaQuery';

type AnyProps = { children?: ReactNode; className?: string; [key: string]: unknown };
const c = (x: unknown) => x as ComponentType<AnyProps>;

export const Popover = c(PopoverJs.Popover);
export const PopoverTrigger = c(PopoverJs.PopoverTrigger);
export const PopoverContent = c(PopoverJs.PopoverContent);
export const Dialog = c(DialogJs.Dialog);
export const DialogContent = c(DialogJs.DialogContent);
export const DialogHeader = c(DialogJs.DialogHeader);
export const DialogTitle = c(DialogJs.DialogTitle);

export interface SegOption { value: string; label: string; disabled?: boolean }
export const Segmented = SegmentedJs as unknown as ComponentType<{
  value: string; options: SegOption[]; onChange: (v: string) => void; label: string; size?: string; fill?: boolean; className?: string;
}>;
export const BottomSheet = BottomSheetJs as unknown as ComponentType<{
  open: boolean; onOpenChange: (open: boolean) => void; title: string; children?: ReactNode; className?: string;
}>;
export const Switch = SwitchJs as unknown as ComponentType<{
  checked: boolean; onCheckedChange: (on: boolean) => void; label: string; disabled?: boolean; className?: string;
}>;
export const useMediaQuery = useMediaQueryJs as (query: string) => boolean;
