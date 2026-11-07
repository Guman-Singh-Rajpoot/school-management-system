import { useState, useEffect } from 'react';
import api from '../api/client';
import Card from '../components/Card';
import {
  MessageSquare, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw,
  Send, Settings, Clock, Phone, Key, HelpCircle, Eye, EyeOff, Check, X
} from 'lucide-react';

export default function WhatsAppSettings() {
  const [activeTab, setActiveTab] = useState('config'); // 'config' | 'logs'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusInfo, setStatusInfo] = useState(null);
  const [config, setConfig] = useState({
    enabled: false,
    phone_number_id: '',
    access_token: '',
    api_version: 'v18.0',
    notify_announcements: true,
    notify_fee_reminder: true,
    notify_fee_paid: true,
    notify_salary_paid: true,
    notify_account_created: true,
    notify_attendance: false,
  });

  const [showToken, setShowToken] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Logs state
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState({
    status: '',
    category: '',
    search: '',
  });
  const [retryingId, setRetryingId] = useState(null);

  // Load Status and Config
  async function loadConfigData() {
    try {
      setLoading(true);
      const [statusRes, configRes] = await Promise.allSettled([
        api.get('/announcements/whatsapp-config/status/'),
        api.get('/announcements/whatsapp-config/'),
      ]);

      if (statusRes.status === 'fulfilled') {
        setStatusInfo(statusRes.value.data);
      }

      if (configRes.status === 'fulfilled') {
        const data = configRes.value.data;
        const row = Array.isArray(data?.results)
          ? data.results[0]
          : Array.isArray(data)
          ? data[0]
          : data;
        if (row) {
          setConfig((prev) => ({
            ...prev,
            ...row,
            access_token: '', // write-only from backend
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load WhatsApp config:', err);
    } finally {
      setLoading(false);
    }
  }

  // Load Logs
  async function loadLogs() {
    try {
      setLogsLoading(true);
      const params = {};
      if (logFilter.status) params.status = logFilter.status;
      if (logFilter.category) params.category = logFilter.category;
      if (logFilter.search) params.search = logFilter.search;

      const res = await api.get('/announcements/whatsapp-notifications/', { params });
      const data = res.data?.results || (Array.isArray(res.data) ? res.data : []);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load notification logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }

  useEffect(() => {
    loadConfigData();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab, logFilter.status, logFilter.category]);

  // Handle Config Save
  async function handleSaveConfig(e) {
    e.preventDefault();
    setSaving(true);
    setFeedback({ type: '', message: '' });

    try {
      const payload = {
        enabled: config.enabled,
        phone_number_id: config.phone_number_id,
        api_version: config.api_version,
        notify_announcements: config.notify_announcements,
        notify_fee_reminder: config.notify_fee_reminder,
        notify_fee_paid: config.notify_fee_paid,
        notify_salary_paid: config.notify_salary_paid,
        notify_account_created: config.notify_account_created,
        notify_attendance: config.notify_attendance,
      };

      if (config.access_token && config.access_token.trim()) {
        payload.access_token = config.access_token.trim();
      }

      // Config uses row pk=1
      let res;
      try {
        res = await api.patch('/announcements/whatsapp-config/1/', payload);
      } catch (patchErr) {
        // If 404/not created yet, fallback to POST
        res = await api.post('/announcements/whatsapp-config/', payload);
      }

      setFeedback({
        type: 'success',
        message: 'WhatsApp configuration saved successfully!',
      });
      loadConfigData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to save configuration. Please verify credentials.',
      });
    } finally {
      setSaving(false);
    }
  }

  // Handle Retry
  async function handleRetry(notificationId) {
    try {
      setRetryingId(notificationId);
      await api.post(`/announcements/whatsapp-notifications/${notificationId}/retry/`);
      loadLogs();
    } catch (err) {
      alert(err.response?.data?.detail || 'Retry failed.');
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <MessageSquare className="w-7 h-7 text-emerald-600" />
            WhatsApp & Notifications
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Configure Meta WhatsApp Business Cloud API and monitor message delivery logs.
          </p>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2">
          {statusInfo?.is_configured ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              WhatsApp Service Active
              {statusInfo?.using_env_vars && <span className="opacity-75">(via .env)</span>}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              WhatsApp Inactive / Not Configured
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex gap-6">
        <button
          onClick={() => setActiveTab('config')}
          className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'config'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          API Configuration & Triggers
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'logs'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          Notification Audit History
        </button>
      </div>

      {/* TAB 1: CONFIGURATION */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {feedback.message && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <form onSubmit={handleSaveConfig} className="space-y-6">
            {/* Master Switch Card */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Enable WhatsApp Messaging
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  When enabled, the system will deliver real-time WhatsApp alerts for enabled events.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* API Credentials */}
            <Card title="Meta WhatsApp Business Cloud API Credentials">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    Phone Number ID
                  </label>
                  <input
                    type="text"
                    value={config.phone_number_id || ''}
                    onChange={(e) => setConfig({ ...config, phone_number_id: e.target.value })}
                    placeholder="e.g. 104593829104812"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">Found in your Meta App Dashboard under WhatsApp &gt; API Setup.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    Permanent Access Token
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={config.access_token || ''}
                      onChange={(e) => setConfig({ ...config, access_token: e.target.value })}
                      placeholder="Enter new token (leave blank to keep unchanged)"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">System user access token with whatsapp_business_messaging permission.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Graph API Version
                  </label>
                  <input
                    type="text"
                    value={config.api_version || 'v18.0'}
                    onChange={(e) => setConfig({ ...config, api_version: e.target.value })}
                    placeholder="v18.0"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </Card>

            {/* Notification Trigger Toggles */}
            <Card title="Automated Event Triggers">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Choose which school events automatically generate and send WhatsApp messages:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    key: 'notify_account_created',
                    label: 'New Account Credentials',
                    desc: 'Sends login username & temporary password to newly registered students & teachers.',
                  },
                  {
                    key: 'notify_fee_paid',
                    label: 'Fee Payment Receipts',
                    desc: 'Sends instant payment receipt and balance update when student fees are recorded.',
                  },
                  {
                    key: 'notify_fee_reminder',
                    label: 'Fee Due Reminders',
                    desc: 'Sends fee overdue reminders to students/parents.',
                  },
                  {
                    key: 'notify_salary_paid',
                    label: 'Teacher Salary Credit Alert',
                    desc: 'Notifies teachers immediately when their monthly salary or disbursement is recorded.',
                  },
                  {
                    key: 'notify_announcements',
                    label: 'Published Announcements',
                    desc: 'Dispatches published school announcements directly to targeted students/teachers.',
                  },
                  {
                    key: 'notify_attendance',
                    label: 'Student Absence Alerts',
                    desc: 'Sends instant alert to parents if student is marked Absent.',
                  },
                ].map(({ key, label, desc }) => (
                  <div
                    key={key}
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30"
                  >
                    <div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={Boolean(config[key])}
                        onChange={(e) => setConfig({ ...config, [key]: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </Card>

            {/* Submit */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition flex items-center gap-2"
              >
                {saving ? 'Saving Settings...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Category Filter */}
              <select
                value={logFilter.category}
                onChange={(e) => setLogFilter({ ...logFilter, category: e.target.value })}
                className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 outline-none"
              >
                <option value="">All Categories</option>
                <option value="ACCOUNT_CREATED">Account Created</option>
                <option value="FEE_PAID">Fee Paid Receipt</option>
                <option value="FEE_REMINDER">Fee Reminder</option>
                <option value="SALARY_PAID">Salary Payment</option>
                <option value="ANNOUNCEMENT">Announcement</option>
                <option value="ATTENDANCE_ALERT">Attendance Alert</option>
              </select>

              {/* Status Filter */}
              <select
                value={logFilter.status}
                onChange={(e) => setLogFilter({ ...logFilter, status: e.target.value })}
                className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 outline-none"
              >
                <option value="">All Statuses</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
                <option value="PENDING">Pending</option>
                <option value="NOT_CONFIGURED">Not Configured</option>
              </select>

              {/* Search */}
              <input
                type="text"
                placeholder="Search phone or text..."
                value={logFilter.search}
                onChange={(e) => setLogFilter({ ...logFilter, search: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
                className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 outline-none w-48"
              />
            </div>

            <button
              onClick={loadLogs}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 text-slate-700 dark:text-slate-300 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Message Preview</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Sent / Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logsLoading && logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400">
                        Loading notifications...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400">
                        No WhatsApp notifications recorded yet.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {log.recipient_name || '—'}
                          </div>
                          <div className="text-slate-400 font-mono text-[11px]">
                            {log.recipient_number}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full font-medium text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {log.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate text-slate-600 dark:text-slate-300" title={log.message_body}>
                          {log.message_body}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full font-medium text-[10px] inline-flex items-center gap-1 ${
                              log.status === 'SENT'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : log.status === 'FAILED'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {log.status}
                          </span>
                          {log.error_message && (
                            <div className="text-[10px] text-rose-500 max-w-xs truncate mt-0.5" title={log.error_message}>
                              {log.error_message}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                          {log.sent_at
                            ? new Date(log.sent_at).toLocaleString('en-IN')
                            : new Date(log.created_at).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          {log.status === 'FAILED' && (
                            <button
                              onClick={() => handleRetry(log.id)}
                              disabled={retryingId === log.id}
                              className="px-2.5 py-1 text-xs rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 transition font-medium"
                            >
                              {retryingId === log.id ? 'Retrying...' : 'Retry'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
