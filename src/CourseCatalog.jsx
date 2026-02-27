import { useState, useMemo } from "react";
import rawCourses from "../courses.json";

// ---------------------------------------------------------------------------
// Data normalisation
// Parsed JSON schema → component schema
// ---------------------------------------------------------------------------

function department(c) {
  // Collapse English sub-subjects into one "English" bucket — grade filter handles level.
  if (c.subject === "English") return "English";
  return c.sub_subject || c.subject;
}

const COURSES = rawCourses.map((c) => ({
  id: c.code,
  name: c.name,
  code: c.code,
  department: department(c),
  subject: c.subject,
  tracks: c.tracks,
  grades: c.grades,
  length: c.duration || "—",
  credits: c.credits ?? "—",
  prerequisite: c.prerequisites || "None",
  diploma: c.diploma_category || "—",
  description: c.description || "",
  notes: c.notes || "",
  fees: c.fees || "",
  ap: c.name.startsWith("AP "),
}));

const DEPARTMENTS = [...new Set(COURSES.map((c) => c.department))].sort();

// ---------------------------------------------------------------------------
// Styling constants
// ---------------------------------------------------------------------------

const GRADE_COLORS = {
  9:  { bg: "#e3f2fd", text: "#1565c0", border: "#90caf9" },
  10: { bg: "#e8f5e9", text: "#2e7d32", border: "#a5d6a7" },
  11: { bg: "#fff3e0", text: "#e65100", border: "#ffcc80" },
  12: { bg: "#fce4ec", text: "#880e4f", border: "#f48fb1" },
};

