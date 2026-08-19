const FEED_ID_PATTERN = /^\d{5,12}$/;

export const LANCASHIRE_AMATEUR_FIXTURE_FEEDS = Object.freeze([
  { id: "329570196", name: "Lancashire Amateur League - Premier Division" },
  { id: "694052039", name: "Lancashire Amateur League - Division One" },
  { id: "853774480", name: "Lancashire Amateur League - Division Two" },
  { id: "17848835", name: "Lancashire Amateur League - Division Three" },
  { id: "632766284", name: "Lancashire Amateur League - Division Four" },
]);

export function normaliseFullTimeFeedId(value) {
  const text = String(value || "").trim();
  if (FEED_ID_PATTERN.test(text)) return text;
  try {
    const url = new URL(text);
    if (!["fulltime.thefa.com", "www.fulltime.thefa.com"].includes(url.hostname.toLowerCase())) return "";
    const id = String(url.searchParams.get("cs") || "").trim();
    return FEED_ID_PATTERN.test(id) ? id : "";
  } catch {
    return "";
  }
}

export function buildFullTimeFeedDocument(feedId) {
  const id = normaliseFullTimeFeedId(feedId);
  if (!id) throw new Error("Enter a valid numeric Full-Time code-snippet feed ID.");
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="lrep${id}">Data loading...</div><script>var lrcode='${id}'</script><script src="https://fulltime.thefa.com/client/api/cs1.js"></script></body></html>`;
}

export function loadFullTimeFeedHtml(feedId, { timeoutMs = 20000, documentRef = globalThis.document } = {}) {
  const id = normaliseFullTimeFeedId(feedId);
  if (!id) return Promise.reject(new Error("Enter a valid numeric Full-Time code-snippet feed ID."));
  if (!documentRef?.body) return Promise.reject(new Error("The official Full-Time feed must be loaded in a browser."));

  return new Promise((resolve, reject) => {
    const frame = documentRef.createElement("iframe");
    frame.title = "Full-Time fixture feed";
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;width:1px;height:1px;left:-10000px;top:-10000px;border:0;opacity:0;pointer-events:none";
    const started = Date.now();
    let timer;

    const finish = (error, html = "") => {
      clearInterval(timer);
      frame.remove();
      if (error) reject(error);
      else resolve(html);
    };

    frame.srcdoc = buildFullTimeFeedDocument(id);
    documentRef.body.appendChild(frame);
    timer = setInterval(() => {
      try {
        const childDocument = frame.contentDocument;
        const target = childDocument?.getElementById(`lrep${id}`);
        const hasFixtures = Boolean(target?.querySelector("table") || target?.querySelectorAll("a[href*='displayFixture']").length);
        const stillLoading = /data loading/i.test(target?.textContent || "");
        if (target && hasFixtures && !stillLoading) {
          finish(null, childDocument.documentElement.outerHTML);
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          finish(new Error("The official Full-Time browser feed did not finish loading."));
        }
      } catch (error) {
        finish(new Error(`The official Full-Time browser feed could not be read: ${error.message}`));
      }
    }, 250);
  });
}
