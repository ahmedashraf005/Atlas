"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

// Mermaid has global configuration: serialize rendering so different diagrams/themes cannot race.
let renderQueue: Promise<unknown> = Promise.resolve();
export function MermaidDiagram({ text, label }: { text: string; label: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, ""),
    [svg, setSvg] = useState(""),
    [error, setError] = useState(false),
    [theme, setTheme] = useState("");
  const drawing = useRef<HTMLDivElement>(null),
    scroller = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!svg) return;
    const element = drawing.current?.querySelector("svg");
    if (!element) return;
    // Geometry must be synchronous, including the global reduced-motion transition duration.
    element.style.transition = "none";
    // Mermaid measures in a temporary container. Fit the actual mounted content before paint.
    const bounds = element.getBBox(),
      padding = 12,
      width = bounds.width + padding * 2,
      height = bounds.height + padding * 2;
    element.setAttribute(
      "viewBox",
      `${bounds.x - padding} ${bounds.y - padding} ${width} ${height}`,
    );
    element.style.maxWidth = `${width}px`;
    // Keep labels readable; the surrounding region scrolls wide diagrams on small screens.
    element.setAttribute("width", String(width));
    const firstNode = element.querySelector(".state-start, .node"),
      region = scroller.current;
    if (firstNode && region) {
      const start = firstNode.getBoundingClientRect();
      region.scrollLeft = Math.max(
        0,
        region.scrollLeft +
          start.left +
          start.width / 2 -
          region.getBoundingClientRect().left -
          region.clientWidth / 2,
      );
    }
    element.setAttribute("data-layout-ready", "true");
  }, [svg]);
  useEffect(() => {
    const update = () => setTheme(document.documentElement.dataset.theme ?? "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!theme) return;
    let active = true;
    const styles = getComputedStyle(document.documentElement),
      colour = (name: string) => styles.getPropertyValue(`--${name}`).trim();
    renderQueue = renderQueue
      .catch(() => undefined)
      .then(async () => {
        if (!active) return;
        const mermaid = (await import("mermaid")).default;
        // Font metrics must settle before Mermaid measures nodes and its SVG viewport.
        await document.fonts.ready;
        if (!active) return;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          htmlLabels: false,
          fontFamily: getComputedStyle(document.body).fontFamily,
          state: { wrappingWidth: 320 },
          themeVariables: {
            darkMode: theme === "dark",
            background: colour("surface"),
            primaryColor: colour("surface-sunken"),
            primaryTextColor: colour("ink"),
            primaryBorderColor: colour("line-strong"),
            lineColor: colour("ink-muted"),
            secondaryColor: colour("atlas-green-soft"),
            tertiaryColor: colour("surface"),
            textColor: colour("ink"),
            mainBkg: colour("surface"),
            nodeBorder: colour("line-strong"),
            clusterBkg: colour("surface-sunken"),
            clusterBorder: colour("line-strong"),
            edgeLabelBackground: colour("surface"),
            nodeTextColor: colour("ink"),
          },
        });
        const result = await mermaid.render(`atlasDiagram${id}`, text);
        if (active) {
          setSvg(result.svg);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [text, id, theme]);
  return (
    <section
      ref={scroller}
      aria-label={`${label} diagram`}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard scrolling is required for this labelled overflow region, including Safari.
      tabIndex={0}
      className="min-w-0 overflow-x-auto focus-visible:outline-2 focus-visible:outline-focus-ring"
    >
      <div className="min-w-0" role="img" aria-label={label} data-theme-rendered={theme}>
        {error ? (
          <p className="type-body-sm text-danger">
            The diagram could not be drawn. The transition table below lists the same rules.
          </p>
        ) : svg ? (
          <div
            ref={drawing}
            className="[&_svg]:h-auto"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: only our generated diagrams, sanitized by Mermaid strict mode.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <output className="type-body-sm text-ink-muted">Drawing diagram…</output>
        )}
      </div>
    </section>
  );
}
