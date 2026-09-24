import { useEffect, useMemo, useState } from "react";

export function useShowMoreList(items, { pageSize = 4, resetKey, stepLoad = false } = {}) {
  const list = Array.isArray(items) ? items : [];
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [resetKey, list.length, pageSize]);

  const visible = useMemo(() => list.slice(0, visibleCount), [list, visibleCount]);
  const hasMore = visibleCount < list.length;
  const canCollapse = visibleCount > pageSize;
  const remaining = Math.max(0, list.length - visibleCount);

  return {
    visible,
    hasMore,
    canCollapse,
    remaining,
    showMore: () =>
      setVisibleCount((count) =>
        stepLoad ? Math.min(count + pageSize, list.length) : list.length,
      ),
    showLess: () => setVisibleCount(pageSize),
  };
}
