import { useLayoutEffect, useState } from "react";

/**
 * Map matchId (or synthetic outbound id) → DOM element anchor for connector ends.
 * @param {import("./bracketLayout.js").BracketConnectorEdge[]} edges
 * @param {Record<string, HTMLElement | null>} anchors
 * @param {HTMLElement | null} root
 * @returns {{ d: string }[]}
 */
function buildPathsFromAnchors(edges, anchors, root) {
  if (!root || !edges.length) return [];

  const rr = root.getBoundingClientRect();

  function connectorPoint(el, side) {
    const r = el.getBoundingClientRect();
    const midY = r.top + r.height / 2 - rr.top;
    const pad = 6;
    if (side === "right") return { x: r.right - rr.left - pad, y: midY };
    return { x: r.left - rr.left + pad, y: midY };
  }

  const rows = [];
  for (const edge of edges) {
    const fromEl = anchors[edge.fromId];
    const toEl = anchors[edge.toId];
    if (!fromEl || !toEl) continue;
    const p0 = connectorPoint(fromEl, "right");
    const p3 = connectorPoint(toEl, "left");
    const midX = p0.x + (p3.x - p0.x) * 0.55;
    const d = `M ${p0.x} ${p0.y} H ${midX} V ${p3.y} H ${p3.x}`;
    rows.push({ d });
  }
  return rows;
}

/**
 * @param {import("react").RefObject<HTMLElement | null>} rootRef
 * @param {import("./bracketLayout.js").BracketConnectorEdge[]} edges
 * @param {import("react").MutableRefObject<Record<string, HTMLElement | null>>} anchorsRef — updated by ref callbacks
 * @param {number} anchorVersion bump when any anchor element is set/cleared
 */
export function useBracketConnectors(rootRef, edges, anchorsRef, anchorVersion) {
  const [paths, setPaths] = useState(() => []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !edges.length) {
      setPaths([]);
      return undefined;
    }

    function compute() {
      const next = buildPathsFromAnchors(edges, anchorsRef.current || {}, root);
      setPaths(next);
    }

    compute();

    let roObs;
    try {
      roObs = new ResizeObserver(() => compute());
      roObs.observe(root);
    } catch {
      window.addEventListener("resize", compute);
    }

    /** @type {HTMLElement | null} */
    let scrollParent = root.parentElement;
    while (scrollParent && scrollParent !== document.body) {
      const { overflow } = window.getComputedStyle(scrollParent);
      if (/(auto|scroll)/.test(overflow)) break;
      scrollParent = scrollParent.parentElement;
    }
    scrollParent?.addEventListener("scroll", compute, { passive: true });

    return () => {
      roObs?.disconnect();
      window.removeEventListener("resize", compute);
      scrollParent?.removeEventListener("scroll", compute);
    };
  }, [rootRef, edges, anchorVersion, anchorsRef]);

  return paths;
}
