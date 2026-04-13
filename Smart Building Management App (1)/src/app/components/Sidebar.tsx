import { LayoutDashboard, Zap, Thermometer, Bell, BarChart3, Building2, Users, Settings, ChevronDown, CalendarClock } from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard },
    { id: 'energy', icon: Zap },
    { id: 'environment', icon: Thermometer },
    { id: 'occupancy', icon: Users },
    { id: 'reservation', icon: CalendarClock },
    { id: 'building', icon: Building2 },
    { id: 'alerts', icon: Bell },
    { id: 'analytics', icon: BarChart3 },
  ];

  return (
    <aside className="h-full w-24 px-5 py-8">
      <div className="h-full rounded-[28px] bg-white/65 backdrop-blur-xl border border-white/70 shadow-[0_20px_50px_rgba(0,0,0,0.08)] flex flex-col items-center py-4">
        <button className="mb-5 rounded-full bg-white shadow-md p-2.5">
          <Building2 className="w-5 h-5 text-zinc-700" />
        </button>

        <nav className="flex-1 flex flex-col items-center gap-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`
                size-11 rounded-2xl transition-all duration-200 grid place-items-center
                ${isActive
                  ? 'bg-white text-[#f4b400] shadow-md'
                  : 'text-zinc-500 hover:bg-white/70 hover:text-zinc-700'
                }
              `}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
        </nav>

        <div className="pt-3 border-t border-zinc-300/60 flex flex-col items-center gap-3">
          <button className="size-11 rounded-2xl text-zinc-500 hover:bg-white/70 hover:text-zinc-700 grid place-items-center">
            <Settings className="w-5 h-5" />
          </button>
          <button className="size-10 rounded-2xl text-zinc-400 hover:bg-white/70 hover:text-zinc-700 grid place-items-center">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
