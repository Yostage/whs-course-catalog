#!/usr/bin/env python3
"""
Parse the Woodinville High School course catalog HTML into structured JSON.
Usage: python3 parse_catalog.py [html_file] > courses.json
"""

import sys
import json
import re
from bs4 import BeautifulSoup, Tag

# Map H2 section titles to subject metadata
SUBJECT_MAP = {
    "Business & Marketing":      {"subject": "Career & Technical Education", "sub_subject": "Business & Marketing"},
    "Technology & Engineering":  {"subject": "Career & Technical Education", "sub_subject": "Technology & Engineering"},
    "Other Career & Technical":  {"subject": "Career & Technical Education", "sub_subject": "Other CTE"},
    "Satellite Programs":        {"subject": "Career & Technical Education", "sub_subject": "Satellite Programs"},
    "Other Flexible Credits":    {"subject": "Flexible Credits",             "sub_subject": None},
    "Freshmen":                  {"subject": "English",                      "sub_subject": "English 9"},
    "Sophomores":                {"subject": "English",                      "sub_subject": "English 10"},
    "Juniors":                   {"subject": "English",                      "sub_subject": "English 11"},
    "Seniors":                   {"subject": "English",                      "sub_subject": "English 12"},
    "Health - Fitness":          {"subject": "Health & Fitness",             "sub_subject": None},
    "Mathematics":               {"subject": "Mathematics",                  "sub_subject": None},
    "Science":                   {"subject": "Science",                      "sub_subject": None},
    "Social Studies":            {"subject": "Social Studies",               "sub_subject": None},
    "Special Education":         {"subject": "Special Education",            "sub_subject": None},
    "Performing Arts":           {"subject": "The Arts",                     "sub_subject": "Performing Arts"},
    "Theatrical Arts":           {"subject": "The Arts",                     "sub_subject": "Theatrical Arts"},
    "Visual Arts":               {"subject": "The Arts",                     "sub_subject": "Visual Arts"},
    "World Languages":           {"subject": "World Languages",              "sub_subject": None},
}

COURSE_CODE_RE = re.compile(r'^([A-Z]{2,5}\d{2,4}[A-Z0-9]*(?:\s*/\s*[A-Z]{2,5}\d{2,4}[A-Z0-9]*)?)')


def classify_tracks(diploma_text: str, subject: str) -> list[str]:
    text = (diploma_text or "").lower()
    tracks = set()

    if subject in ("Mathematics", "Science"):
        tracks.add("STEM")
    if any(x in text for x in ["3rd credit of math", "3rd credit of science"]):
        tracks.add("STEM")

    if "career & technical" in text or "cte" in text:
        tracks.add("CTE")

    if "ap " in text or "college in the high school" in text or "dual credit" in text:
        tracks.add("College Prep")

    if subject == "English":
        tracks.add("Language Arts")
    if subject == "World Languages":
        tracks.add("World Languages")
        tracks.discard("CTE")  # World Languages are in CTE diploma category at WHS but aren't CTE
    if subject == "The Arts":
        tracks.add("Arts")
    if subject == "Health & Fitness":
        tracks.add("Health & Fitness")
    if subject == "Social Studies":
        tracks.add("Social Studies")
    if subject == "Special Education":
        tracks.add("Special Education")

    if not tracks:
        tracks.add("Elective")

    return sorted(tracks)


def parse_grades(text: str) -> list[int]:
    if not text:
        return []
    grades = set()
    for lo, hi in re.findall(r'(\d+)\s*[-–]\s*(\d+)', text):
        grades.update(range(int(lo), int(hi) + 1))
    for n in re.findall(r'\b(9|10|11|12)\b', text):
        grades.add(int(n))
    return sorted(grades)


def parse_credit(text: str) -> tuple[float | None, str | None]:
    if not text:
        return None, None
    # Try "1.0 Credit" or "1 Credit" style
    m = re.search(r'(\d*\.?\d+)\s*[Cc]redit', text)
    if not m:
        # Try "Full Year / 1.0" or "Semester / .5" style (math/science sections)
        m = re.search(r'/\s*(\d*\.?\d+)', text)
    credits = float(m.group(1)) if m else None
    tl = text.lower()
    if "full year" in tl or "year long" in tl or "fy" in tl:
        duration = "Full Year"
    elif "semester" in tl or "sem" in tl:
        duration = "Semester"
    else:
        duration = None
    return credits, duration


