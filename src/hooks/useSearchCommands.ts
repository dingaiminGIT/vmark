import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useSearchStore } from "@/stores/searchStore";

export function useSearchCommands() {
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    let cancelled = false;

    const setupListeners = async () => {
      // Clean up any existing listeners first
      unlistenRefs.current.forEach((fn) => fn());
      unlistenRefs.current = [];

      if (cancelled) return;

      // Find menu events
      const unlistenFind = await listen("menu:find", () => {
        useSearchStore.getState().openFind();
      });
      if (cancelled) { unlistenFind(); return; }
      unlistenRefs.current.push(unlistenFind);

      const unlistenFindReplace = await listen("menu:find-replace", () => {
        useSearchStore.getState().openReplace();
      });
      if (cancelled) { unlistenFindReplace(); return; }
      unlistenRefs.current.push(unlistenFindReplace);

      const unlistenFindNext = await listen("menu:find-next", () => {
        const { isOpen } = useSearchStore.getState();
        if (!isOpen) {
          useSearchStore.getState().openFind();
        } else {
          useSearchStore.getState().findNext();
        }
      });
      if (cancelled) { unlistenFindNext(); return; }
      unlistenRefs.current.push(unlistenFindNext);

      const unlistenFindPrev = await listen("menu:find-prev", () => {
        const { isOpen } = useSearchStore.getState();
        if (!isOpen) {
          useSearchStore.getState().openFind();
        } else {
          useSearchStore.getState().findPrevious();
        }
      });
      if (cancelled) { unlistenFindPrev(); return; }
      unlistenRefs.current.push(unlistenFindPrev);

      const unlistenUseSelection = await listen("menu:use-selection-find", () => {
        // This will be implemented by the editor components
        // They will get the selection and set it as the query
        window.dispatchEvent(new CustomEvent("use-selection-for-find"));
      });
      if (cancelled) { unlistenUseSelection(); return; }
      unlistenRefs.current.push(unlistenUseSelection);
    };

    setupListeners();

    return () => {
      cancelled = true;
      const fns = unlistenRefs.current;
      unlistenRefs.current = [];
      fns.forEach((fn) => fn());
    };
  }, []);
}