const DEPT_ICONS = {
  "Business & Marketing":    "💼",
  "Technology & Engineering":"⚙️",
  "Other CTE":               "🛠️",
  "Satellite Programs":      "🚀",
  "Flexible Credits":        "✨",
  "English":                 "📖",
  "Health & Fitness":        "🏃",
  "Mathematics":             "📐",
  "Science":                 "🔬",
  "Social Studies":          "🌍",
  "Special Education":       "💙",
  "Performing Arts":         "🎵",
  "Theatrical Arts":         "🎭",
  "Visual Arts":             "🎨",
  "World Languages":         "🌐",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CourseCatalog() {
  const [selectedGrades, setSelectedGrades] = useState(new Set([9, 10, 11, 12]));
  const [selectedDept, setSelectedDept] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [apOnly, setApOnly] = useState(false);

  const toggleGrade = (g) => {
    setSelectedGrades((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const filtered = useMemo(() => {
    return COURSES.filter((c) => {
      if (!c.grades.some((g) => selectedGrades.has(g))) return false;
      if (selectedDept !== "All" && c.department !== selectedDept) return false;
      if (apOnly && !c.ap) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.department.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedGrades, selectedDept, searchQuery, apOnly]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((c) => {
      if (!map[c.department]) map[c.department] = [];
      map[c.department].push(c);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div style={{ fontFamily: "'Segoe UI', -apple-system, sans-serif", background: "#f8f9fb", minHeight: "100vh" }}>
      {/* ── Header / Filters ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%)",
          color: "white",
          padding: "28px 24px 20px",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {/* Title */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <span style={{ fontSize: 28 }}>🦅</span>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px" }}>
                WHS Course Catalog 2026-27
              </h1>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
                Woodinville High School · {COURSES.length} courses
              </p>
            </div>
          </div>

          {/* Search */}
          <div style={{ marginTop: 14 }}>
            <input
              type="text"
              placeholder="Search courses by name, code, or keyword…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "none",
                fontSize: 14,
                background: "rgba(255,255,255,0.15)",
                color: "white",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Grade filters */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, opacity: 0.7, marginRight: 2 }}>Grade:</span>
            {[9, 10, 11, 12].map((g) => (
              <button
                key={g}
                onClick={() => toggleGrade(g)}
                style={{
                  padding: "5px 16px",
                  borderRadius: 20,
                  border: "2px solid",
                  borderColor: selectedGrades.has(g) ? GRADE_COLORS[g].border : "rgba(255,255,255,0.3)",
                  background: selectedGrades.has(g) ? GRADE_COLORS[g].bg : "transparent",
                  color: selectedGrades.has(g) ? GRADE_COLORS[g].text : "rgba(255,255,255,0.7)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {g}th
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setApOnly(!apOnly)}
              style={{
                padding: "5px 14px",
                borderRadius: 20,
                border: "2px solid",
                borderColor: apOnly ? "#ffca28" : "rgba(255,255,255,0.3)",
                background: apOnly ? "#fff8e1" : "transparent",
                color: apOnly ? "#f57f17" : "rgba(255,255,255,0.7)",
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              ⭐ AP Only
            </button>
          </div>

          {/* Department filter */}
          <div style={{ marginTop: 10 }}>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "none",
                fontSize: 13,
                background: "rgba(255,255,255,0.15)",
                color: "white",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="All" style={{ color: "#333" }}>All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d} style={{ color: "#333" }}>
                  {DEPT_ICONS[d] || "📚"} {d}
                </option>
              ))}
            </select>
            <span style={{ marginLeft: 12, fontSize: 13, opacity: 0.7 }}>
              {filtered.length} course{filtered.length !== 1 ? "s" : ""} shown
            </span>
          </div>
        </div>
      </div>

      {/* ── Course List ── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 16px 40px" }}>
        {grouped.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
            <p style={{ fontSize: 18 }}>No courses match your filters</p>
            <p style={{ fontSize: 14 }}>Try adjusting your grade or department selection</p>
          </div>
        )}

        {grouped.map(([dept, deptCourses]) => (
          <div key={dept} style={{ marginBottom: 24 }}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#37474f",
                margin: "0 0 10px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                position: "sticky",
                top: 180,
                background: "#f8f9fb",
                padding: "8px 0",
                zIndex: 10,
              }}
            >
              <span>{DEPT_ICONS[dept] || "📚"}</span> {dept}
              <span style={{ fontSize: 12, fontWeight: 400, color: "#90a4ae" }}>({deptCourses.length})</span>
            </h2>

            {deptCourses.map((course) => {
              const isOpen = expandedId === course.id;
              return (
                <div
                  key={course.id}
                  onClick={() => setExpandedId(isOpen ? null : course.id)}
                  style={{
                    background: "white",
                    borderRadius: 10,
                    marginBottom: 6,
                    cursor: "pointer",
                    border: isOpen ? "2px solid #3949ab" : "1px solid #e8eaed",
                    boxShadow: isOpen
                      ? "0 4px 16px rgba(57,73,171,0.12)"
                      : "0 1px 3px rgba(0,0,0,0.04)",
                    transition: "all 0.15s",
                    overflow: "hidden",
                  }}
                >
                  {/* Card header */}
                  <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "#212121" }}>{course.name}</span>
                        {course.ap && (
                          <span
                            style={{
                              background: "#fff8e1",
                              color: "#f57f17",
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              border: "1px solid #ffe082",
                            }}
                          >
                            AP
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#78909c", fontFamily: "monospace" }}>{course.code}</span>
                        <span style={{ color: "#ccc" }}>·</span>
                        <span style={{ fontSize: 11, color: "#78909c" }}>{course.length}</span>
                        <span style={{ color: "#ccc" }}>·</span>
                        <span style={{ fontSize: 11, color: "#78909c" }}>{course.credits} cr</span>
                      </div>
                    </div>
                    {/* Grade bubbles */}
                    <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                      {course.grades.map((g) => (
                        <span
                          key={g}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                            background: GRADE_COLORS[g].bg,
                            color: GRADE_COLORS[g].text,
                            border: `1.5px solid ${GRADE_COLORS[g].border}`,
                          }}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#90a4ae",
                        transition: "transform 0.2s",
                        transform: isOpen ? "rotate(180deg)" : "none",
                      }}
                    >
                      ▼
                    </span>
                  </div>

                  {/* Expanded details */}
                  {isOpen && (
                    <div style={{ padding: "0 16px 14px", borderTop: "1px solid #f0f0f0" }}>
                      {course.description && (
                        <p style={{ fontSize: 13, color: "#455a64", lineHeight: 1.6, margin: "12px 0" }}>
                          {course.description}
                        </p>
                      )}
                      {course.notes && (
                        <p style={{ fontSize: 12, color: "#7b6c00", background: "#fffde7", padding: "8px 10px", borderRadius: 6, margin: "8px 0", lineHeight: 1.5 }}>
                          📝 {course.notes}
                        </p>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", fontSize: 12, marginTop: 8 }}>
                        <div>
                          <span style={{ color: "#90a4ae", fontWeight: 600 }}>Prerequisite: </span>
                          <span style={{ color: "#37474f" }}>{course.prerequisite}</span>
                        </div>
                        <div>
                          <span style={{ color: "#90a4ae", fontWeight: 600 }}>Diploma: </span>
                          <span style={{ color: "#37474f" }}>{course.diploma}</span>
                        </div>
                        <div>
                          <span style={{ color: "#90a4ae", fontWeight: 600 }}>Grades: </span>
                          <span style={{ color: "#37474f" }}>{course.grades.join(", ")}</span>
                        </div>
                        <div>
                          <span style={{ color: "#90a4ae", fontWeight: 600 }}>Credits: </span>
                          <span style={{ color: "#37474f" }}>{course.credits}</span>
                        </div>
                        {course.fees && (
                          <div style={{ gridColumn: "1 / -1" }}>
                            <span style={{ color: "#90a4ae", fontWeight: 600 }}>Fees: </span>
                            <span style={{ color: "#37474f" }}>{course.fees}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", padding: "10px 16px 30px", fontSize: 11, color: "#aaa" }}>
        Data parsed from{" "}
        <a href="https://woodinville.nsd.org/counseling/course-catalog-2023-24" style={{ color: "#90a4ae" }}>
          woodinville.nsd.org
        </a>
      </div>
    </div>
  );
}
