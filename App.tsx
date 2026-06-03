import { KpiCards } from "@/components/KpiCards";
import { ChartsSection } from "@/components/ChartsSection";
import { ClientTable } from "@/components/ClientTable";
import { Receipt, LogOut, User } from "lucide-react";

function App() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-700/50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Receipt className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-slate-100 font-bold text-base leading-tight">
                  CityBens
                </h1>
                <p className="text-slate-500 text-[10px] leading-tight">
                  CRM Profissional de Boletos
                </p>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full ml-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                ao vivo
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                <User className="w-3.5 h-3.5" />
                Olá, Celio
              </span>
              <button className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-xs px-3 py-1.5 border border-slate-600 hover:border-slate-500 rounded-lg transition-colors">
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Cards */}
        <KpiCards />

        {/* Charts */}
        <ChartsSection />

        {/* Client Table */}
        <ClientTable />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 mt-8 py-4">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-600 text-xs">
          CityBens CRM &copy; 2026 - Controle Profissional de Boletos
        </div>
      </footer>
    </div>
  );
}

export default App;
