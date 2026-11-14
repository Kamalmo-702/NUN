import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Close, Menu, Moon, NunMark, Sun } from "./Icons";

export const ROUTES = [
  { path: "/", label: "Story", title: "The Story of NUN" },
  { path: "/overview", label: "Overview", title: "Lake Chad at a Glance" },
  { path: "/history", label: "Water History", title: "Understanding Change Through Time" },
  { path: "/pools", label: "Pool Intelligence", title: "Two Pools. A More Complete Picture." },
  { path: "/seasonal", label: "Seasonal Anomaly", title: "Understanding the Seasonal Signal" },
  { path: "/forecast", label: "Forecast", title: "Looking Beyond the Historical Record" },
  { path: "/evidence", label: "Evidence & Trust", title: "Show the Evidence" },
  { path: "/discoveries", label: "Discoveries", title: "What the Data Reveals" },
  { path: "/downloads", label: "Downloads", title: "Explore the Underlying Results" },
] as const;

export function useRoute(): string {
  const read = () => {
    const h = window.location.hash.replace(/^#/, "");
    return ROUTES.some((r) => r.path === h) ? h : "/";
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function Header({ route, theme, onTheme }: { route: string; theme: "light" | "dark"; onTheme: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [route]);
  return (
    <header className="site-header">
      <div className="wrap">
        <a className="brand" href="#/" aria-label="NUN — Lake Chad Water Intelligence, home">
          <NunMark size={26} /> NUN
        </a>
        <nav id="nav" className={open ? "nav open" : "nav"} aria-label="Primary">
          {ROUTES.map((r) => (
            <a key={r.path} href={`#${r.path}`} aria-current={route === r.path ? "page" : undefined}>{r.label}</a>
          ))}
        </nav>
        <div className="header-tools">
          <button className="icon-btn" onClick={onTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
          <button className="icon-btn menu-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="nav" aria-label="Menu">
            {open ? <Close /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {children && <p className="lede">{children}</p>}
    </div>
  );
}

export function JourneyNav({ route }: { route: string }) {
  const i = ROUTES.findIndex((r) => r.path === route);
  const prev = ROUTES[i - 1];
  const next = ROUTES[i + 1];
  return (
    <nav className="journey" aria-label="Continue through NUN">
      {prev ? <a href={`#${prev.path}`}><small>Previous</small><strong><ArrowLeft /> {prev.label}</strong></a> : <span />}
      {next ? <a href={`#${next.path}`}><small>Next</small><strong>{next.label} <ArrowRight /></strong></a> : <span />}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <a className="brand" href="#/"><NunMark size={22} /> NUN</a>
        <span>Historical archive, 2001–2020. Last archived observation: May 2020. Not a live monitoring system.</span>
      </div>
    </footer>
  );
}
