import { useCallback, useEffect, useRef, useState } from "react";
import type { HomeSection } from "../components/layout/Header";
import {
  type NavHomeSection,
  detectActiveHomeSection,
  isNavHomeSection,
} from "../utils/activeHomeSection";

const SCROLL_SETTLE_MS = 160;
const MAX_LOCK_MS = 1100;
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

/**
 * Tracks which home page section tab is active in the header. Clicking a tab highlights it
 * immediately and holds that choice while programmatic smooth scrolling finishes, so the active
 * indicator never flickers across intermediate sections.
 */
export function useHomeSectionSpy(onHome: boolean, pendingSection: HomeSection | null) {
  const [activeSection, setActiveSection] = useState<NavHomeSection | null>(null);
  const locked = useRef(false);
  const pendingRef = useRef(pendingSection);
  pendingRef.current = pendingSection;
  const settleTimer = useRef(0);
  const maxTimer = useRef(0);

  const clearTimers = useCallback(() => {
    window.clearTimeout(settleTimer.current);
    window.clearTimeout(maxTimer.current);
    settleTimer.current = 0;
    maxTimer.current = 0;
  }, []);

  const unlock = useCallback(() => {
    locked.current = false;
    clearTimers();
  }, [clearTimers]);

  const startSettle = useCallback(() => {
    locked.current = true;
    clearTimers();
    settleTimer.current = window.setTimeout(unlock, SCROLL_SETTLE_MS);
    maxTimer.current = window.setTimeout(unlock, MAX_LOCK_MS);
  }, [clearTimers, unlock]);

  /** Highlights the target section right away and suppresses scrollspy until the scroll settles. */
  const selectSection = useCallback(
    (section: HomeSection | null, holdUntilTriggered = false) => {
      setActiveSection(isNavHomeSection(section) ? section : null);
      if (holdUntilTriggered) {
        locked.current = true;
        clearTimers();
      } else {
        startSettle();
      }
    },
    [clearTimers, startSettle],
  );

  // Leaving the home page always clears any home section highlight.
  useEffect(() => {
    if (!onHome) {
      setActiveSection(null);
      unlock();
    }
  }, [onHome, unlock]);

  useEffect(() => {
    if (!onHome) return;
    let frame = 0;

    if (!locked.current && pendingRef.current === null) {
      setActiveSection(detectActiveHomeSection());
    }

    const updateFromScroll = () => {
      if (locked.current || pendingRef.current !== null) return;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (locked.current || pendingRef.current !== null) return;
        setActiveSection(detectActiveHomeSection());
      });
    };

    const onScroll = () => {
      if (pendingRef.current !== null) return;
      if (locked.current) {
        window.clearTimeout(settleTimer.current);
        settleTimer.current = window.setTimeout(unlock, SCROLL_SETTLE_MS);
        return;
      }
      updateFromScroll();
    };

    const onScrollEnd = () => {
      if (pendingRef.current === null && locked.current) unlock();
    };

    const onUserScrollIntent = () => {
      if (pendingRef.current === null && locked.current) unlock();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!SCROLL_KEYS.has(event.key)) return;
      const target = event.target;
      if (
        target instanceof HTMLButtonElement ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      onUserScrollIntent();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateFromScroll);
    window.addEventListener("scrollend", onScrollEnd);
    window.addEventListener("wheel", onUserScrollIntent, { passive: true });
    window.addEventListener("touchstart", onUserScrollIntent, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateFromScroll);
      window.removeEventListener("scrollend", onScrollEnd);
      window.removeEventListener("wheel", onUserScrollIntent);
      window.removeEventListener("touchstart", onUserScrollIntent);
      window.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(frame);
      clearTimers();
    };
  }, [onHome, unlock, clearTimers]);

  return { activeSection, selectSection, startSettle };
}
