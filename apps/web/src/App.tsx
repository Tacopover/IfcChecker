import { useState } from "react";
import { RuleBuilderPage } from "./builder/RuleBuilderPage";
import { IfcCheckerPage } from "./routes/IfcCheckerPage";
import { AboutPage } from "./routes/AboutPage";
import { pathFor, useRoute, type RouteId } from "./routing";
import { useDocumentMeta } from "./seo";
import { CheckResultsProvider } from "./state/checkResults";
import { LoadedModelsProvider } from "./state/loadedModels";
import type { ViewerFocusRequest } from "./viewer/focusRequest";
import { ViewerPage } from "./viewer/ViewerPage";

const TABS: Array<{ id: RouteId; label: string }> = [
  { id: "validate", label: "Validate" },
  { id: "builder", label: "Build rules" },
  { id: "viewer", label: "3D view" },
  { id: "about", label: "About" },
];

export function App() {
  const [tab, navigate] = useRoute();
  useDocumentMeta(tab);

  // Carries a single "go look at these elements" request from the Validate
  // page's "View in 3D" affordances to the viewer, consumed once on arrival.
  // Lifted here (not a context) because it has exactly one producer and one
  // consumer — see App.tsx's role in goal-link-ids-results-to-viewer.
  const [pendingViewerFocus, setPendingViewerFocus] = useState<ViewerFocusRequest | null>(null);

  function focusInViewer(request: ViewerFocusRequest) {
    setPendingViewerFocus(request);
    navigate("viewer");
  }

  return (
    <LoadedModelsProvider>
      <CheckResultsProvider>
        <header className="topbar">
          <span className="brand">IFC Checker</span>
          <nav className="tabs" aria-label="Pages">
            {TABS.map((entry) => (
              <a
                key={entry.id}
                href={pathFor(entry.id)}
                className="tab"
                data-smoke-route={entry.id}
                aria-current={tab === entry.id ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(entry.id);
                }}
              >
                {entry.label}
              </a>
            ))}
          </nav>
        </header>

        {/* Both pages stay mounted: switching tabs must not throw away a parsed model or a
            half-written rule set. The files themselves live above both, in LoadedModelsProvider. */}
        <div className="page-narrow" hidden={tab !== "validate"}>
          <IfcCheckerPage onFocusInViewer={focusInViewer} />
        </div>
        <div hidden={tab !== "builder"}>
          <RuleBuilderPage onGoToFiles={() => navigate("validate")} />
        </div>
        <div className="page-narrow" hidden={tab !== "about"}>
          <AboutPage />
        </div>

        {/* The viewer is the exception: it holds mesh buffers and a live WebGL
            context, and several federated 1.6 GB models cannot all stay resident.
            Leaving the tab gives the geometry back. */}
        {tab === "viewer" && (
          <ViewerPage pendingFocus={pendingViewerFocus} onConsumeFocus={() => setPendingViewerFocus(null)} />
        )}
      </CheckResultsProvider>
    </LoadedModelsProvider>
  );
}
