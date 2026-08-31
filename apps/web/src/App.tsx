import { RuleBuilderPage } from "./builder/RuleBuilderPage";
import { IfcCheckerPage } from "./routes/IfcCheckerPage";
import { AboutPage } from "./routes/AboutPage";
import { pathFor, useRoute, type RouteId } from "./routing";
import { useDocumentMeta } from "./seo";
import { LoadedModelsProvider } from "./state/loadedModels";

const TABS: Array<{ id: RouteId; label: string }> = [
  { id: "validate", label: "Validate" },
  { id: "builder", label: "Build rules" },
  { id: "about", label: "About" },
];

export function App() {
  const [tab, navigate] = useRoute();
  useDocumentMeta(tab);

  return (
    <LoadedModelsProvider>
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
        <IfcCheckerPage />
      </div>
      <div hidden={tab !== "builder"}>
        <RuleBuilderPage onGoToFiles={() => navigate("validate")} />
      </div>
      <div className="page-narrow" hidden={tab !== "about"}>
        <AboutPage />
      </div>
    </LoadedModelsProvider>
  );
}
