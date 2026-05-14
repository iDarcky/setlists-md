export default function BrandWordmark({ height = 22, accent = 'var(--color-brand)', className = '', style }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 600 140"
      role="img"
      aria-label="setlists.md"
      className={className}
      style={{ height, width: 'auto', display: 'block', ...style }}
    >
      <text
        x="0"
        y="100"
        fontFamily="Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontWeight="600"
        fontSize="104"
        letterSpacing="-3"
        fill="currentColor"
      >
        setlists
        <tspan
          fontFamily="'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          letterSpacing="-2"
          fill={accent}
        >
          .md
        </tspan>
      </text>
    </svg>
  );
}
