export default function StatCard({ label, value, icon: Icon, accent = 'brand' }) {
  const accents = {
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-200',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-700/20 dark:text-emerald-200',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-700/20 dark:text-amber-200',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-700/20 dark:text-rose-200',
  };
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${accents[accent]}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-semibold leading-tight">{value}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      </div>
    </div>
  );
}
