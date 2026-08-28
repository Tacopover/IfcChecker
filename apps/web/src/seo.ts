import { useEffect } from "react";
import { ROUTES, SITE_ORIGIN } from "../seo-routes.mjs";
import type { RouteId } from "./routing";

function setMeta(selector: string, attribute: "content" | "href", value: string) {
  document.head.querySelector(selector)?.setAttribute(attribute, value);
}

/** Keeps the static head tags baked into index.html (and its two prerendered
 * copies, see scripts/prerender-routes.mjs) correct across a client-side
 * route change — a full page load already has the right ones from the
 * prerendered HTML, this only matters once the user navigates without one. */
export function useDocumentMeta(route: RouteId) {
  useEffect(() => {
    const { title, description, path } = ROUTES[route];
    const url = `${SITE_ORIGIN}${path}`;

    document.title = title;
    setMeta('meta[name="description"]', "content", description);
    setMeta('link[rel="canonical"]', "href", url);
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[name="twitter:description"]', "content", description);
  }, [route]);
}