def bold_text(el) -> str:
    """Get text of all bold/strong children."""
    return " ".join(b.get_text(strip=True) for b in el.find_all(['strong', 'b', 'u']))


def extract_labeled_field(p_el, label: str) -> str | None:
    """
    Given a <p> element, return the text following `label` if the label appears
    as a bold/strong child. Handles inline labels like <b>Grades: </b>9, 10.
    """
    text = p_el.get_text(separator="\n")
    pattern = re.compile(re.escape(label) + r'\s*(.*?)(?=\n[A-Z][a-z]|$)', re.DOTALL)
    m = pattern.search(text)
    if m:
        return m.group(1).strip()
    return None


def parse_course_block(header_p: Tag, following_ps: list[Tag], subject_info: dict) -> dict | None:
    """
    Parse one course from its header paragraph and the paragraphs that follow.
    The header <p> contains a <strong> with "CODE - Course Name".
    """
    header_text = header_p.get_text(separator=" ", strip=True)
    m = COURSE_CODE_RE.match(header_text)
    if not m:
        return None

    code = m.group(1).strip()
    # Name follows the code and a dash
    name_match = re.match(r'^[A-Z0-9/ ]+\s*[-–]\s*(.+)', header_text)
    name = name_match.group(1).strip() if name_match else header_text

    subject = subject_info["subject"]
    sub_subject = subject_info["sub_subject"]

    fields = {
        "code": code,
        "name": name,
        "subject": subject,
        "sub_subject": sub_subject,
        "credits": None,
        "duration": None,
        "grades": [],
        "prerequisites": None,
        "diploma_category": None,
        "fees": None,
        "notes": None,
        "description": None,
        "tracks": [],
    }

    desc_parts = []

    for p in following_ps:
        # Replace <br> with newlines before extracting text so inline fields split correctly
        for br in p.find_all("br"):
            br.replace_with("\n")
        p_text = p.get_text(separator="\n", strip=True)
        if not p_text:
            continue

        # Check if this paragraph has labeled fields
        has_label = bool(re.search(r'\b(Length\s*/\s*Credit|Grades?|Prerequisites?|Diploma Category|Fees|Notes|Other Info)\s*:', p_text))

        if has_label:
            # Parse each labeled field
            # Split into lines; join lines where colon is on its own line (bold label split from colon)
            raw_lines = [l.strip() for l in p_text.split("\n")]
            joined = []
            for ln in raw_lines:
                if ln.startswith(":") and joined:
                    joined[-1] = joined[-1] + ln
                elif ln:
                    joined.append(ln)
            lines = joined
            LABELS = [
                # Label variants: some sections use different spacing/plurals
                ("Length/Credit:", "credit"),
                ("Length / Credit:", "credit"),
                ("Grades:", "grades"),
                ("Grade:", "grades"),
                ("Prerequisites:", "prerequisites"),
                ("Prerequisite:", "prerequisites"),
                ("Diploma Category:", "diploma_category"),
                ("Fees:", "fees"),
                ("Notes:", "notes"),
                ("Other Info:", "other_info"),
            ]
            current_key = None
            current_val = []
            collected = {}

            for line in lines:
                matched = False
                for label, key in LABELS:
                    if line.startswith(label):
                        if current_key:
                            collected[current_key] = " ".join(current_val).strip()
                        current_key = key
                        current_val = [line[len(label):].strip()]
                        matched = True
                        break
                if not matched and current_key:
                    current_val.append(line)

            if current_key:
                collected[current_key] = " ".join(current_val).strip()

            if "credit" in collected:
                fields["credits"], fields["duration"] = parse_credit(collected["credit"])
            if "grades" in collected:
                fields["grades"] = parse_grades(collected["grades"])
            if "prerequisites" in collected:
                fields["prerequisites"] = collected["prerequisites"] or None
            if "diploma_category" in collected:
                fields["diploma_category"] = collected["diploma_category"] or None
            if "fees" in collected:
                fields["fees"] = collected["fees"] or None
            notes_parts = []
            if "notes" in collected and collected["notes"]:
                notes_parts.append(collected["notes"])
            if "other_info" in collected and collected["other_info"]:
                notes_parts.append(collected["other_info"])
            if notes_parts:
                fields["notes"] = " | ".join(notes_parts)
        else:
            desc_parts.append(p_text)

    if desc_parts:
        fields["description"] = " ".join(desc_parts)

    fields["tracks"] = classify_tracks(fields["diploma_category"] or "", subject)
    return fields


