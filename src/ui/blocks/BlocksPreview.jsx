import { useState } from 'react';
import { RollingCounter } from './RollingCounter';
import { LabelInput } from './LabelInput';
import { CreateMenu } from './CreateMenu';
import { OneTimeCode } from './OneTimeCode';
import { Search } from './Search';
import { MagnifyingDock } from './MagnifyingDock';
import { ToastStack } from './ToastStack';
import './tokens.css';

// A page for trying the Bencho blocks on a real phone before any screen uses
// them. Open the app with `?blocks` (e.g. the Vercel preview of this branch).
// Nothing in the app links here; main.jsx mounts it instead of <App /> only
// when the query flag is present, and loads it lazily so the app's own bundle
// does not grow.

function Block({ name, note, children }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 text-[12px] font-semibold uppercase leading-4 tracking-[0.06em] text-muted-foreground">{name}</h2>
        {note && <p className="m-0 text-small text-muted-foreground">{note}</p>}
      </div>
      <div className="flex min-h-[120px] items-center justify-center overflow-hidden rounded-card border border-border bg-background p-6">{children}</div>
    </section>
  );
}

export default function BlocksPreview() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const flip = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
  };
  const [count, setCount] = useState(128);

  return (
    <div className="blk-preview h-dvh overflow-y-auto bg-background text-foreground font-sans">
      <div className="mx-auto flex max-w-[560px] flex-col gap-8 px-4 pb-24 pt-[max(24px,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="m-0 text-title">Blocks</h1>
            <p className="m-0 text-small text-muted-foreground">From Bencho, in our colours, corners and icons.</p>
          </div>
          <button type="button" onClick={flip} className="h-11 rounded-control border border-input bg-transparent px-4 text-small font-semibold text-foreground">
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </header>

        <Block name="Toast stack" note="Tap (or hover) to fan out. × dismisses one, Retry fixes the PDF in place. Peek 9, gap 10.">
          <ToastStack />
        </Block>
        <Block name="Rolling counter" note={`Tap or hold − and +, or drag the number up and down. Now ${count}.`}>
          <RollingCounter start={128} onChange={setCount} />
        </Block>
        <Block name="Label input" note="The label lifts into the edge when you focus.">
          <div className="flex flex-col gap-4">
            <LabelInput field="Email" />
            <LabelInput field="Password" />
          </div>
        </Block>
        <Block name="Create menu" note="Our three: new song, import PDFs, new setlist.">
          <CreateMenu />
        </Block>
        <Block name="One-time code" note="Type any 4 digits.">
          <OneTimeCode length={4} answer="Accept" />
        </Block>
        <Block name="Search" note="Tap to open. Give 50, spring 25.">
          <Search />
        </Block>
        <Block name="Dock" note="Magnify 1.0x, lift 5px, reach 2.">
          <MagnifyingDock />
        </Block>
      </div>
    </div>
  );
}
