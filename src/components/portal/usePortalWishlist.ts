'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DESTINATIONS, type Destination } from '../../data/destinations';

const STORAGE_KEY = 'tripsplit_wishlist_v1';

export function usePortalWishlist() {
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setSavedIds(parsed.filter((x): x is string => typeof x === 'string'));
          }
        }
      } catch {
        // Ignore storage error
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleWishlist = useCallback((destinationId: string) => {
    setSavedIds((prev) => {
      const exists = prev.includes(destinationId);
      const next = exists
        ? prev.filter((id) => id !== destinationId)
        : [destinationId, ...prev];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  }, []);

  const isWishlisted = useCallback(
    (destinationId: string) => savedIds.includes(destinationId),
    [savedIds]
  );

  const savedDestinations = useMemo<Destination[]>(() => {
    const byId = new Map(DESTINATIONS.map((d) => [d.id, d]));
    return savedIds
      .map((id) => byId.get(id))
      .filter((d): d is Destination => Boolean(d));
  }, [savedIds]);

  return {
    savedIds,
    savedDestinations,
    toggleWishlist,
    isWishlisted,
  };
}
