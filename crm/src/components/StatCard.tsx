interface Props {
  label: string;
  value: number | string;
  icon: string;
  trend?: { value: number; label: string };
  color: 'indigo' | 'emerald' | 'amber' | 'violet' | 'blue' | 'red';
}

const COLORS = {
  indigo:  'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  amber:   'bg-amber-500/10 border-amber-500/20 text-amber-400',
  violet:  'bg-violet-500/10 border-violet-500/20 text-violet-400',
  blue:    'bg-blue-500/10 border-blue-500/20 text-blue-400',
  red:     'bg-red-500/10 border-red-500/20 text-red-400',
};

export function StatCard({ label, value, icon, trend, color }: Props) {
  return (
    <div className={`rounded-2xl border p-5 ${COLORS[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {trend && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            trend.value >= 0
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-red-500/15 text-red-400'
          }`}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-t1">{value}</p>
      <p className="text-xs text-t2 mt-1 uppercase tracking-wider font-medium">{label}</p>
    </div>
  );
}
