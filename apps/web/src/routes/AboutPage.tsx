export function AboutPage() {
  return (
    <section className="about-page">
      <header className="checker-head">
        <h1>About</h1>
        <p className="lede">
          IFC IDS Validator checks and builds buildingSMART IDS (Information
          Delivery Specification) rule sets against IFC building models,
          entirely in your browser. Nothing is uploaded; every file stays on
          your machine.
        </p>
      </header>

      <section className="step">
        <header className="step-head">
          <div className="step-title">
            <h2>Open source on GitHub</h2>
            <p>
              The full source of this validator is public, and it stays that
              way.
            </p>
          </div>
        </header>

        <div className="step-body">
          <p>
            Everything you see here: the IFC parsers, the IDS rule engine, the
            rule builder lives in one public repository. Read it to see exactly
            how a check is evaluated, report an issue, or send a pull request if
            something is missing.
          </p>
          <p>
            Feel free to fork it for your own use: run it locally, host your own
            copy, or pull the validation packages into a tool of your own. No
            strings attached.
          </p>
          <div className="about-links">
            <a
              className="btn ghost"
              href="https://github.com/Tacopover/IfcChecker"
              target="_blank"
              rel="noreferrer"
            >
              View the source on GitHub
            </a>
          </div>
        </div>
      </section>

      <section className="step">
        <header className="step-head">
          <div className="step-title">
            <h2>MEPSketcher</h2>
            <p>
              Another tool I built, for sketching MEP networks straight onto PDF
              floor plans.
            </p>
          </div>
        </header>

        <div className="step-body">
          <p>
            MEPSketcher bridges the gap between lead engineers and the people
            doing the drafting. Instead of marking up a PDF with loose
            annotations and stamps, you place preloaded equipment and terminal
            symbols on the drawing and connect them into real MEP networks, so
            design intent is captured as structured data without opening a CAD
            package.
          </p>
          <p>
            It is PDF-first by design: when the architect sends a new floor
            plan, you swap the underlying PDF and your elements are rebuilt on
            top of it. Everything runs as a local desktop app, so project files
            stay on your own machine.
          </p>
          <div className="about-links">
            <a
              className="btn ghost"
              href="https://mepsketcher.com"
              target="_blank"
              rel="noreferrer"
            >
              Visit mepsketcher.com
            </a>
          </div>
        </div>
      </section>
    </section>
  );
}
