import React from 'react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Badge } from '@/ui/Badge';
import { Switch } from '@/ui/Switch';
import { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem } from '@/ui/Select';
import { Card } from '@/ui/Card';
import { Separator } from '@/ui/Separator';
import PageHeader from '@/ui/PageHeader';

export default function LydianShowcase({ onBack }) {
  return (
    <div className="min-h-screen bg-[var(--ds-background-200)] pb-8">
      <PageHeader
        title="Lydian Design System"
        actions={<Button variant="secondary" size="sm" onClick={onBack}>Back to Settings</Button>}
      />

      <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-16">
        
        {/* Layer A: Tokens (Colors) */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-label-14 text-[var(--text-2)] uppercase tracking-widest font-bold">Colors & Functional Rules</h2>
            <p className="text-copy-14 text-[var(--text-1)]">The official 1–10 color system mapping raw scales to semantic UI roles.</p>
          </div>
          
          <div className="flex bg-[var(--bg-1)] border border-[var(--border-1)] rounded-md overflow-hidden h-24">
            {[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map(scale => (
              <div 
                key={scale}
                className="flex-1 flex flex-col items-center justify-end pb-2"
                style={{ backgroundColor: `var(--ds-gray-${scale})` }}
              >
                <span className={`text-[10px] uppercase font-mono ${scale > 500 ? 'text-[var(--ds-background-200)]' : 'text-[var(--text-1)]'}`}>
                  {scale / 100}
                </span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-md bg-[var(--bg-1)] border border-[var(--border-1)] text-[var(--text-1)] flex flex-col justify-between h-24">
              <span className="text-[10px] text-[var(--text-2)]">Color 1: BG</span>
              <span className="text-label-14-mono">--bg-1</span>
            </div>
            <div className="p-4 border border-[var(--border-1)] rounded-md bg-[var(--ds-background-100)] text-[var(--text-1)] flex flex-col justify-between h-24">
              <span className="text-[10px] text-[var(--text-2)]">Panel BG</span>
              <span className="text-label-14-mono">--ds-background-100</span>
            </div>
            <div className="p-4 border border-[var(--border-1)] rounded-md bg-[var(--ds-background-200)] text-[var(--text-1)] flex flex-col justify-between h-24">
              <span className="text-[10px] text-[var(--text-2)]">Global Page BG</span>
              <span className="text-label-14-mono">--ds-background-200</span>
            </div>
            <div className="p-4 rounded-md bg-[var(--text-1)] text-[var(--bg-1)] flex flex-col justify-between h-24">
              <span className="text-[10px]">Color 10: Primary Text</span>
              <span className="text-label-14-mono">--text-1</span>
            </div>
          </div>
        </section>

        <Separator />

        {/* Layer A: Typography */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-label-14 text-[var(--text-2)] uppercase tracking-widest font-bold">Typography</h2>
            <p className="text-copy-14 text-[var(--text-1)]">Geist Sans and Geist Mono typography hierarchy.</p>
          </div>
          <Card className="grid gap-6">
            <div>
              <h1 className="text-heading-32 text-[var(--text-1)] m-0">Heading 32 - Page Titles</h1>
              <p className="text-label-12-mono text-[var(--text-2)]">.text-heading-32</p>
            </div>
            <div>
              <h2 className="text-heading-24 text-[var(--text-1)] m-0">Heading 24 - Section Titles</h2>
              <p className="text-label-12-mono text-[var(--text-2)]">.text-heading-24</p>
            </div>
            <div>
              <p className="text-copy-14 text-[var(--text-1)] m-0 leading-relaxed">
                Copy 14 - Default body text. Geist is designed for precision and clarity. Vercel products use this for descriptions and regular content.
              </p>
              <p className="text-label-12-mono text-[var(--text-2)] mt-1">.text-copy-14</p>
            </div>
          </Card>
        </section>

        <Separator />

        {/* Layer B: Materials */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-label-14 text-[var(--text-2)] uppercase tracking-widest font-bold">Materials (Layouts)</h2>
            <p className="text-copy-14 text-[var(--text-1)]">Presets for radii, fills, strokes, and shadows based on standard vercel utility classes.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="material-panel p-6 flex flex-col gap-2">
              <h3 className="text-heading-16 text-[var(--text-1)] m-0">Material Panel</h3>
              <p className="text-copy-14 text-[var(--text-1)] m-0">A lower elevation surface used for minor items. Sharp 6px radius.</p>
              <span className="text-label-12-mono text-[var(--text-2)] mt-2">.material-panel</span>
            </div>
            <div className="material-card p-6 flex flex-col gap-2">
              <h3 className="text-heading-16 text-[var(--text-1)] m-0">Material Card</h3>
              <p className="text-copy-14 text-[var(--text-1)] m-0">A standard elevated container with a drop-shadow. Soft 12px radius.</p>
              <span className="text-label-12-mono text-[var(--text-2)] mt-2">.material-card</span>
            </div>
          </div>
        </section>

        <Separator />

        {/* Layer B: Atomic Components */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-label-14 text-[var(--text-2)] uppercase tracking-widest font-bold">Base UI Components</h2>
            <p className="text-copy-14 text-[var(--text-1)]">Atomic building blocks like buttons and inputs.</p>
          </div>
          <Card className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <h4 className="text-label-12-mono text-[var(--text-2)]">Buttons</h4>
              <div className="flex flex-wrap gap-4 items-center">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="brand">Brand</Button>
              </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-3">
              <h4 className="text-label-12-mono text-[var(--ds-gray-700)]">Forms</h4>
              <div className="grid gap-6 max-w-sm">
                <Input placeholder="Type something..." />
                <Select value="option">
                  <SelectTrigger><SelectValue placeholder="Dropdown" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup><SelectItem value="option">Selected Option</SelectItem></SelectGroup>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-3">
                  <Switch checked={true} />
                  <span className="text-copy-14">Switch Label</span>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <Separator />

        {/* Geist Button 2 Showcase */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-label-14 text-[var(--text-2)] uppercase tracking-widest font-bold">Button</h2>
            <p className="text-copy-14 text-[var(--text-1)]">
              The app&rsquo;s only button. Every variant and size below is what
              ships — see <code>src/ui/README.md</code> for when to reach for which.
            </p>
          </div>
          <Card className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <h4 className="text-label-12-mono text-[var(--text-2)]">Variants</h4>
              <div className="flex flex-wrap gap-4 items-center">
                <Button variant="brand">Brand</Button>
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="warning">Warning</Button>
                <Button variant="error">Error</Button>
                <Button variant="danger">Danger</Button>
              </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-4">
              <h4 className="text-label-12-mono text-[var(--text-2)]">Sizes</h4>
              <div className="flex flex-wrap gap-4 items-center">
                <Button variant="brand" size="xs">Extra small</Button>
                <Button variant="brand" size="sm">Small</Button>
                <Button variant="brand" size="md">Medium</Button>
                <Button variant="brand" size="lg">Large</Button>
              </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-4">
              <h4 className="text-label-12-mono text-[var(--text-2)]">States</h4>
              <div className="flex flex-wrap gap-4 items-center">
                <Button variant="brand" loading>Loading</Button>
                <Button variant="brand" disabled>Disabled</Button>
              </div>
            </div>
          </Card>
        </section>

        <Separator />

        {/* FAB Cluster & Popover */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-label-14 text-[var(--text-2)] uppercase tracking-widest font-bold">FAB Cluster & Popover</h2>
            <p className="text-copy-14 text-[var(--text-1)]">Floating action buttons used on the Dashboard for quick creation and search.</p>
          </div>
          <Card className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <h4 className="text-label-12-mono text-[var(--text-2)]">FAB Buttons</h4>
              <div className="flex flex-wrap gap-6 items-end">
                {/* Search FAB */}
                <div className="flex flex-col items-center gap-2">
                  <button className="w-11 h-11 rounded-full bg-[var(--bg-1)] border border-[var(--border-1)] shadow-lg flex items-center justify-center cursor-pointer hover:border-[var(--border-3)] transition-all duration-150">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-1)]">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  </button>
                  <span className="text-label-11 text-[var(--text-2)]">Search</span>
                </div>
                {/* Create FAB */}
                <div className="flex flex-col items-center gap-2">
                  <button className="w-14 h-14 rounded-full bg-[var(--ds-teal-900)] shadow-lg flex items-center justify-center cursor-pointer hover:opacity-90 transition-all duration-150 border-none">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  <span className="text-label-11 text-[var(--text-2)]">Create</span>
                </div>
              </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-3">
              <h4 className="text-label-12-mono text-[var(--text-2)]">Popover Menu</h4>
              <div className="flex flex-col gap-2 max-w-xs">
                <button className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-1)] border border-[var(--border-1)] shadow-lg cursor-pointer hover:border-[var(--border-3)] transition-all duration-150">
                  <span className="w-8 h-8 rounded-full bg-[var(--bg-2)] flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-1)]">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </span>
                  <span className="text-label-14 text-[var(--text-1)]">New Song</span>
                </button>
                <button className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-1)] border border-[var(--border-1)] shadow-lg cursor-pointer hover:border-[var(--border-3)] transition-all duration-150">
                  <span className="w-8 h-8 rounded-full bg-[var(--bg-2)] flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-1)]">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  </span>
                  <span className="text-label-14 text-[var(--text-1)]">New Setlist</span>
                </button>
              </div>
            </div>
          </Card>
        </section>

        <Separator />

        {/* Song Card Row Variant */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-label-14 text-[var(--text-2)] uppercase tracking-widest font-bold">Song Card Row</h2>
            <p className="text-copy-14 text-[var(--text-1)]">Compact row variant of the SongCard, used in the Dashboard's Recently Edited section.</p>
          </div>
          <div className="rounded-xl border border-[var(--border-1)] bg-[var(--bg-1)] overflow-hidden divide-y divide-[var(--border-1)]">
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer rounded-lg transition-colors duration-150 hover:bg-[var(--bg-2)]">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-label-14 text-[var(--text-1)] truncate">Amazing Grace</span>
                <span className="text-copy-13 text-[var(--text-2)] truncate">John Newton</span>
              </div>
              <div className="flex items-center gap-1.5 ml-4 shrink-0">
                <span className="text-label-12 text-[var(--chord)] font-semibold">G</span>
                <span className="text-[var(--text-2)] text-[10px]">•</span>
                <span className="text-label-12 text-[var(--text-2)]">120 BPM</span>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer rounded-lg transition-colors duration-150 hover:bg-[var(--bg-2)]">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-label-14 text-[var(--text-1)] truncate">How Great Is Our God</span>
                <span className="text-copy-13 text-[var(--text-2)] truncate">Chris Tomlin</span>
              </div>
              <div className="flex items-center gap-1.5 ml-4 shrink-0">
                <span className="text-label-12 text-[var(--chord)] font-semibold">A</span>
                <span className="text-[var(--text-2)] text-[10px]">•</span>
                <span className="text-label-12 text-[var(--text-2)]">78 BPM</span>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
