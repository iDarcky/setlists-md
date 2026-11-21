/** Only a phone in the browser needs this step: an iPad, a computer or the
 *  installed app skip it (QA 21 Nov: "drop it or improve it"). */
export function phoneInBrowser(win = globalThis.window) {
  if (!win?.matchMedia) return false;
  const standalone = win.matchMedia('(display-mode: standalone)').matches || win.navigator?.standalone === true;
  const coarse = win.matchMedia('(pointer: coarse)').matches;
  const shortSide = Math.min(win.screen?.width || 0, win.screen?.height || 0);
  return !standalone && coarse && shortSide > 0 && shortSide < 600;
}
