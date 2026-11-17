// Side-panel tab bar (segmented, top): Home · Library · Tidy · For you.
const TABS = [
  ["home", "Home", "home.html"],
  ["library", "Library", "library.html"],
  ["tidy", "Tidy", "tidy.html"],
  ["foryou", "For you", "foryou.html"],
];
export function renderTabs(el, active) {
  el.className = "tabs"; el.setAttribute("aria-label", "Panel tabs");
  el.replaceChildren(...TABS.map(([id, label, href]) => {
    const a = document.createElement("a");
    a.href = href; a.textContent = label;
    if (id === active) a.setAttribute("aria-current", "page");
    return a;
  }));
}
