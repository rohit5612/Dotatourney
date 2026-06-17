import { useEffect, useMemo, useState } from "react";

export function useShowMoreList(items, { pageSize = 4, resetKey } = {}) {
  const list = Array.isArray(items) ? items : [];
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [resetKey, list.length, pageSize]);

  const visible = useMemo(() => list.slice(0, visibleCount), [list, visibleCount]);
  const hasMore = visibleCount < list.length;
  const canCollapse = visibleCount > pageSize;

  return {
    visible,
    hasMore,
    canCollapse,
    showMore: () => setVisibleCount(list.length),
    showLess: () => setVisibleCount(pageSize),
  };
}
