"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

// Mermaid has global configuration: serialize rendering so different diagrams/themes cannot race.
let renderQueue: Promise<unknown> = Promise.resolve();
export function MermaidDiagram({ text, label }: { text: string; label: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, ""),
    [svg, setSvg] = useState(""),
    [error, setError] = useState(false),
    [fullSize, setFullSize] = useState(false),
    [theme, setTheme] = useState("");
  const drawing = useRef<HTMLDivElement>(null),
    fullDrawing = useRef<HTMLDivElement>(null),
    fullScroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!svg) return;
    let frame: number | null = null;
    const layout = () => {
      const element = (fullSize ? fullDrawing : drawing).current?.querySelector("svg");
      if (!element) {
        frame = requestAnimationFrame(layout);
        return;
      }
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
      element.style.maxWidth = "none";
      element.style.width = fullSize ? `${width}px` : "100%";
      element.style.height = "auto";
      element.setAttribute("preserveAspectRatio", "xMinYMin meet");
      element.setAttribute("width", String(width));
      if (fullSize && fullScroller.current) {
        fullScroller.current.scrollLeft = 0;
        fullScroller.current.scrollTop = 0;
      }
      element.setAttribute("data-layout-ready", "true");
    };
    layout();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [svg, fullSize]);
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
          state: { wrappingWidth: 1000, nodeSpacing: 90, rankSpacing: 110 },
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
    <div className="min-w-0">
      <div className="min-w-0" role="img" aria-label={label} data-theme-rendered={theme}>
        {error ? (
          <p className="type-body-sm text-danger">
            The diagram could not be drawn. The transition table below lists the same rules.
          </p>
        ) : svg && !fullSize ? (
          <div
            ref={drawing}
            className="min-w-0 [&_svg]:block"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: only our generated diagrams, sanitized by Mermaid strict mode.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : !fullSize ? (
          <output className="type-body-sm text-ink-muted">Drawing diagram…</output>
        ) : null}
      </div>
      {svg && !error && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => setFullSize(true)}
        >
          Open full size
        </Button>
      )}
      <Dialog open={fullSize} onOpenChange={setFullSize}>
        <DialogContent className="flex h-[85vh] w-[90vw] max-w-[90vw] flex-col sm:max-w-[90vw]">
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription className="sr-only">
            Scroll to inspect the full-size diagram.
          </DialogDescription>
          <section
            ref={fullScroller}
            className="min-h-0 flex-1 overflow-auto"
            aria-label={`${label} full size`}
          >
            {fullSize && (
              <div
                ref={fullDrawing}
                className="w-max [&_svg]:block"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: only our generated diagrams, sanitized by Mermaid strict mode.
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}
          </section>
        </DialogContent>
      </Dialog>
    </div>
  );
}
