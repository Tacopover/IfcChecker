import "@testing-library/jest-dom/vitest";

// jsdom has no top-layer rendering, so it doesn't implement <dialog>'s imperative
// showModal/close — every real browser the app runs in does. This mirrors what they do
// closely enough for tests: toggle the reflected `open` attribute and fire `close`.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
