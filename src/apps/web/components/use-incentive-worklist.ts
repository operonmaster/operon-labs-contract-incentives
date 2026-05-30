"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

export type WorklistRefreshSource = "initial" | "manual";

interface UseIncentiveWorklistOptions<TRow> {
  /** API route returning `{ rows: TRow[] }`. */
  endpoint: string;
  /** Stable identity accessor for a row (e.g. `(row) => row.umRequestId`). */
  // eslint-disable-next-line no-unused-vars -- parameter name documents the row accessor signature
  getRowId: (row: TRow) => string;
  /** User-facing message shown when the fetch fails. */
  errorMessage: string;
  /** Optional id (e.g. from a query param) to prefer when the current selection is gone. */
  requestedId?: string | null;
}

export interface IncentiveWorklist<TRow> {
  rows: TRow[];
  setRows: Dispatch<SetStateAction<TRow[]>>;
  selectedId: string | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  initialLoading: boolean;
  refreshing: boolean;
  error: string | null;
  // eslint-disable-next-line no-unused-vars -- parameter name documents the refresh source
  refresh: (source?: WorklistRefreshSource) => Promise<boolean>;
}

/**
 * Shared data-fetching for the five incentive worklist consoles. Centralizes the
 * loading/refreshing/error state, the out-of-order-response guard, the
 * keep-current → requested → first selection reducer, and AbortController-based
 * cancellation of superseded/unmounted requests. Consoles keep their own modal and
 * optimistic-mutation state and drive it through the returned setRows/setSelectedId.
 */
export function useIncentiveWorklist<TRow>({
  endpoint,
  getRowId,
  errorMessage,
  requestedId = null
}: UseIncentiveWorklistOptions<TRow>): IncentiveWorklist<TRow> {
  const [rows, setRows] = useState<TRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const refreshSequenceRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  // getRowId is frequently passed inline (unstable identity); keep it in a ref so the
  // refresh callback and mount effect stay stable and don't refetch on every render.
  const getRowIdRef = useRef(getRowId);
  useEffect(() => {
    getRowIdRef.current = getRowId;
  });

  const refresh = useCallback(
    async (source: WorklistRefreshSource = "manual"): Promise<boolean> => {
      const requestId = refreshSequenceRef.current + 1;
      refreshSequenceRef.current = requestId;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (source === "manual" && mountedRef.current) {
        setRefreshing(true);
      }
      if (mountedRef.current) {
        setError(null);
      }

      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        const payload = (await response.json()) as { rows?: TRow[]; error?: string };

        if (!mountedRef.current || requestId !== refreshSequenceRef.current) {
          return false;
        }

        if (!response.ok || !Array.isArray(payload.rows)) {
          setError(payload.error ?? errorMessage);
          return false;
        }

        const nextRows = payload.rows;
        const getId = getRowIdRef.current;
        setRows(nextRows);
        setSelectedId((currentId) => {
          if (currentId && nextRows.some((row) => getId(row) === currentId)) {
            return currentId;
          }
          if (requestedId && nextRows.some((row) => getId(row) === requestedId)) {
            return requestedId;
          }
          return nextRows[0] ? getId(nextRows[0]) : null;
        });
        return true;
      } catch {
        if (!mountedRef.current || requestId !== refreshSequenceRef.current) {
          return false;
        }
        setError(errorMessage);
        return false;
      } finally {
        if (mountedRef.current && source === "initial") {
          setInitialLoading(false);
        }
        if (mountedRef.current && source === "manual") {
          setRefreshing(false);
        }
      }
    },
    [endpoint, errorMessage, requestedId]
  );

  useEffect(() => {
    mountedRef.current = true;
    const initialRefreshId = window.setTimeout(() => {
      void refresh("initial");
    }, 0);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialRefreshId);
      abortRef.current?.abort();
    };
  }, [refresh]);

  return { rows, setRows, selectedId, setSelectedId, initialLoading, refreshing, error, refresh };
}
