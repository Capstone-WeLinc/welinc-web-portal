import { useState } from 'react';

/** Suite spec 0016 (design.md, Layout and navigation: Collapse): saved per user. */
export function sidebarKey(userId: string) {
  return `welinc:sidebar:${userId}`;
}

function readCollapsed(key: string) {
  try {
    return localStorage.getItem(key) === 'collapsed';
  } catch {
    return false;
  }
}

/** The Admin sidebar's collapsed state, remembered per user in this browser. A view preference, never session data. */
export function useSidebarCollapsed(userId: string) {
  const key = sidebarKey(userId);
  const [state, setState] = useState(() => ({ key, collapsed: readCollapsed(key) }));
  // Another person signed in on this tab: read their choice.
  if (state.key !== key) setState({ key, collapsed: readCollapsed(key) });

  const toggle = () => {
    const collapsed = !state.collapsed;
    setState({ key, collapsed });
    try {
      localStorage.setItem(key, collapsed ? 'collapsed' : 'expanded');
    } catch {
      // Storage blocked (private mode): the choice just isn't remembered.
    }
  };

  return { collapsed: state.collapsed, toggle };
}
