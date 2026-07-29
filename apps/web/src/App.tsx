import { useState } from "react";
import { IfcCheckerPage } from "./routes/IfcCheckerPage";
import { RuleBuilderPage } from "./builder/RuleBuilderPage";
import { ViewerPage } from "./viewer/ViewerPage";
import { LoadedModelsProvider } from "./state/loadedModels";

type Tab = "validate" | "builder" | "viewer";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "validate", label: "Validate" },
  { id: "builder", label: "Build rules" },
  { id: "viewer", label: "3D view" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("validate");

  return (
    <LoadedModelsProvider>
      <header className="topbar">
        <span className="brand">IFC Checker</span>
        <nav className="tabs" aria-label="Pages">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="tab"
              data-smoke-route={entry.id}
              aria-current={tab === entry.id ? "page" : undefined}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Both pages stay mounted: switching tabs must not throw away a parsed model or a
          half-written rule set. The files themselves live above both, in LoadedModelsProvider. */}
      <div className="page-narrow" hidden={tab !== "validate"}>
        <IfcCheckerPage />
      </div>
      <div hidden={tab !== "builder"}>
        <RuleBuilderPage onGoToFiles={() => setTab("validate")} />
      </div>

      {/* The viewer is the exception: it holds mesh buffers and a live WebGL
          context, and several federated 1.6 GB models cannot all stay resident.
          Leaving the tab gives the geometry back. */}
      {tab === "viewer" && <ViewerPage />}
    </LoadedModelsProvider>
  );
}
