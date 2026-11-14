import type { SVGProps } from "react";
const base = (p: SVGProps<SVGSVGElement>) => ({ width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p });
export const ArrowRight = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const ArrowLeft = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
export const Sun = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
export const Moon = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></svg>;
export const Menu = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const Close = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const Download = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>;
export const Check = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

/** The hieroglyph for water (n): three zigzag lines. Used as the NUN mark and as a divider. */
export const NunMark = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9l4.2-3.6L11.4 9l4.2-3.6L19.8 9l4.2-3.6L28 9" />
    <path d="M3 17l4.2-3.6L11.4 17l4.2-3.6L19.8 17l4.2-3.6L28 17" />
    <path d="M3 25l4.2-3.6L11.4 25l4.2-3.6L19.8 25l4.2-3.6L28 25" />
  </svg>
);
