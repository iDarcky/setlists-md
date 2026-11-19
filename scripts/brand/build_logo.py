"""Build the Setlists.md logo files: the taped setlist sheet.

The mark: a cream sheet, tilted -6 degrees, with three song lines written in
brand green and a strip of gold tape (+4 degrees, torn ends) across its top
edge, with an even gap cut around the tape. Masks are baked into plain paths,
so every file works anywhere (img tags, favicons, print).

Run:  python3 scripts/brand/build_logo.py      (needs: pip install shapely)
Then: node scripts/brand/render_icons.cjs      (PNG icons + link previews)
Writes the same files into public/ (app) and website/ (marketing site).
"""
import os
from shapely.geometry import Polygon, box
from shapely import affinity

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = [os.path.join(ROOT, 'public'), os.path.join(ROOT, 'website')]

GREEN, GOLD, CREAM, INK, TILE = '#53796F', '#E2A832', '#F3EFE8', '#11100E', '#1A1816'
RIM = '#CFC7B9'  # hairline under the sheet so it holds up on light pages

def rrect(x, y, w, h, r):
    return box(x + r, y + r, x + w - r, y + h - r).buffer(r, quad_segs=12)

def sheet_rot(g): return affinity.rotate(g, -6, origin=(128, 136))
def tape_rot(g): return affinity.rotate(g, 4, origin=(128, 50))

TORN = Polygon([(90, 33), (166, 33), (160, 41.5), (166, 50), (160, 58.5), (166, 67),
                (90, 67), (96, 58.5), (90, 50), (96, 41.5)])
PLAIN = box(90, 33, 166, 67)
LINES = [(88, 104, 80), (88, 140, 64), (88, 176, 74)]
LINES_SMALL = [(86, 100, 84), (86, 142, 66), (86, 184, 76)]

def d(geom):
    polys = getattr(geom, 'geoms', [geom])
    out = []
    for p in polys:
        for ring in [p.exterior, *p.interiors]:
            pts = list(ring.coords)[:-1]
            out.append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z')
    return ''.join(out)

def parts(small=False):
    tape = tape_rot(PLAIN if small else TORN)
    gap = tape.buffer(7, join_style='round')
    sheet = sheet_rot(rrect(64, 50, 128, 172, 14)).difference(gap)
    lh = 24 if small else 18
    lines = [sheet_rot(rrect(x, y, w, lh, lh / 2)) for x, y, w in (LINES_SMALL if small else LINES)]
    lines = lines[0].union(lines[1]).union(lines[2]).difference(gap)
    return sheet, lines, tape.buffer(1, join_style='round')

def mark_body(small=False, rim=False, sheet_fill=CREAM):
    sheet, lines, tape = parts(small)
    rim_path = f'<path d="{d(sheet.buffer(2.5, join_style="round"))}" fill="{RIM}"/>' if rim else ''
    return (f'{rim_path}<path d="{d(sheet)}" fill="{sheet_fill}"/>'
            f'<path d="{d(lines)}" fill="{GREEN}"/><path d="{d(tape)}" fill="{GOLD}"/>')

def svg(body, size=256, label='Setlists.md'):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" role="img" '
            f'aria-label="{label}"><title>{label}</title>{body}</svg>\n')

def on_tile(body, rx=56, scale=0.796875, fill=TILE, full=False):
    bg = f'<rect width="256" height="256" fill="{fill}"/>' if full else f'<rect width="256" height="256" rx="{rx}" fill="{fill}"/>'
    t = 128 - 128 * scale
    return f'{bg}<g transform="translate({t:.2f} {t - 6:.2f}) scale({scale})">{body}</g>'

FILES = {
    # The mark on its own, transparent. Works on dark and light (hairline rim).
    'setlists-md-mark.svg': svg(mark_body(rim=True), label='Setlists.md'),
    # Browser tab: the small-size cut on a warm-black tile, readable on any tab bar.
    'favicon.svg': svg(on_tile(mark_body(small=True), rx=56, scale=0.86), label='Setlists.md'),
    # App icon master (warm-black tile), and the full-bleed one for masks/iOS.
    'setlists-md-icon.svg': svg(on_tile(mark_body()), label='Setlists.md app icon'),
    # iOS rounds the corners itself, so its icon is a full-bleed square.
    'setlists-md-icon-full.svg': svg(on_tile(mark_body(), scale=0.8, full=True), label='Setlists.md app icon'),
    'setlists-md-icon-maskable.svg': svg(on_tile(mark_body(), scale=0.62, full=True), label='Setlists.md app icon'),
}

def lockup(text_fill, md_fill):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 160" role="img" aria-label="Setlists.md">'
            '<title>Setlists.md</title>'
            f'<g transform="translate(0 0) scale(0.625)">{mark_body(rim=True)}</g>'
            f'<text x="176" y="103" font-family="Geist, ui-sans-serif, system-ui, -apple-system, \'Segoe UI\', sans-serif" '
            f'font-weight="600" font-size="96" letter-spacing="-3" fill="{text_fill}">setlists<tspan '
            f'font-family="\'Geist Mono\', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" '
            f'letter-spacing="-2" fill="{md_fill}">.md</tspan></text></svg>\n')

def badge_body():
    # Android notification badge: one-colour white silhouette, lines cut out.
    sheet, lines, tape = parts(small=True)
    return f'<path d="{d(sheet.difference(lines))}" fill="#fff"/><path d="{d(tape)}" fill="#fff"/>'

FILES['setlists-md-badge.svg'] = svg(badge_body(), label='Setlists.md')
FILES['setlists-md-lockup.svg'] = lockup('#0a0807', GREEN)
FILES['setlists-md-lockup-dark.svg'] = lockup(CREAM, '#7AA89C')

if __name__ == '__main__':
    app_only = {'setlists-md-icon-full.svg', 'setlists-md-icon-maskable.svg', 'setlists-md-badge.svg'}
    for out in OUT:
        for name, body in FILES.items():
            if out.endswith('website') and name in app_only:
                continue
            with open(os.path.join(out, name), 'w') as f:
                f.write(body)
    print('wrote', ', '.join(FILES), 'into', ', '.join(os.path.relpath(o, ROOT) for o in OUT))
