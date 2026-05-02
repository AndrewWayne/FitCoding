use anyhow::{Context, Result};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Session {
    pub date: NaiveDate,
    pub exercise: String,
    pub reps: u32,
}

#[derive(Serialize, Deserialize, Debug, Default, PartialEq)]
pub struct ScoresFile {
    pub version: u32,
    pub sessions: Vec<Session>,
}

pub fn default_path() -> Result<PathBuf> {
    let home = dirs::home_dir().context("could not determine home directory")?;
    Ok(home.join(".fitcoding").join("scores.json"))
}

pub fn load(path: &Path) -> Result<ScoresFile> {
    if !path.exists() {
        return Ok(ScoresFile { version: 1, sessions: vec![] });
    }
    let text = fs::read_to_string(path)
        .with_context(|| format!("reading {}", path.display()))?;
    let parsed: ScoresFile = serde_json::from_str(&text)
        .with_context(|| format!("parsing {}", path.display()))?;
    Ok(parsed)
}

pub fn append(path: &Path, session: Session) -> Result<()> {
    let mut current = load(path)?;
    if current.version == 0 {
        current.version = 1;
    }
    current.sessions.push(session);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("creating {}", parent.display()))?;
    }
    let text = serde_json::to_string_pretty(&current)?;
    fs::write(path, text).with_context(|| format!("writing {}", path.display()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    #[test]
    fn load_returns_empty_when_missing() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("scores.json");
        let scores = load(&path).unwrap();
        assert_eq!(scores, ScoresFile { version: 1, sessions: vec![] });
    }

    #[test]
    fn append_creates_file_and_dirs() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("nested").join("scores.json");
        let session = Session { date: date(2026, 5, 3), exercise: "squat".into(), reps: 22 };
        append(&path, session.clone()).unwrap();
        let loaded = load(&path).unwrap();
        assert_eq!(loaded.version, 1);
        assert_eq!(loaded.sessions, vec![session]);
    }

    #[test]
    fn append_preserves_existing_sessions() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("scores.json");
        let s1 = Session { date: date(2026, 5, 2), exercise: "pushup".into(), reps: 10 };
        let s2 = Session { date: date(2026, 5, 3), exercise: "squat".into(), reps: 15 };
        append(&path, s1.clone()).unwrap();
        append(&path, s2.clone()).unwrap();
        let loaded = load(&path).unwrap();
        assert_eq!(loaded.sessions, vec![s1, s2]);
    }

    #[test]
    fn load_errors_on_garbage_json() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("scores.json");
        fs::write(&path, "this is not json").unwrap();
        assert!(load(&path).is_err());
    }
}
