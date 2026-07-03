import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { weatherService } from "../lib/services/weatherService.js";

function getInitialState(config) {
  if (!config.enabled) {
    return {
      status: "disabled",
      data: null,
      error: null,
      lastUpdated: null,
      requestKey: null,
    };
  }

  if (!config.postcode) {
    return {
      status: "unconfigured",
      data: null,
      error: null,
      lastUpdated: null,
      requestKey: null,
    };
  }

  return {
    status: "idle",
    data: null,
    error: null,
    lastUpdated: null,
    requestKey: null,
  };
}

export default function useLiveWeather({ club = {}, date, fixtures = [], enabled = true } = {}) {
  const config = useMemo(() => weatherService.getConfiguration(club), [club]);
  const [state, setState] = useState(() => getInitialState(config));
  const requestRef = useRef(0);
  const controllerRef = useRef(null);
  const fixturesRef = useRef(fixtures);
  fixturesRef.current = fixtures;
  const fixtureSignature = useMemo(
    () => fixtures
      .map((fixture) => [
        fixture?.id || fixture?.fixtureId || fixture?.homeTeam || fixture?.team || "fixture",
        fixture?.koMins ?? fixture?.kickoffMins ?? fixture?.ko ?? fixture?.koTime ?? fixture?.time ?? "",
        fixture?.status || "",
      ].join(":"))
      .join("|"),
    [fixtures]
  );

  const load = useCallback(async ({ force = false } = {}) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    controllerRef.current?.abort();
    controllerRef.current = null;

    if (!enabled || !config.enabled) {
      setState({ status: "disabled", data: null, error: null, lastUpdated: null, requestKey: null });
      return null;
    }

    if (!config.postcode) {
      setState({ status: "unconfigured", data: null, error: null, lastUpdated: null, requestKey: null });
      return null;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    const requestKey = `${config.postcode}:${date || "today"}`;

    setState((current) => {
      const canReuseCurrent = current.requestKey === requestKey && Boolean(current.data);
      return {
        status: canReuseCurrent ? "refreshing" : "loading",
        data: canReuseCurrent ? current.data : null,
        error: null,
        lastUpdated: canReuseCurrent ? current.lastUpdated : null,
        requestKey,
      };
    });

    try {
      const data = await weatherService.getForecast({
        postcode: config.postcode,
        date,
        fixtures: fixturesRef.current,
        signal: controller.signal,
        force,
      });

      if (requestRef.current !== requestId) return null;

      setState({
        status: data?.cacheStatus === "stale" ? "stale" : "success",
        data,
        error: data?.warning || null,
        lastUpdated: data?.updatedAt || new Date().toISOString(),
        requestKey,
      });
      return data;
    } catch (error) {
      if (error?.name === "AbortError" || requestRef.current !== requestId) return null;

      setState((current) => ({
        ...current,
        status: error?.code === "DATE_OUT_OF_RANGE" ? "out_of_range" : "error",
        error: error?.message || "Live weather could not be loaded.",
        requestKey,
      }));
      return null;
    }
  }, [config.enabled, config.postcode, date, enabled, fixtureSignature]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  const refresh = useCallback(() => load({ force: true }), [load]);

  return {
    ...state,
    config,
    refresh,
    isLoading: state.status === "loading" || state.status === "refreshing",
    isRefreshing: state.status === "refreshing",
    isAvailable: Boolean(state.data),
  };
}
