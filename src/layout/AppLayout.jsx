export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-72 border-r border-slate-800 bg-slate-900">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-emerald-400">
            Daxora
          </h1>

          <p className="text-slate-400">
            Ground Control
          </p>
        </div>

        <nav className="px-4 space-y-2">
          <NavItem active>Dashboard</NavItem>
          <NavItem>Fixtures</NavItem>
          <NavItem>Scheduling</NavItem>
          <NavItem>Pitches</NavItem>
          <NavItem>Car Parks</NavItem>
          <NavItem>Managers</NavItem>
          <NavItem>Officials</NavItem>
          <NavItem>Reports</NavItem>
          <NavItem>Settings</NavItem>
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">

        <header className="h-16 border-b border-slate-800 bg-slate-900 px-8 flex items-center justify-between">

          <div>
            <h2 className="font-semibold text-lg">
              Ground Control
            </h2>
          </div>

          <div className="text-slate-400">
            Andrew
          </div>

        </header>

        <main className="flex-1 p-8 overflow-auto">
          {children}
        </main>

      </div>
    </div>
  );
}

function NavItem({ children, active }) {
  return (
    <button
      className={`w-full rounded-xl px-4 py-3 text-left transition ${
        active
          ? "bg-emerald-500 text-slate-950 font-semibold"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}