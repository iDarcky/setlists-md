import { sectionStyle } from '@/music';

/**
 * "Pick a section type", in one place.
 *
 * It lived inside `ArrangeTabV2` as a local helper serving that file's three
 * menus — the type picker, the play-order "+ Add", and the bottom "+ Add
 * section". Element 6/7 added a fourth caller in the Reader ("add a section"
 * from edit mode) and the owner's instruction was not to build a second one:
 * *"don't do type a name, reuse the section part from the song editor, why
 * not?"* — so it moved here rather than being copied.
 *
 * Why it matters beyond DRY: **each item wears its own section colour**, and
 * that colour is the same one the chart heading and the structure ribbon draw
 * (`sectionStyle`). A picker that named the types in plain grey would be the one
 * place in the app where a Chorus is not pink — you would be choosing a thing
 * you could not recognise. It is also self-maintaining: a user's invented type
 * gets its colour from the same call, so custom types look native in every menu.
 */
export function SectionTypeMenuItems({ options, current, customSectionTypes, onPick }) {
  return options.map(t => {
    const st = sectionStyle(t, null, customSectionTypes);
    return (
      <button
        key={t}
        type="button"
        onClick={() => { if (t !== current) onPick(t); }}
        className="w-full text-left px-3 py-2 text-label-13 font-bold uppercase tracking-wider cursor-pointer bg-transparent border-none hover:bg-[var(--ds-gray-alpha-100)]"
        style={{ color: st.b }}
      >
        {t}
      </button>
    );
  });
}
