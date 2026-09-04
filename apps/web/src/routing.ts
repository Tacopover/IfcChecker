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

/** Client-side history-API routing for the app's three real pages. Validate
 * and Build rules stay mounted regardless of route; the viewer is the
 * exception, mounted only while its route is current (see App.tsx) so its
 * WebGL context and mesh buffers are released on navigating away. This hook
 * only tracks which route is current and updates the URL bar — mounting
 * decisions live in App.tsx, not here. */
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
