import { useLayoutEffect, useRef } from "react";
import "./ResponsiveCardName.css";

export function ResponsiveCardName({ children, className = "", minScale = 0.72 }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return undefined;

    const fit = () => {
      text.style.fontSize = "";
      const baseSize = parseFloat(window.getComputedStyle(text).fontSize);
      if (!baseSize) return;

      const minSize = Math.max(8, baseSize * minScale);
      let size = baseSize;
      text.style.fontSize = `${size}px`;

      const maxWidth = container.clientWidth;
      while (text.scrollWidth > maxWidth && size > minSize) {
        size -= 0.5;
        text.style.fontSize = `${size}px`;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    document.fonts?.ready?.then(fit).catch(() => {});
    return () => observer.disconnect();
  }, [children, minScale]);

  return (
    <div className="responsive-card-name" ref={containerRef}>
      <p ref={textRef} className={className}>
        {children}
      </p>
    </div>
  );
}
