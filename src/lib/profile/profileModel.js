export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 80;

export function normaliseDisplayName(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateDisplayName(value = "") {
  const displayName = normaliseDisplayName(value);
  const errors = [];

  if (displayName.length < DISPLAY_NAME_MIN_LENGTH) {
    errors.push("Enter a display name of at least two characters.");
  }
  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.push(`Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`);
  }
  if (/[\u0000-\u001f\u007f]/.test(displayName)) {
    errors.push("Display name contains unsupported control characters.");
  }

  return { displayName, errors };
}

export function getSessionDisplayName(session = null) {
  const user = session?.user || {};
  return normaliseDisplayName(
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Club Administrator"
  );
}

export function applyDisplayNameToSession(session = null, value = "") {
  if (!session?.user) return session;
  const displayName = normaliseDisplayName(value);
  return {
    ...session,
    user: {
      ...session.user,
      user_metadata: {
        ...(session.user.user_metadata || {}),
        display_name: displayName,
      },
    },
  };
}
