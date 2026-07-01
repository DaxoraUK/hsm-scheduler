export const spacing = {
  xs: "0.5rem",
  sm: "0.75rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
};

export const radius = {
  md: "rounded-2xl",
  lg: "rounded-3xl",
  pill: "rounded-full",
};

export const statusTone = {
  ready: "success",
  success: "success",
  watch: "warning",
  warning: "warning",
  review: "warning",
  danger: "danger",
  error: "danger",
  neutral: "neutral",
  info: "info",
};

export function normaliseStatusTone(tone = "neutral") {
  return statusTone[tone] || "neutral";
}
