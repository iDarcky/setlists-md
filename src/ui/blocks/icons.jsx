// Lucide icons (lucide-react, ISC) at OUR stroke. The Bencho blocks were written
// against lucide, so they import from here by the same names; this layer only
// sets the stroke the app uses everywhere: 1.8 for outline icons, 2 for the
// small glyphs (plus, minus, cross, check), matching src/app/navIcons.jsx.
// A `strokeWidth` passed by the original block code is ignored on purpose.
import {
  Calendar as LCalendar, Check as LCheck, CircleCheck as LCircleCheck, CircleX as LCircleX,
  Eye as LEye, EyeOff as LEyeOff, FileText as LFileText, House as LHouse, Info as LInfo,
  List as LList, Minus as LMinus, Music as LMusic, Plus as LPlus, Search as LSearch,
  TriangleAlert as LTriangleAlert, User as LUser, X as LX,
} from 'lucide-react';

const at = (Icon, stroke = 1.8) => {
  function Stroked({ strokeWidth: _ignored, size = 20, ...props }) {
    return <Icon size={size} strokeWidth={stroke} aria-hidden="true" {...props} />;
  }
  return Stroked;
};

export const Plus = at(LPlus, 2);
export const Minus = at(LMinus, 2);
export const X = at(LX, 2);
export const Check = at(LCheck, 2);
export const Search = at(LSearch);
export const Eye = at(LEye);
export const EyeOff = at(LEyeOff);
export const FileText = at(LFileText);
export const Music = at(LMusic);
export const ListIcon = at(LList);
export const House = at(LHouse);
export const Calendar = at(LCalendar);
export const User = at(LUser);
export const CircleCheck = at(LCircleCheck);
export const CircleX = at(LCircleX);
export const Info = at(LInfo);
export const TriangleAlert = at(LTriangleAlert);
