export function AboutPage() {
  return (
    <section className="about-page">
      <header className="checker-head">
        <h1>About</h1>
        <p className="lede">
          IFC IDS Validator checks and builds buildingSMART IDS (Information Delivery
          Specification) rule sets against IFC building models, entirely in your browser. Nothing
          is uploaded; every file stays on your machine.
        </p>
      </header>

      <section className="step">
        <div className="step-body about-links">
          <a
            className="btn ghost"
            href="https://github.com/Tacopover/IfcChecker"
            target="_blank"
            rel="noreferrer"
          >
            View the source on GitHub
          </a>
          <a className="btn ghost" href="https://mepsketcher.com" target="_blank" rel="noreferrer">
            MepSketcher
          </a>
        </div>
      </section>
    </section>
  );
}
