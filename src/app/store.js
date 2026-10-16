// Saves everything on this device as one JSON document in localStorage. spec.md > Data Model.
// Storage can be blocked (private mode), full, or hold something unreadable; the app keeps working in every case.

import { sampleData } from "../core/sample.js";

export const KEY = "profitpilot-barber.v1";

/**
 * @param storage something with getItem/setItem/removeItem (window.localStorage in the browser; a fake in tests).
 *   Accessing localStorage itself can throw, so callers pass a function that returns it.
 */
export function createStore(getStorage) {
  let storage = null;
  try { storage = getStorage(); } catch { storage = null; }

  const store = {
    /** false once saving has failed: the app shows "Can't save on this device". */
    ok: Boolean(storage),
    /** true when saved data couldn't be read; it is left untouched until the owner imports or edits. */
    unreadable: false,

    /** The saved document, or the sample data on a first visit (sample months are regenerated, never stored). */
    load() {
      let text = null;
      try { text = storage?.getItem(KEY) ?? null; } catch { store.ok = false; }
      if (text == null) return sampleData();
      try {
        const doc = JSON.parse(text);
        if (doc?.version !== 1 || typeof doc.months !== "object") throw new Error("unknown version");
        if (doc.sample) doc.months = sampleData().months;
        return doc;
      } catch {
        store.unreadable = true;
        return sampleData();
      }
    },

    /** Save the document. Sample months are left out (they are regenerated). Returns false if it couldn't be saved. */
    save(doc) {
      if (!storage) { store.ok = false; return false; }
      try {
        const toSave = doc.sample ? { ...doc, months: {} } : doc;
        storage.setItem(KEY, JSON.stringify(toSave));
        store.unreadable = false; // the owner's new data replaced the unreadable copy
        store.ok = true;
        return true;
      } catch {
        store.ok = false; // quota exceeded or blocked
        return false;
      }
    },

    /** Clear All Data: forget everything; the sample months come back. */
    clear() {
      try { storage?.removeItem(KEY); } catch { /* nothing saved to clear */ }
      store.unreadable = false;
      return sampleData();
    },
  };
  return store;
}
