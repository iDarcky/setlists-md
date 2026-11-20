// The shared JavaScript parts the new first-run screens use, typed once here
// for the props they pass. When src/ui moves to TypeScript these casts go away.
import type { ComponentType, FocusEvent, ChangeEvent, ReactNode } from 'react';
import { Button as ButtonJs } from '@/ui/shadcn/button';
import { Alert as AlertJs } from '@/ui/shadcn/alert';
import { Badge as BadgeJs } from '@/ui/shadcn/badge';
import { Card as CardJs, CardLabel as CardLabelJs } from '@/ui/shadcn/card';
import { Spinner as SpinnerJs } from '@/ui/shadcn/spinner';
import { LabelInput as LabelInputJs } from '@/ui/blocks/LabelInput';
import { OneTimeCode as OneTimeCodeJs } from '@/ui/blocks/OneTimeCode';
import * as Layout from '@/features/auth/AuthLayout';

type Kids = { children?: ReactNode; className?: string };

export const Button = ButtonJs as unknown as ComponentType<Kids & {
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  type?: 'button' | 'submit';
  form?: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
}>;

export const Alert = AlertJs as unknown as ComponentType<Kids & { variant?: 'info' | 'success' | 'danger' | 'warning' }>;
export const Badge = BadgeJs as unknown as ComponentType<Kids & { variant?: 'selected' | 'neutral' | 'outline' | 'danger' }>;
export const Card = CardJs as unknown as ComponentType<Kids>;
export const CardLabel = CardLabelJs as unknown as ComponentType<Kids>;
export const Spinner = SpinnerJs as unknown as ComponentType<{ className?: string }>;

export const LabelInput = LabelInputJs as unknown as ComponentType<{
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  fill?: boolean;
  type?: string;
  name?: string;
  inputMode?: 'email' | 'text' | 'url';
  autoComplete?: string;
  autoCapitalize?: string;
  autoFocus?: boolean;
  maxLength?: number;
  error?: string | null;
  hint?: string;
}>;

export const OneTimeCode = OneTimeCodeJs as unknown as ComponentType<{
  length?: 4 | 6;
  letters?: boolean;
  answer?: 'Accept' | 'Reject' | null;
  onFull?: (code: string) => void;
  onCodeChange?: (code: string) => void;
  label?: string;
}>;

export const AuthLayout = Layout.AuthLayout as unknown as ComponentType<Kids & { onBack?: () => void; embedded?: boolean }>;
export const AuthHeader = Layout.AuthHeader as unknown as ComponentType<{
  mark?: ReactNode; eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; size?: 'title' | 'display';
}>;
export const AuthActions = Layout.AuthActions as unknown as ComponentType<Kids>;
export const TextLink = Layout.TextLink as unknown as ComponentType<{ question: string; answer: string; onClick?: () => void }>;
export const LogoMark = Layout.LogoMark as unknown as ComponentType<{ size?: number; className?: string }>;
export const ChurchBadge = Layout.ChurchBadge as unknown as ComponentType<{
  name?: string | null; logoUrl?: string | null; initials?: string | null; quiet?: boolean;
}>;
export const SuccessBadge = Layout.SuccessBadge as unknown as ComponentType<Record<string, never>>;
