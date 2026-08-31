import { useEffect, useState } from 'react';
import api from '../api/client';
import Card from '../components/Card';
import DataTable from '../components/DataTable';

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

export default function ApiListPage({
  title,
  description,
  endpoint,
  columns = [],
  emptyText = 'No records found.',
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    try {
      const response = await api.get(endpoint);

      const data = response.data;

      if (Array.isArray(data)) {
        setRows(data);
      } else if (Array.isArray(data.results)) {
        setRows(data.results);
      } else {
        setRows([]);
      }
    } catch (err) {
      console.error(`Failed to load ${endpoint}`, err);

      setError(
        err.response?.data?.detail ||
        `Unable to load data from ${endpoint}`
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const tableColumns = columns.map((column) => ({
    key: column.key,
    header: column.header,
    render: (row) => formatValue(row[column.key]),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>

        {description && (
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {description}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <Card>
        <DataTable
          columns={tableColumns}
          rows={rows}
          loading={loading}
          emptyText={emptyText}
        />
      </Card>
    </div>
  );
}