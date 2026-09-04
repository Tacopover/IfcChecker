import { describe, expect, it } from "vitest";
import {
  clearHighlight,
  clearIsolation,
  hideElements,
  highlightElements,
  initialVisibility,
  isHighlighted,
  isolateElements,
  isVisible,
  parseRefKey,
  refKey,
  showElements,
  showEverything,
  toggleModel,
  toggleType,
  visibilityCode,
} from "./visibility.js";

const wall = { modelKey: "arch", expressId: 100 };
const otherWall = { modelKey: "arch", expressId: 200 };
const space = { modelKey: "arch", expressId: 300 };
const pipe = { modelKey: "mep", expressId: 100 };

describe("refKey", () => {
  it("separates the same express id in two different files", () => {
    expect(refKey(wall)).not.toBe(refKey(pipe));
  });
});

describe("parseRefKey", () => {
  it("round-trips refKey's output", () => {
    expect(parseRefKey(refKey(wall))).toEqual(wall);
    expect(parseRefKey(refKey(pipe))).toEqual(pipe);
  });

  it("splits on the last # so a modelKey containing one stays intact", () => {
    expect(parseRefKey("weird#model#42")).toEqual({ modelKey: "weird#model", expressId: 42 });
  });
});

describe("initialVisibility", () => {
  it("shows ordinary elements and hides spaces, which would occlude the model", () => {
    const state = initialVisibility();
    expect(isVisible(state, wall, "IFCWALL")).toBe(true);
    expect(isVisible(state, space, "IFCSPACE")).toBe(false);
  });

  it("matches types case-insensitively, since the engines disagree on casing", () => {
    expect(isVisible(initialVisibility(), space, "IfcSpace")).toBe(false);
  });
});

describe("hideElements / showElements", () => {
  it("hides only what it is given, and only in the model it was given", () => {
    const state = hideElements(initialVisibility(), [wall]);
    expect(isVisible(state, wall, "IFCWALL")).toBe(false);
    expect(isVisible(state, otherWall, "IFCWALL")).toBe(true);
    expect(isVisible(state, pipe, "IFCPIPESEGMENT")).toBe(true);
  });

  it("round-trips", () => {
    const hidden = hideElements(initialVisibility(), [wall, otherWall]);
    const shown = showElements(hidden, [wall, otherWall]);
    expect(isVisible(shown, wall, "IFCWALL")).toBe(true);
    expect(isVisible(shown, otherWall, "IFCWALL")).toBe(true);
  });

  it("does not mutate the state it was given", () => {
    const state = initialVisibility();
    hideElements(state, [wall]);
    expect(isVisible(state, wall, "IFCWALL")).toBe(true);
  });
});

describe("isolateElements", () => {
  it("shows exactly the isolated elements and nothing else", () => {
    const state = isolateElements(initialVisibility(), [wall]);
    expect(isVisible(state, wall, "IFCWALL")).toBe(true);
    expect(isVisible(state, otherWall, "IFCWALL")).toBe(false);
    expect(isVisible(state, pipe, "IFCPIPESEGMENT")).toBe(false);
  });

  // The case this rule exists for: navigating to the elements that failed a
  // check must show them even when they are a type the user switched off, or
  // live in a file they collapsed. Anything softer silently frames nothing.
  it("overrides a hidden type", () => {
    const state = isolateElements(initialVisibility(), [space]);
    expect(isVisible(state, space, "IFCSPACE")).toBe(true);
  });

  it("overrides a hidden model", () => {
    let state = toggleModel(initialVisibility(), "mep");
    expect(isVisible(state, pipe, "IFCPIPESEGMENT")).toBe(false);

    state = isolateElements(state, [pipe]);
    expect(isVisible(state, pipe, "IFCPIPESEGMENT")).toBe(true);
  });

  it("overrides an element hidden one at a time", () => {
    const state = isolateElements(hideElements(initialVisibility(), [wall]), [wall]);
    expect(isVisible(state, wall, "IFCWALL")).toBe(true);
  });

  it("isolating nothing shows nothing, rather than quietly meaning everything", () => {
    const state = isolateElements(initialVisibility(), []);
    expect(isVisible(state, wall, "IFCWALL")).toBe(false);
  });

  it("clearing isolation restores the hides that were underneath it", () => {
    const hidden = hideElements(initialVisibility(), [wall]);
    const restored = clearIsolation(isolateElements(hidden, [wall]));
    expect(isVisible(restored, wall, "IFCWALL")).toBe(false);
    expect(isVisible(restored, otherWall, "IFCWALL")).toBe(true);
  });
});

