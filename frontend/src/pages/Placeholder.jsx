export default function Placeholder({ title }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm">
        This module's backend API is fully built (see /api/docs/). This screen is a build slot —
        wire it up the same way StudentsList.jsx is wired to /api/students/.
      </p>
    </div>
  );
}
