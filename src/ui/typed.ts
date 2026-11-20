// The shared JavaScript parts of src/ui, typed once here for the TypeScript
// screens (add songs, 2026-11-20). Each cast lists only the props those
// screens pass. When src/ui moves to TypeScript these casts go away.
import type { ComponentType, MouseEvent, ReactNode } from 'react';
import { Button as ButtonJs } from '@/ui/shadcn/button';
import { Popover as PopoverJs, PopoverTrigger as PopoverTriggerJs, PopoverContent as PopoverContentJs } from '@/ui/shadcn/popover';
import { Sheet as SheetJs } from '@/ui/shadcn/sheet';
import { MenuItem as MenuItemJs, MenuSeparator as MenuSeparatorJs, menuContent as menuContentJs } from '@/ui/shadcn/menu';

type Kids = { children?: ReactNode; className?: string };

export const Button = ButtonJs as unknown as ComponentType<Kids & {
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  type?: 'button' | 'submit';
  form?: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  'aria-label'?: string;
}>;

export const Popover = PopoverJs as unknown as ComponentType<{ open?: boolean; onOpenChange?: (open: boolean) => void; children?: ReactNode }>;
export const PopoverTrigger = PopoverTriggerJs as unknown as ComponentType<{ asChild?: boolean; children?: ReactNode }>;
export const PopoverContent = PopoverContentJs as unknown as ComponentType<Kids & {
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  forceMount?: true;
  asChild?: boolean;
}>;

export const MenuItem = MenuItemJs as unknown as ComponentType<Kids & {
  icon?: ReactNode;
  sub?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  danger?: boolean;
  onClick?: () => void;
}>;
export const MenuSeparator = MenuSeparatorJs as unknown as ComponentType<{ className?: string }>;
export const menuContent: string = menuContentJs;

export const Sheet = SheetJs as unknown as ComponentType<Kids & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: string;
  footer?: ReactNode;
  dismissible?: boolean;
}>;
