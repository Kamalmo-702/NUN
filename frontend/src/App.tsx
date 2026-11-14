import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { Footer, Header, useRoute } from "./components/Layout";

const pages = {
  "/": lazy(() => import("./pages/Story")),
  "/overview": lazy(() => import("./pages/Overview")),
  "/history": lazy(() => import("./pages/History")),
  "/pools": lazy(() => import("./pages/Pools")),
  "/seasonal": lazy(() => import("./pages/Seasonal")),
  "/forecast": lazy(() => import("./pages/Forecast")),
  "/evidence": lazy(() => import("./pages/Evidence")),
  "/discoveries": lazy(() => import("./pages/Discoveries")),
  "/downloads": lazy(() => import("./pages/Downloads")),
} as const;

export default function App() {
  const route = useRoute();
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("nun-theme", theme); } catch { /* storage unavailable */ }
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  const Page = pages[route as keyof typeof pages] ?? pages["/"];

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Header route={route} theme={theme} onTheme={toggle} />
      <main id="main" key={route} className="page">
        <Suspense fallback={<div className="wrap section"><div className="skeleton" style={{ height: 320 }}><span /></div></div>}>
          <Page route={route} />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
