import { $, getSession } from "./config.js";
import { renderPanelHead } from "./panel.js";
renderPanelHead($("head"), "", { light: true });
getSession().then((session) => {
  $("plan").textContent = `Pro · ${session?.billing === "monthly" ? "Monthly" : "Yearly"}`;
  $("method").textContent = session?.paidWith ?? "PayPal";
});
