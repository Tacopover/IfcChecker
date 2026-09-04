// Type companion for seo-routes.mjs, which stays plain JS so the build-time
// prerender script (plain `node`, no TypeScript) can import it too.
export interface SeoRoute {
  path: string;
  title: string;
  description: string;
}

export declare const SITE_ORIGIN: string;

export declare const ROUTES: {
  validate: SeoRoute;
  builder: SeoRoute;
  about: SeoRoute;
  viewer: SeoRoute;
};
