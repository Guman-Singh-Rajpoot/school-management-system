export default function Card({ title, action, children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
