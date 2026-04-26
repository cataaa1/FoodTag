export type AdminLanguage = "es" | "en";

export const ADMIN_DARK_MODE_STORAGE_KEY = "foodtag-admin-dark-mode";
export const ADMIN_LANGUAGE_STORAGE_KEY = "foodtag-admin-language";
export const ADMIN_PREFERENCES_EVENT = "foodtag-admin-preferences-updated";

function dispatchPreferencesEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(ADMIN_PREFERENCES_EVENT));
}

export function readStoredDarkMode() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(ADMIN_DARK_MODE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeStoredDarkMode(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ADMIN_DARK_MODE_STORAGE_KEY, value ? "true" : "false");
  } catch {
    return;
  }

  dispatchPreferencesEvent();
}

export function readStoredAdminLanguage(): AdminLanguage {
  if (typeof window === "undefined") {
    return "es";
  }

  try {
    return window.localStorage.getItem(ADMIN_LANGUAGE_STORAGE_KEY) === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}

export function writeStoredAdminLanguage(value: AdminLanguage) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ADMIN_LANGUAGE_STORAGE_KEY, value);
  } catch {
    return;
  }

  dispatchPreferencesEvent();
}
