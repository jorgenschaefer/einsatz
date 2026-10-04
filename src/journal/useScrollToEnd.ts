"use client";

import { useEffect, useRef } from "react";

export const SHOW_END: ScrollIntoViewOptions = { block: "end" };

/**
 * Hält das ETB am letzten Eintrag wie einen Chat: beim Sichtbarwerden, nach
 * `scrollToEnd` und bei einem neuen Eintrag, solange das Listenende zu sehen
 * war. Wer hochgescrollt hat, bleibt, wo er ist.
 */
export function useScrollToEnd(
  visible: boolean,
  lastEntryId: string | undefined,
) {
  const endRef = useRef<HTMLDivElement>(null);
  const newEntryRef = useRef<HTMLDivElement>(null);
  const endInView = useRef(false);

  useEffect(() => {
    if (!endRef.current) return;
    // Mehrere Beobachtungen seit dem letzten Aufruf: Es zählt die neueste.
    const observer = new IntersectionObserver((observations) => {
      endInView.current = observations.at(-1)?.isIntersecting ?? false;
    });
    observer.observe(endRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (visible) scrollToEnd(endRef.current, newEntryRef.current);
  }, [visible]);

  useEffect(() => {
    if (lastEntryId !== undefined && endInView.current) {
      scrollToEnd(endRef.current, newEntryRef.current);
    }
  }, [lastEntryId]);

  return {
    endRef,
    newEntryRef,
    // Das eigene Scrollen gilt sofort als „am Ende": Der IntersectionObserver
    // meldet es erst nach dem nächsten Frame, der neue Eintrag kommt oft vorher.
    scrollToEnd: () => {
      endInView.current = true;
      scrollToEnd(endRef.current, newEntryRef.current);
    },
  };
}

/**
 * Am Desktop scrollt nur die Liste ans Ende; am Handy scrollt das ganze ETB,
 * dort gehört Neuer Eintrag unter dem letzten Eintrag mit ins Bild.
 */
function scrollToEnd(listEnd: Element | null, newEntry: Element | null) {
  listEnd?.scrollIntoView(SHOW_END);
  newEntry?.scrollIntoView(SHOW_END);
}
