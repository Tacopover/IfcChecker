import { useCallback, useEffect, useState } from "react";
import { ROUTES } from "../seo-routes.mjs";

export type RouteId = keyof typeof ROUTES;

const PATH_TO_ROUTE = new Map<string, RouteId>(
  (Object.entries(ROUTES) as Array<[RouteId, (typeof ROUTES)[RouteId]]>).map(([id, route]) => [
    route.path,
    id,
  ])
);

function routeForPath(pathname: string): RouteId {
  return PATH_TO_ROUTE.get(pathname) ?? "validate";
}

export function pathFor(route: RouteId): string {
  return ROUTES[route].path;
}

/** Client-side history-API routing for the app's two real pages. Both stay
 * mounted regardless of route (see App.tsx) — this only tracks which one is
 * current and updates the URL bar, it never remounts anything. */
export function useRoute(): [RouteId, (route: RouteId) => void] {
  const [route, setRoute] = useState<RouteId>(() => routeForPath(window.location.pathname));

  useEffect(() => {
    function onPopState() {
      setRoute(routeForPath(window.location.pathname));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((next: RouteId) => {
    const path = pathFor(next);
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
    setRoute(next);
  }, []);

  return [route, navigate];
}
