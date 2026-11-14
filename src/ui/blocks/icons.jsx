// Our own stroke icons for the Bencho blocks, standing in for lucide-react
// (which the app does not use). Same names as the lucide icons the blocks
// were written against, so the ported code reads the same.
//
// The stroke is OURS, not the caller's: outline icons draw at 1.8, small
// glyphs (plus, minus, cross, check) at 2, matching src/app/navIcons.jsx.
// A `strokeWidth` passed by the original block code is ignored on purpose.

const base = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' };

const make = (paths, stroke = 1.8) => {
  function Icon({ size = 20, className, style, 'aria-hidden': hidden = true }) {
    return (
      <svg width={size} height={size} strokeWidth={stroke} className={className} style={style} aria-hidden={hidden} {...base}>
        {paths}
      </svg>
    );
  }
  return Icon;
};

export const Plus = make(<path d="M12 5v14M5 12h14" />, 2);
export const Minus = make(<path d="M5 12h14" />, 2);
export const X = make(<path d="M6 6l12 12M18 6 6 18" />, 2);
export const Check = make(<path d="M5 12.5l4.5 4.5L19 7.5" />, 2);
export const Search = make(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const Eye = make(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>);
export const EyeOff = make(<><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.6 3.4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" /></>);
export const FileText = make(<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>);
export const Music = make(<><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>);
export const ListIcon = make(<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />);
export const House = make(<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />);
export const Calendar = make(<><rect x="3" y="4.5" width="18" height="17" rx="3" /><path d="M8 2.5v4M16 2.5v4M3 10h18" /></>);
export const User = make(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>);
export const CircleCheck = make(<><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></>);
export const CircleX = make(<><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>);
export const Info = make(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>);
export const TriangleAlert = make(<><path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>);
