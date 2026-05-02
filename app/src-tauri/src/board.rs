use crate::scores::{Session, ScoresFile};
use chrono::{Duration, NaiveDate};
use std::collections::BTreeMap;

const EXERCISES: [&str; 3] = ["squat", "jumping_jack", "pushup"];
const HISTORY_DAYS: i64 = 7;

pub fn format_table(scores: &ScoresFile, today: NaiveDate) -> String {
    let mut totals: BTreeMap<NaiveDate, BTreeMap<&str, u32>> = BTreeMap::new();
    for s in &scores.sessions {
        let exercise = EXERCISES.iter().copied().find(|e| *e == s.exercise);
        let Some(ex) = exercise else { continue };
        *totals.entry(s.date).or_default().entry(ex).or_insert(0) += s.reps;
    }

    let mut out = String::new();
    out.push_str(&format!("{:<8}{:>8}{:>16}{:>10}\n", "", "squat", "jumping_jack", "pushup"));

    let mut grand: BTreeMap<&str, u32> = BTreeMap::new();
    for offset in 0..HISTORY_DAYS {
        let day = today - Duration::days(offset);
        let row = totals.get(&day);
        let mut cells: [String; 3] = std::array::from_fn(|_| String::from("\u{2014}"));
        for (i, ex) in EXERCISES.iter().enumerate() {
            if let Some(r) = row.and_then(|m| m.get(ex)).copied() {
                cells[i] = r.to_string();
                *grand.entry(ex).or_insert(0) += r;
            }
        }
        out.push_str(&format!(
            "{:<8}{:>8}{:>16}{:>10}\n",
            day.format("%m-%d"),
            cells[0], cells[1], cells[2],
        ));
    }
    out.push_str(&format!(
        "{:<8}{:>8}{:>16}{:>10}\n",
        "TOTAL",
        grand.get("squat").copied().unwrap_or(0),
        grand.get("jumping_jack").copied().unwrap_or(0),
        grand.get("pushup").copied().unwrap_or(0),
    ));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    #[test]
    fn empty_scores_renders_seven_em_dash_rows_plus_total() {
        let scores = ScoresFile { version: 1, sessions: vec![] };
        let out = format_table(&scores, date(2026, 5, 3));
        let lines: Vec<&str> = out.lines().collect();
        assert_eq!(lines.len(), 9, "header + 7 days + TOTAL");
        assert!(lines[0].contains("squat"));
        assert!(lines[0].contains("jumping_jack"));
        assert!(lines[0].contains("pushup"));
        assert!(lines[1].contains("05-03"));
        assert!(lines[7].contains("04-27"));
        assert!(lines[8].starts_with("TOTAL"));
    }

    #[test]
    fn sums_multiple_sessions_for_same_day_and_exercise() {
        let scores = ScoresFile {
            version: 1,
            sessions: vec![
                Session { date: date(2026, 5, 3), exercise: "squat".into(), reps: 10 },
                Session { date: date(2026, 5, 3), exercise: "squat".into(), reps: 12 },
                Session { date: date(2026, 5, 3), exercise: "pushup".into(), reps: 5 },
            ],
        };
        let out = format_table(&scores, date(2026, 5, 3));
        let today_row = out.lines().nth(1).unwrap();
        assert!(today_row.contains("22"), "row was: {today_row:?}");
        assert!(today_row.contains("5"));
        let total_row = out.lines().last().unwrap();
        assert!(total_row.contains("22"));
        assert!(total_row.contains("5"));
    }

    #[test]
    fn ignores_unknown_exercises() {
        let scores = ScoresFile {
            version: 1,
            sessions: vec![
                Session { date: date(2026, 5, 3), exercise: "burpee".into(), reps: 99 },
            ],
        };
        let out = format_table(&scores, date(2026, 5, 3));
        assert!(!out.contains("99"));
    }
}
