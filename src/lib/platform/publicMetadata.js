const SITE_NAME = "Daxora";
const PUBLIC_ORIGIN = "https://www.daxora.co.uk";

export function applyPublicMetadata({ title, description, path = "/", robots = "index,follow" } = {}) {
  if (typeof document === "undefined") return;
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Connected operations for grassroots sport`;
  const canonical = new URL(path || "/", PUBLIC_ORIGIN).toString();
  document.title = fullTitle;

  const values = [
    ["meta[name='description']", "content", description],
    ["meta[name='robots']", "content", robots],
    ["meta[property='og:title']", "content", fullTitle],
    ["meta[property='og:description']", "content", description],
    ["meta[property='og:url']", "content", canonical],
    ["link[rel='canonical']", "href", canonical],
  ];
  for (const [selector, attribute, value] of values) {
    const node = document.querySelector(selector);
    if (node && value) node.setAttribute(attribute, value);
  }
}

export function applyAppMetadata() {
  if (typeof document === "undefined") return;
  document.title = "Daxora Platform";
  document.querySelector("meta[name='robots']")?.setAttribute("content", "noindex,nofollow");
  document.querySelector("meta[name='description']")?.setAttribute("content", "Secure access to your Daxora products and organisation workspaces.");
}
