import { useState } from "react";
import { IfcCheckerPage } from "./routes/IfcCheckerPage";
import { RuleBuilderPage } from "./builder/RuleBuilderPage";
import { LoadedModelsProvider } from "./state/loadedModels";

type Tab = "validate" | "builder";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "validate", label: "Validate" },
  { id: "builder", label: "Build rules" },
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
    </LoadedModelsProvider>
  );
}
