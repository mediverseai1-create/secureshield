import Link from "next/link";

/** Compact icon: a navy square holding a stepped "S" with one amber marker at the boundary. Also used as the favicon. */
export function LogoMark({ size = 32, inverted = false, className = "" }: { size?: number; inverted?: boolean; className?: string }) {
  const bg = inverted ? "#FCFAF5" : "#0B1F3A";
  const fg = inverted ? "#0B1F3A" : "#FCFAF5";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role="img" aria-label="SecureShield AI">
      <rect width="32" height="32" rx="6" fill={bg} />
      <path d="M22 9.5H10.5V16H21.5V22.5H10" fill="none" stroke={fg} strokeWidth="3.2" strokeLinejoin="miter" />
      <rect x="21" y="7.9" width="4.4" height="3.2" fill="#F0B429" />
    </svg>
  );
}

/** Navigation / authentication wordmark. `tone="dark"` is for use on navy backgrounds. */
export function Logo({ href = "/", tone = "light", size = "md" }: { href?: string | null; tone?: "light" | "dark"; size?: "md" | "lg" }) {
  const textCls = tone === "dark" ? "text-paper-light" : "text-ink";
  const aiCls = tone === "dark" ? "text-gold" : "text-gold-deep";
  const inner = (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size === "lg" ? 40 : 30} inverted={tone === "dark"} />
      <span className={`font-serif ${size === "lg" ? "text-2xl" : "text-xl"} leading-none font-semibold tracking-tight ${textCls}`}>
        SecureShield <span className={aiCls}>AI</span>
      </span>
    </span>
  );
  return href ? (
    <Link href={href} aria-label="SecureShield AI home">
      {inner}
    </Link>
  ) : (
    inner
  );
}
