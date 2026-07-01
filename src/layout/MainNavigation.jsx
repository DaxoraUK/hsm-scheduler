export default function MainNavigation({ mainPage, setMainPage, setDayTab, club }) {
  const items = [
    ["dashboard", "Dashboard"],
    ["operations", "Operations"],
    ["reports", "Reports"],
    ["settings", "Settings"],
  ];

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }} className="np">
      {items.map(([k, l]) => (
        <button
          key={k}
          onClick={() => {
            setMainPage(k);

            if (k === "operations") {
              setDayTab("saturday");
            }
          }}
          style={{
            background: mainPage === k ? club.primary : "#fff",
            color: mainPage === k ? "#fff" : "#333",
            border: "1px solid #e5e7eb",
            borderRadius: 999,
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}