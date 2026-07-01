const HSM_KW = ["horwich", "st mary", "st. mary", "hsm"];

export const SUN_TEAMS = ["lionesses", "sunday 1sts", "sunday firsts"];

export function isHSMHome(teamName) {
  return HSM_KW.some((keyword) =>
    (teamName || "").toLowerCase().includes(keyword)
  );
}

export function parseFullTimeHtml(html, targetDate) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out = [];
  const target = targetDate ? new Date(targetDate) : null;

  doc.querySelectorAll("table tr").forEach((row) => {
    const cells = [...row.querySelectorAll("td")].map((cell) =>
      cell.textContent.trim()
    );

    if (cells.length < 3) return;

    const home = cells[2] || cells[1] || "";
    const away = cells[4] || cells[3] || "";

    if (!home || !away || !isHSMHome(home)) return;

    if (target && cells[0]) {
      try {
        const match = cells[0].match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);

        if (match) {
          const date = new Date(
            (match[3].length === 2 ? "20" + match[3] : match[3]) +
              "-" +
              match[2].padStart(2, "0") +
              "-" +
              match[1].padStart(2, "0")
          );

          if (date.toDateString() !== target.toDateString()) return;
        }
      } catch (e) {}
    }

    out.push({
      homeTeam: home.trim(),
      awayTeam: away.trim(),
      date: cells[0],
      referee: "",
      refPhone: "",
      refStatus: "TBC",
      isCup: false,
      status: "active",
      league: "",
    });
  });

  return out;
}