import { useCallback, useEffect } from "react";

/**
 * Provides a window unload warning and confirm dialog helper when unsaved changes exist.
 */
export function useUnsavedChangesWarning(hasUnsavedChanges: boolean, message = "You have unsaved changes. Leave without saving?") {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges, message]);

  return useCallback(() => {
    if (!hasUnsavedChanges) return true;
    return window.confirm(message);
  }, [hasUnsavedChanges, message]);
}
