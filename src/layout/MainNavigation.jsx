import { createNavigationController, getMainNavigationItems } from "../lib/navigation/index.js";

export default function MainNavigation({ mainPage, setMainPage, setDayTab, setNavigationTarget, club }) {
  const navigation = createNavigationController({
    setMainPage,
    setDayTab,
    setNavigationTarget,
    defaultDay: "saturday",
  });

  const items = getMainNavigationItems().filter((item) =>
    ["dashboard", "operations", "reports", "settings"].includes(item.page)
  );

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }} className="np">
      {items.map((item) => (
        <button
          key={item.target}
          onClick={() => navigation.goTo(item.target)}
          style={{
            background: mainPage === item.page ? club.primary : "#fff",
            color: mainPage === item.page ? "#fff" : "#333",
            border: "1px solid #e5e7eb",
            borderRadius: 999,
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
