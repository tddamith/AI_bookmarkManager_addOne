// After "Import from this browser", Stash works on organized copies in the "Stash" folder.
// The original bookmarks stay untouched but are hidden from Stash's own screens.
import { api } from "./config.js";
export const HIDE = new Set();
export async function loadHide() {
  const { hiddenOriginals = [] } = await api.storage.local.get("hiddenOriginals");
  HIDE.clear(); hiddenOriginals.forEach((id) => HIDE.add(id));
}
/** Folder path without the leading "Stash" container. */
export const stripStash = (path) => (path[0] === "Stash" ? path.slice(1) : path);
