import { useEffect, useState } from 'react';
import api from '../api/client';
import { Upload, Download, Trash2, FileText } from 'lucide-react';

/**
 * Upload / list / download / delete documents attached to a student or teacher.
 *
 * ownerField: 'student' | 'teacher'  (FK field name on the document model)
 * ownerId: id of the student or teacher record
 * docTypes: [[value, label], ...]
 */
export default function DocumentsPanel({ endpoint, ownerField, ownerId, docTypes }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState(docTypes[0][0]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api
      .get(`/${endpoint}/documents/`, { params: { [ownerField]: ownerId } })
      .then((res) => setDocs(res.data.results || res.data || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append(ownerField, ownerId);
    formData.append('doc_type', docType);
    formData.append('file', file);
    try {
      await api.post(`/${endpoint}/documents/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFile(null);
      e.target.reset();
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this document?')) return;
    await api.delete(`/${endpoint}/documents/${id}/`);
    load();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Document type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          >
            {docTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">File</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            className="text-sm w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand-600 file:text-white file:text-sm hover:file:bg-brand-700"
          />
        </div>
        <button
          type="submit"
          disabled={!file || uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium"
        >
          <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        {loading ? (
          <p className="text-sm text-slate-500 py-4">Loading documents…</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No documents uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {docTypes.find(([v]) => v === doc.doc_type)?.[1] || doc.doc_type}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {doc.file?.split('/').pop()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={doc.file}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600"
                    aria-label="Download"
                  >
                    <Download size={16} />
                  </a>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-red-500"
                    aria-label="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
