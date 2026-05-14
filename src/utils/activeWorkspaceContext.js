function buildActiveContextKey(userId) {
  return `stadione_active_workspace_context_${userId}`;
}

export function getStoredActiveWorkspaceContext(userId) {
  if (typeof window === 'undefined' || !userId) return null;

  try {
    const raw = window.localStorage.getItem(buildActiveContextKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function setStoredActiveWorkspaceContext(userId, context) {
  if (typeof window === 'undefined' || !userId || !context) return;

  try {
    window.localStorage.setItem(buildActiveContextKey(userId), JSON.stringify(context));
  } catch {
    // Ignore storage failure to avoid blocking auth flow.
  }
}

export function clearStoredActiveWorkspaceContext(userId) {
  if (typeof window === 'undefined' || !userId) return;

  try {
    window.localStorage.removeItem(buildActiveContextKey(userId));
  } catch {
    // Ignore storage failure to avoid blocking logout flow.
  }
}
