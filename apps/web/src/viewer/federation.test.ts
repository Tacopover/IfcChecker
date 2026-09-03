import { describe, expect, it } from "vitest";
import { ModelFederation } from "./federation.js";

describe("ModelFederation", () => {
  it("gives the first model offset 0 and the next a disjoint range", () => {
    const federation = new ModelFederation();
    expect(federation.offsetFor("a")).toBe(0);
    expect(federation.offsetFor("b")).toBeGreaterThan(0);
    expect(federation.offsetFor("a")).toBe(0);
  });

  it("round-trips a global id back to its model and express id", () => {
    const federation = new ModelFederation();
    federation.offsetFor("a");
    const globalId = federation.toGlobalId("b", 42);
    expect(federation.fromGlobalId(globalId)).toEqual({ modelKey: "b", expressId: 42 });
  });

  it("keeps two models' identical express ids apart", () => {
    const federation = new ModelFederation();
    const a = federation.toGlobalId("a", 100);
    const b = federation.toGlobalId("b", 100);
    expect(a).not.toBe(b);
    expect(federation.fromGlobalId(a)).toEqual({ modelKey: "a", expressId: 100 });
    expect(federation.fromGlobalId(b)).toEqual({ modelKey: "b", expressId: 100 });
  });

  it("returns null for a global id belonging to no registered model", () => {
    const federation = new ModelFederation();
    federation.offsetFor("a");
    expect(federation.fromGlobalId(999_999_999)).toBeNull();
  });

  it("never reuses an offset after removeModel", () => {
    const federation = new ModelFederation();
    const first = federation.offsetFor("a");
    federation.removeModel("a");
    const second = federation.offsetFor("a");
    expect(second).not.toBe(first);
  });
});
