import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import { GraduationCap, ChartBar, AlertCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";

export default function ReportCard() {
  const { user } = useAuth();
  const { studentId, examId } = useParams();
  const [searchParams] = useSearchParams();
  const loading = searchParams.get("loading") === "1" || true;
  const [exam, setExam] = useState(null);
  const [marks, setMarks] = useState([]);
  const [totalMarks, setTotalMarks] = useState(0);
  const [totalMaxMarks, setTotalMaxMarks] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [rank, setRank] = useState(null);
  const [loadingCard, setLoadingCard] = useState(true);
  const [error, setError] = useState("");

  const isStudent = ["STUDENT"].includes(String(user?.role || "").toUpperCase());
  const canView =
    isStudent
      ? user.id === Number(studentId) || user.id === Number(searchParams.get("self"))
      : ["ADMIN", "OWNER"].includes(String(user?.role || "").toUpperCase());

  if (!studentId || !examId) {
    return (
      <div className="p-8">
        <h1 className="text-xl">Report Card</h1>
        <p>Select a student and examination to view the report card.</p>
      </div>
    );
  }

  async function loadReportCard() {
    setLoadingCard(true);
    setError("");
    try {
      const res = await api.get("/api/exams/marks/report_card/", {
        params: { student: studentId, exam: examId },
      });
      const data = res.data;
      setExam(data.exam_id ? { id: data.exam_id, name: data.exam_name } : null);
      setMarks(data.subjects || []);
      setTotalMarks(data.total_marks_obtained || 0);
      setTotalMaxMarks(data.total_max_marks || 0);
      setPercentage(data.percentage || 0);
      setRank(data.rank || null);
    } catch (err) {
      console.error("Failed to load report card:", err);
      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Unable to load report card."
      );
    } finally {
      setLoadingCard(false);
    }
  }

  useEffect(() => {
    loadReportCard();
  }, [studentId, examId]);

  if (loadingCard) {
    return (
      <div className="p-8">
        <h1 className="text-xl">Report Card</h1>
        <p className="text-slate-500">Loading report card...</p>
      </div>
    );
  }

  const calcPercentage = totalMarks && totalMaxMarks
    ? ((Number(totalMarks) / Number(totalMaxMarks)) * 100).toFixed(2)
    : "0.00";

  // Grade determination
  let grade = "N/A";
  if (percentage && Number(percentage) >= 90) grade = "A";
  else if (Number(percentage) >= 80) grade = "B";
  else if (Number(percentage) >= 70) grade = "C";
  else if (Number(percentage) >= 60) grade = "D";
  else if (Number(percentage) >= 50) grade = "E";
  else grade = "F";

  if (!marks.length && !exam) {
    return (
      <div className="p-8">
        <h1 className="text-xl">Report Card</h1>
        <p className="text-slate-500">No results found for this student and examination.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <h1 className="text-2xl font-semibold">
          Report Card - {exam?.name || "Exam"} &nbsp;|&nbsp; {marks.length > 0 ? marks[0]?.student_name || "Student" : "N/A"}
        </h1>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="font-medium">Student</p>
            <p className="mt-1">{marks[0]?.student_name || "N/A"}</p>
          </div>
          <div>
            <p className="font-medium">Exam</p>
            <p className="mt-1">{exam?.name || "N/A"}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <p className="font-medium text-lg">Obtained</p>
            <p className="text-3xl font-bold text-brand-600">{totalMarks}</p>
          </div>
          <div>
            <p className="font-medium text-lg">Total</p>
            <p className="text-3xl font-bold">{totalMaxMarks}</p>
          </div>
          <div>
            <p className="font-medium text-lg">Percentage</p>
            <p className="text-3xl font-bold">{calcPercentage}%</p>
          </div>
        </div>

        {rank !== null && (
          <div className="mb-4 p-3 rounded-lg bg-brand-50">
            <p className="font-medium">Rank</p>
            <p className="text-2xl font-bold">#{rank}</p>
          </div>
        )}

        <Card title="Subject Marks">
          <DataTable
            columns={[
              { key: "subject_name", header: "Subject" },
              { key: "marks_obtained", header: "Obtained" },
              { key: "max_marks", header: "Max Marks" },
              { key: "grade", header: "Grade" },
              { key: "remarks", header: "Remarks" },
            ]}
            rows={marks}
            loading={loadingCard}
            emptyText="No subject marks found."
          />
        </Card>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Permission notice */}
      {isStudent && (
        <p className="text-xs text-slate-500">
          You can only view your own report card. Select your student ID to access it.
        </p>
      )}
    </div>
  );
}