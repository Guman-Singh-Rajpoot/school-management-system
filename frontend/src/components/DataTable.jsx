export default function DataTable({ columns, rows, loading, emptyText = 'No records found.' }) {
  if (loading) {
    return <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  }
  if (!rows || rows.length === 0) {
    return <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">{emptyText}</div>;
  }
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
            {columns.map((c) => (
              <th key={c.key} className="px-5 py-2 font-medium whitespace-nowrap">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40">
              {columns.map((c) => (
                <td key={c.key} className="px-5 py-2.5 whitespace-nowrap">
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
