/** The brand mark: a mortarboard whose tassel resolves into a checkmark.
 *
 *  Only the icon lives here as SVG. The wordmark is deliberately real HTML
 *  text rather than <text> inside the SVG: the source file sets it in
 *  Georgia, which Windows and macOS have but most Linux/Android systems do
 *  not, so an SVG-embedded wordmark would silently substitute a wider serif
 *  and overrun its viewBox. As markup it renders correctly everywhere, stays
 *  selectable, and scales with the rest of the type.
 *
 *  The full lockup (icon + wordmark + tagline, exactly as supplied) lives at
 *  /logo.svg and is used where there's room for it — see the auth pages.
 */

const NAVY = "#163A5F";
const ACCENT = "#E8772E";

/** Icon only. `inverse` swaps the navy for white so it stays visible on the
 *  blue band — navy on navy would disappear. */
export function LogoMark({ size = 32, inverse = false, className = "" }) {
  const body = inverse ? "#FFFFFF" : NAVY;
  const shadow = inverse ? "rgba(255,255,255,0.72)" : "#0F2A45";

  return (
    // Cropped to the artwork: the supplied file is a 640x190 lockup, and this
    // window is the square around the icon within it.
    <svg
      viewBox="5 5 150 150"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="UK Uni Match"
    >
      <polygon points="80,26 150,61 80,96 10,61" fill={body} />
      <path d="M 52,68 L 108,68 L 100,96 L 60,96 Z" fill={shadow} />
      <circle cx="80" cy="61" r="5.5" fill={ACCENT} />
      <path
        d="M 80,61 C 96,82 104,100 106,120"
        fill="none"
        stroke={ACCENT}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M 94,122 L 105,134 L 126,104"
        fill="none"
        stroke={ACCENT}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Icon plus wordmark, for headers and footers. */
export default function Logo({
  size = 30,
  inverse = false,
  tagline = false,
  className = "",
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} inverse={inverse} />
      <span className="leading-none">
        <span
          className="block font-[family-name:var(--font-logo)] font-bold tracking-tight"
          style={{ fontSize: size * 0.58 }}
        >
          UK Uni Match
        </span>
        {tagline && (
          <span
            className="block font-[family-name:var(--font-logo)] uppercase text-text-muted mt-1"
            style={{ fontSize: size * 0.24, letterSpacing: "0.18em" }}
          >
            Find your best-fit university
          </span>
        )}
      </span>
    </span>
  );
}