def expand_br_separated_headers(ps: list[Tag]) -> list[Tag | str]:
    """
    Some paragraphs pack multiple course entries separated by <br/> tags.
    Expand these into a list of virtual single-course strings intermixed with Tags.
    Returns a new list where each multi-course <p> is replaced by string stubs.
    """
    result = []
    for p in ps:
        # Check if this paragraph has multiple course entries separated by <br/>
        # Reconstruct text by treating <br/> as hard line breaks and joining
        # dash-continuation lines so "CODE\n- NAME" becomes "CODE - NAME"
        from copy import copy as _copy
        p_copy = _copy(p)
        for br in p_copy.find_all("br"):
            br.replace_with("\n")
        raw_text = p_copy.get_text(separator="\n")
        # Join lines starting with dash/en-dash to previous line
        joined_lines = []
        for ln in raw_text.split("\n"):
            ln = ln.strip()
            if not ln:
                continue
            if re.match(r'^[-–]\s*[A-Z]', ln) and joined_lines:
                joined_lines[-1] = joined_lines[-1] + " " + ln
            else:
                joined_lines.append(ln)
        code_lines = [ln for ln in joined_lines if COURSE_CODE_RE.match(ln)]
        has_dash = [ln for ln in code_lines if re.search(r'[A-Z0-9/]+\s*[-–]\s*[A-Z]', ln)]
        if len(has_dash) > 1:
            # Multiple courses in one p - split into individual stub strings
            for ln in has_dash:
                result.append(ln)
        else:
            result.append(p)
    return result


def parse_section(container: Tag, subject_info: dict) -> list[dict]:
    """Extract all courses from a section container."""
    courses = []

    # Use the full container (not just the first fsBody) so nested course blocks are included
    raw_ps = container.find_all("p")
    all_ps = expand_br_separated_headers(raw_ps)

    def get_text(item) -> str:
        if isinstance(item, str):
            return item
        return item.get_text(separator=" ", strip=True)

    def is_course_header(item) -> bool:
        text = get_text(item)
        return bool(COURSE_CODE_RE.match(text) and re.search(r'[A-Z0-9/]+\s*[-–]\s*[A-Z]', text))

    # Find course header paragraphs
    course_starts = [i for i, p in enumerate(all_ps) if is_course_header(p)]

    # Group consecutive headers that share a metadata block.
    # A group is a run of consecutive course_starts with no metadata paragraph in between.
    i = 0
    while i < len(course_starts):
        group = [course_starts[i]]

        # Extend group while the very next paragraph after the header is also a course header
        while (i + 1 < len(course_starts)
               and course_starts[i + 1] == course_starts[i] + 1):
            i += 1
            group.append(course_starts[i])

        # The metadata/description block follows the last header in the group
        last_header_idx = group[-1]
        end_i = course_starts[i + 1] if i + 1 < len(course_starts) else len(all_ps)
        shared_following = all_ps[last_header_idx + 1: end_i]

        # Parse each course in the group using the shared metadata block
        for header_idx in group:
            header_item = all_ps[header_idx]
            # String stubs from br-expanded headers need wrapping as a fake header
            if isinstance(header_item, str):
                from bs4 import BeautifulSoup as BS
                header_p = BS(f"<p>{header_item}</p>", "html.parser").find("p")
            else:
                header_p = header_item
            course = parse_course_block(header_p, shared_following, subject_info)
            if course:
                courses.append(course)

        i += 1

    return courses


def main():
    html_file = sys.argv[1] if len(sys.argv) > 1 else "/tmp/catalog_raw.html"
    with open(html_file) as f:
        html = f.read()

    soup = BeautifulSoup(html, "html.parser")

    all_courses = []
    seen_codes = set()

    h2s = soup.find_all("h2", class_="fsElementTitle")
    for h2 in h2s:
        title = h2.get_text(strip=True)
        if title not in SUBJECT_MAP:
            continue

        subject_info = SUBJECT_MAP[title]
        container = h2.find_parent("section") or h2.find_parent("div")
        if not container:
            continue

        courses = parse_section(container, subject_info)
        for c in courses:
            if c["code"] not in seen_codes:
                seen_codes.add(c["code"])
                all_courses.append(c)

    # Sort by subject, sub_subject, name
    all_courses.sort(key=lambda c: (c["subject"], c["sub_subject"] or "", c["name"]))

    print(json.dumps(all_courses, indent=2))
    print(f"Total courses parsed: {len(all_courses)}", file=sys.stderr)


if __name__ == "__main__":
    main()
