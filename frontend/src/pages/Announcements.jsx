import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Announcements() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    message: "",
    audience: "ALL",
  });

  const [saving, setSaving] = useState(false);

  // ============================================================
  // LOAD ANNOUNCEMENTS
  // ============================================================

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/announcements/");

      const data = response.data;

      // Django REST Framework pagination
      if (Array.isArray(data)) {
        setAnnouncements(data);
      } else if (Array.isArray(data?.results)) {
        setAnnouncements(data.results);
      } else {
        setAnnouncements([]);
      }
    } catch (err) {
      console.error("Announcements error:", err);

      if (err.response?.status === 401) {
        setError("You are not authenticated. Please login again.");
      } else {
        setError(
          err.response?.data?.detail ||
            "Unable to load announcements."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  // ============================================================
  // FORM CHANGE
  // ============================================================

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // ============================================================
  // CREATE ANNOUNCEMENT
  // ============================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim() || !form.message.trim()) {
      setError("Title and message are required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await api.post("/announcements/", {
        title: form.title.trim(),
        message: form.message.trim(),
        audience: form.audience,
      });

      setForm({
        title: "",
        message: "",
        audience: "ALL",
      });

      await loadAnnouncements();

    } catch (err) {
      console.error("Create announcement error:", err);

      setError(
        err.response?.data?.detail ||
          "Unable to create announcement."
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // DELETE ANNOUNCEMENT
  // ============================================================

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this announcement?"
    );

    if (!confirmDelete) {
      return;
    }

    try {
      await api.delete(`/announcements/${id}/`);

      setAnnouncements((previous) =>
        previous.filter((item) => item.id !== id)
      );

    } catch (err) {
      console.error("Delete announcement error:", err);

      setError(
        err.response?.data?.detail ||
          "Unable to delete announcement."
      );
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-semibold">
          Notifications & Announcements
        </h1>

        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Create and manage school announcements.
        </p>
      </div>

      {/* ERROR */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 p-3">
          {error}
        </div>
      )}

      {/* CREATE ANNOUNCEMENT */}
      {isAdmin && (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">

        <h2 className="text-lg font-semibold mb-4">
          Post New Announcement
        </h2>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >

          {/* TITLE */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Title
            </label>

            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Enter announcement title"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* MESSAGE */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Message
            </label>

            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              rows={5}
              placeholder="Write announcement..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* AUDIENCE */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Audience
            </label>

            <select
              name="audience"
              value={form.audience}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Everyone</option>
              <option value="STUDENTS">Students</option>
              <option value="TEACHERS">Teachers</option>
            </select>
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Posting..." : "Post Announcement"}
          </button>

        </form>
      </div>
      )}

      {/* ANNOUNCEMENTS LIST */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">

        <div className="flex items-center justify-between mb-4">

          <h2 className="text-lg font-semibold">
            All Announcements
          </h2>

          <button
            onClick={loadAnnouncements}
            className="text-sm text-blue-600 hover:underline"
          >
            Refresh
          </button>

        </div>

        {/* LOADING */}
        {loading && (
          <p className="text-slate-500">
            Loading announcements...
          </p>
        )}

        {/* EMPTY */}
        {!loading && announcements.length === 0 && (
          <div className="text-center py-10 text-slate-500">
            No announcements available.
          </div>
        )}

        {/* LIST */}
        {!loading && announcements.length > 0 && (
          <div className="space-y-3">

            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="rounded-lg border border-slate-200 dark:border-slate-800 p-4"
              >

                <div className="flex items-start justify-between gap-4">

                  <div className="flex-1">

                    <h3 className="font-semibold text-lg">
                      {announcement.title}
                    </h3>

                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {announcement.message}
                    </p>

                    {announcement.created_at && (
                      <p className="mt-3 text-xs text-slate-400">
                        {new Date(
                          announcement.created_at
                        ).toLocaleString("en-IN")}
                      </p>
                    )}

                  </div>

                  {/* DELETE */}
                  {isAdmin && announcement.id && (
                    <button
                      onClick={() =>
                        handleDelete(announcement.id)
                      }
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  )}

                </div>

              </div>
            ))}

          </div>
        )}

      </div>

    </div>
  );
}