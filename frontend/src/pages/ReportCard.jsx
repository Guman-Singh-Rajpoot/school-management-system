import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import { GraduationCap } from "lucide-react";

export default function ReportCard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const studentId = searchParams.get("student") || "";
  const examId = searchParams.get("exam") || "";

  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [report, setReport] = useState(null);
  const [loadingCard, setLoadingCard] = useState(false);
  const [error, setError] = useState("");

  const isStudent =
    ["STUDENT"].includes(String(user?.role || "").toUpperCase());

  useEffect(() => {
    async function loadOptions() {
      setOptionsLoading(true);
      try {
        const [studentRes, examRes] = await Promise.allSettled([
          api.get("/api/students/", { params: { page_size: 200 } }),
          api.get("/api/exams/exams/"),
        ]);
        if (studentRes.status === "fulfilled") {
          const data = studentRes.value.data;
          setStudents(Array.isArray(data) ? data : data?.results || []);
        }
        if (examRes.status === "fulfilled") {
          const data = examRes.value.data;
          setExams(Array.isArray(data) ? data : data?.results || []);
        }
      } finally {
        setOptionsLoading(false);
      }
    }
    loadOptions();
  }, []);

  // Students can only ever see their own report card; pre-select it.
  useEffect(() => {
    if (isStudent && !studentId && students.length > 0) {
      const own = students[0];
      const params = new URLSearchParams(searchParams);
      params.set("student", String(own.id));
      setSearchParams(params, { replace: true });
    }
  }, [isStudent, students, studentId]);

  useEffect(() => {
    let cancelled = false;

    async function loadReportCard() {
      setLoadingCard(true);
      setError("");
      try {
        const res = await api.get("/api/exams/marks/report_card/", {
          params: { student: studentId, exam: examId },
        });
        if (!cancelled) setReport(res.data);
      } catch (err) {
        console.error("Failed to load report card:", err);
        if (!cancelled) {
          setReport(null);
          setError(
            err.response?.data?.detail ||
              err.response?.data?.message ||
              "Unable to load report card."
          );
        }
      } finally {
        if (!cancelled) setLoadingCard(false);
      }
    }

    if (studentId && examId) {
      loadReportCard();
    } else {
      setReport(null);
      setLoadingCard(false);
    }
    return () => {
      cancelled = true;
    };
  }, [studentId, examId]);

  const updateParams = (next) => {
    const merged = { student: studentId, exam: examId, ...next };
    const params = new URLSearchParams();
    if (merged.student) params.set("student", merged.student);
    if (merged.exam) params.set("exam", merged.exam);
    setSearchParams(params, { replace: true });
  };

  const marks = report?.subjects || [];
  const totalMarks = report?.total_marks_obtained ?? 0;
  const totalMaxMarks = report?.total_max_marks ?? 0;
  const percentage = report?.percentage ?? 0;
  const rank = report?.rank ?? null;
  const selectedStudent = students.find((s) => String(s.id) === studentId);
  const selectedExam = exams.find((e) => String(e.id) === examId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Report Cards</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {isStudent
            ? "View your report card for an examination."
            : "Select a student and examination to view the report card."}
        </p>
      </div>

      <Card title="Select">
        <div className="flex flex-wrap gap-3">
          {!isStudent && (
            <select
              value={studentId}
              onChange={(e) => updateParams({ student: e.target.value })}
              disabled={optionsLoading}
              className="rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-48"
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || s.admission_number}
                </option>
              ))}
            </select>
          )}

          <select
            value={examId}
            onChange={(e) => updateParams({ exam: e.target.value })}
            disabled={optionsLoading}
            className="rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-48"
          >
            <option value="">Select examination</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name} ({exam.exam_type})
              </option>
            ))}
          </select>
        </div>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {!studentId || !examId ? (
        <Card>
          <p className="text-sm text-slate-500">
            Choose a student and an examination above to see the report card.
          </p>
        </Card>
      ) : loadingCard ? (
        <Card>
          <p className="text-sm text-slate-500">Loading report card...</p>
        </Card>
      ) : report ? (
        <>
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <GraduationCap size={28} className="text-brand-600" />
              <div>
                <h2 className="text-xl font-semibold">
                  {selectedExam?.name || `Exam #${examId}`}
                </h2>
                <p className="text-sm text-slate-500">
                  {selectedStudent?.full_name ||
                    marks[0]?.student_name ||
                    `Student #${studentId}`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-2">
              <div>
                <p className="font-medium text-sm text-slate-500">Obtained</p>
                <p className="text-3xl font-bold text-brand-600">{totalMarks}</p>
              </div>
              <div>
                <p className="font-medium text-sm text-slate-500">Total</p>
                <p className="text-3xl font-bold">{totalMaxMarks}</p>
              </div>
              <div>
                <p className="font-medium text-sm text-slate-500">Percentage</p>
                <p className="text-3xl font-bold">{percentage}%</p>
              </div>
            </div>

            {rank !== null && (
              <div className="mb-2 p-3 rounded-lg bg-brand-50 dark:bg-slate-800">
                <p className="font-medium">Rank</p>
                <p className="text-2xl font-bold">#{rank}</p>
              </div>
            )}
          </Card>

          <Card title="Subject Marks">
            <DataTable
              columns={[
                { key: "subject_name", header: "Subject" },
                { key: "marks_obtained", header: "Obtained" },
                { key: "max_marks", header: "Max Marks" },
                {
                  key: "grade_name",
                  header: "Grade",
                  render: (row) => row.grade_name ?? "-",
                },
                {
                  key: "remarks",
                  header: "Remarks",
                  render: (row) => row.remarks || "-",
                },
              ]}
              rows={marks}
              loading={loadingCard}
              emptyText="No subject marks found."
            />
          </Card>
        </>
      ) : (
        <Card>
          <p className="text-sm text-slate-500">
            No results found for this student and examination.
          </p>
        </Card>
      )}
    </div>
  );
}
