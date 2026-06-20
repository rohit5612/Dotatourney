import "./CardRendererSkeleton.css";

export function CardRendererSkeleton({ size = "md", className = "" }) {
  const sizeClass = size === "sm" ? "card-renderer-skeleton--sm" : "card-renderer-skeleton--md";
  return (
    <div
      className={`card-renderer-skeleton ${sizeClass}${className ? ` ${className}` : ""}`.trim()}
      aria-hidden="true"
    />
  );
}
