// Shared form behaviour: inline field errors + show/hide password.
const ERR_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M12 6v8M12 17v1" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const EYE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.2-.9"/></svg>`;
const wrapOf = (input) => input.closest(".field, .pill-field");

export function clearFieldError(input) {
  const w = wrapOf(input); if (!w) return;
  w.classList.remove("invalid"); input.removeAttribute("aria-invalid"); input.removeAttribute("aria-describedby");
  document.getElementById(`${input.id}-err`)?.remove();
}

export function setFieldError(input, message) {
  const w = wrapOf(input); clearFieldError(input);
  w.classList.add("invalid"); input.setAttribute("aria-invalid", "true");
  const err = document.createElement("div");
  err.id = `${input.id}-err`; err.className = "err"; err.insertAdjacentHTML("afterbegin", ERR_ICON); err.append(message);
  w.after(err); input.setAttribute("aria-describedby", err.id);
}

/** Validate [{input, ok, message}]; shows errors, focuses the first bad one. Returns true if all ok. */
export function validate(rules) {
  let first = null;
  for (const { input, ok, message } of rules) {
    if (ok) clearFieldError(input); else { setFieldError(input, message); first ??= input; }
  }
  first?.focus(); return !first;
}

export function initForms(root = document) {
  root.querySelectorAll("input, textarea").forEach((i) => i.addEventListener("input", () => clearFieldError(i)));
  root.querySelectorAll("[data-toggle-password]").forEach((btn) => {
    const input = document.getElementById(btn.dataset.togglePassword);
    const paint = () => { const shown = input.type === "text"; btn.innerHTML = shown ? EYE_OFF : EYE; btn.setAttribute("aria-label", shown ? "Hide password" : "Show password"); btn.setAttribute("aria-pressed", shown); };
    btn.addEventListener("click", () => { input.type = input.type === "password" ? "text" : "password"; paint(); input.focus(); });
    paint();
  });
}

/** Run an async action with the button in its Loading state (aria-busy). Ignores repeat clicks/Enter. */
export async function withBusy(btn, fn) {
  if (btn.getAttribute("aria-busy") === "true") return;
  btn.setAttribute("aria-busy", "true");
  try { return await fn(); } finally { btn.removeAttribute("aria-busy"); }
}
