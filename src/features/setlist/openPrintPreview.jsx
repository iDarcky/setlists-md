import { createRoot } from 'react-dom/client';
import { PrintPreviewView } from './PrintPreview';

let host = null;

/** Mount the preview over the app. One at a time. */
export function openPrintPreview({ title, charts, build }) {
  host?.unmount();
  document.getElementById('print-preview-root')?.remove();
  const el = document.createElement('div');
  el.id = 'print-preview-root';
  document.body.appendChild(el);
  const root = createRoot(el);
  const close = () => { root.unmount(); el.remove(); if (host === root) host = null; };
  host = root;
  root.render(<PrintPreviewView title={title} charts={charts} build={build} onClose={close} />);
}
