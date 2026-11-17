import { renderTabs } from "./tabs.js";
import { renderPanelHead } from "./panel.js";
renderPanelHead(document.getElementById("head"));
const n = new URLSearchParams(location.search).get("n") || "This screen";
document.getElementById("t").textContent = `${n} — coming soon`;
renderTabs(document.getElementById("tabs"), n === "Tidy" ? "tidy" : n === "For you" ? "foryou" : "");
