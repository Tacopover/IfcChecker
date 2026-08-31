// Single source of truth for the site's two real, indexable URLs — imported by
// the browser app (src/routing.ts, src/seo.ts) and by the build-time
// prerender script (scripts/prerender-routes.mjs). Kept as a plain .mjs, not
// .ts, so a plain Node process can import it with no build step.
export const SITE_ORIGIN = "https://ifc-ids.com";

export const ROUTES = {
  validate: {
    path: "/",
    title: "IFC IDS Validator — Check IFC Models Against buildingSMART IDS",
    description:
      "Validate IFC building models against buildingSMART IDS (Information Delivery Specification) rule sets, entirely in your browser. Free IFC IDS checker — no upload, no server, no signup.",
  },
  builder: {
    path: "/build-rules/",
    title: "IDS Rule Builder — Create buildingSMART IDS Rule Sets from an IFC Model",
    description:
      "Build buildingSMART IDS (Information Delivery Specification) rule sets from a real IFC model, entirely in your browser. No upload, no server, no signup — export a ready-to-use .ids file.",
  },
  viewer: {
    path: "/3d-view/",
    title: "3D IFC Viewer — Inspect Models and IDS Check Results in 3D",
    description:
      "View an IFC model in 3D and jump straight to the elements an IDS check failed, entirely in your browser. No upload, no server, no signup.",
  },
};
