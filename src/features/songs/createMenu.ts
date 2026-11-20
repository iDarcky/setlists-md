import { FileText, List, Music } from 'lucide-react';
import type { CreateItem } from '@/ui/shadcn/create-button';

/**
 * The + menu's rows, the same on Home and Songs: New song, Import PDFs, then
 * New setlist under a line. A missing handler drops its row.
 */
export function createMenu({ onNewSong, onImport, onNewSetlist }: {
  onNewSong?: (() => void) | null;
  onImport?: (() => void) | null;
  onNewSetlist?: (() => void) | null;
}): CreateItem[] {
  const items: CreateItem[] = [];
  if (onNewSong) items.push({ icon: Music, label: 'New song', onSelect: onNewSong });
  if (onImport) items.push({ icon: FileText, label: 'Import PDFs', onSelect: onImport });
  if (onNewSetlist) items.push({ icon: List, label: 'New setlist', onSelect: onNewSetlist, divider: true });
  return items;
}