describe("toggleType", () => {
  it("switches a type off and on again", () => {
    let state = toggleType(initialVisibility(), "IFCWALL");
    expect(isVisible(state, wall, "IFCWALL")).toBe(false);

    state = toggleType(state, "IFCWALL");
    expect(isVisible(state, wall, "IFCWALL")).toBe(true);
  });

  it("turns spaces back on, since they start hidden", () => {
    const state = toggleType(initialVisibility(), "IFCSPACE");
    expect(isVisible(state, space, "IFCSPACE")).toBe(true);
  });
});

describe("toggleModel", () => {
  it("hides a whole file without touching the others", () => {
    const state = toggleModel(initialVisibility(), "mep");
    expect(isVisible(state, pipe, "IFCPIPESEGMENT")).toBe(false);
    expect(isVisible(state, wall, "IFCWALL")).toBe(true);
  });
});

describe("showEverything", () => {
  it("reveals even the types that start hidden", () => {
    const state = showEverything();
    expect(isVisible(state, space, "IFCSPACE")).toBe(true);
  });

  it("is not the same as a reset — initialVisibility puts spaces back out of sight", () => {
    expect(isVisible(initialVisibility(), space, "IFCSPACE")).toBe(false);
    expect(isVisible(showEverything(), space, "IFCSPACE")).toBe(true);
  });
});

describe("highlightElements / isHighlighted / clearHighlight", () => {
  it("marks exactly the given elements, leaving visibility untouched", () => {
    const state = highlightElements(initialVisibility(), [wall]);
    expect(isHighlighted(state, wall)).toBe(true);
    expect(isHighlighted(state, otherWall)).toBe(false);
    // Highlight-only mode: nothing is hidden by highlighting.
    expect(isVisible(state, wall, "IFCWALL")).toBe(true);
    expect(isVisible(state, otherWall, "IFCWALL")).toBe(true);
  });

  it("reports nothing highlighted before any is set", () => {
    expect(isHighlighted(initialVisibility(), wall)).toBe(false);
  });

  it("replaces the previous highlighted set rather than accumulating it", () => {
    const state = highlightElements(highlightElements(initialVisibility(), [wall]), [otherWall]);
    expect(isHighlighted(state, wall)).toBe(false);
    expect(isHighlighted(state, otherWall)).toBe(true);
  });

  it("clears back to nothing highlighted", () => {
    const state = clearHighlight(highlightElements(initialVisibility(), [wall]));
    expect(isHighlighted(state, wall)).toBe(false);
  });

  it("does not mutate the state it was given", () => {
    const state = initialVisibility();
    highlightElements(state, [wall]);
    expect(isHighlighted(state, wall)).toBe(false);
  });
});

describe("visibilityCode", () => {
  it("is 0 for a hidden element regardless of highlight", () => {
    const state = highlightElements(hideElements(initialVisibility(), [wall]), [wall]);
    expect(visibilityCode(state, wall, "IFCWALL")).toBe(0);
  });

  it("is 1 for an ordinary visible element", () => {
    expect(visibilityCode(initialVisibility(), wall, "IFCWALL")).toBe(1);
  });

  it("is 2 for a visible, highlighted element", () => {
    const state = highlightElements(initialVisibility(), [wall]);
    expect(visibilityCode(state, wall, "IFCWALL")).toBe(2);
  });

  it("respects isolation the same way isVisible does", () => {
    const state = highlightElements(isolateElements(initialVisibility(), [wall]), [otherWall]);
    expect(visibilityCode(state, wall, "IFCWALL")).toBe(1);
    expect(visibilityCode(state, otherWall, "IFCWALL")).toBe(0);
  });
});
