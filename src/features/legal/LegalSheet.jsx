import { useMemo, useState } from 'react';
import { Sheet } from '@/ui/shadcn/sheet';
import { SOURCES, TITLES, renderMarkdown } from './legalDocs';

const SHEET_CLASSES = {
  code: 'rounded bg-raised px-1.5 py-0.5 font-mono text-[0.9em]',
  a: 'text-link underline-offset-4 hover:underline',
  // The sheet's own header already names the document.
  h1: 'sr-only',
  h2: 'mt-4 mb-0 text-[15px] font-semibold leading-[23px]',
  h3: 'mt-3 mb-0 text-[15px] font-semibold leading-[23px]',
  meta: 'm-0 text-caption text-muted-foreground',
  ul: 'my-0 flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-[23px]',
  p: 'm-0 text-[15px] leading-[23px]',
};

/**
 * Terms / Privacy without leaving the form: a drawer on a phone, a dialog from
 * the iPad up. `doc` null = closed.
 */
export default function LegalSheet({ doc, onClose }) {
  // Keep the last document while the sheet animates closed.
  const [shown, setShown] = useState(doc);
  if (doc && doc !== shown) setShown(doc);
  const body = useMemo(() => (shown ? renderMarkdown(SOURCES[shown] || '', SHEET_CLASSES) : null), [shown]);
  return (
    <Sheet open={!!doc} onOpenChange={(open) => { if (!open) onClose?.(); }} title={TITLES[shown] || ''}>
      <article className="flex flex-col gap-3 text-foreground">{body}</article>
    </Sheet>
  );
}
