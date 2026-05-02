use crate::scores::{self, Session};
use anyhow::Result;
use chrono::Local;
use rand::seq::SliceRandom;
use std::sync::Mutex;
use tauri::{Manager, State};

pub const EXERCISES: [&str; 3] = ["squat", "jumping_jack", "pushup"];

pub fn resolve_exercise(arg: Option<String>) -> &'static str {
    match arg.as_deref() {
        Some("squat") => "squat",
        Some("jumping_jack") => "jumping_jack",
        Some("pushup") => "pushup",
        _ => pick_random(),
    }
}

fn pick_random() -> &'static str {
    let mut rng = rand::thread_rng();
    EXERCISES.choose(&mut rng).copied().unwrap_or("squat")
}

struct AppState {
    chosen_exercise: Mutex<&'static str>,
}

#[tauri::command]
fn get_exercise(state: State<'_, AppState>) -> String {
    state.chosen_exercise.lock().unwrap().to_string()
}

#[tauri::command]
fn save_score(exercise: String, reps: u32) -> Result<(), String> {
    let path = scores::default_path().map_err(|e| e.to_string())?;
    let session = Session {
        date: Local::now().date_naive(),
        exercise,
        reps,
    };
    scores::append(&path, session).map_err(|e| e.to_string())
}

#[tauri::command]
fn log(message: String) {
    eprintln!("[webview] {message}");
}

pub fn run(chosen: &'static str) {
    tauri::Builder::default()
        .manage(AppState { chosen_exercise: Mutex::new(chosen) })
        .invoke_handler(tauri::generate_handler![get_exercise, save_score, log])
        .setup(|app| {
            // Reveal the window now that state is ready (it's hidden in tauri.conf.json).
            if let Some(window) = app.get_webview_window("main") {
                window.show().ok();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn explicit_named_exercise_passes_through() {
        assert_eq!(resolve_exercise(Some("squat".into())), "squat");
        assert_eq!(resolve_exercise(Some("jumping_jack".into())), "jumping_jack");
        assert_eq!(resolve_exercise(Some("pushup".into())), "pushup");
    }

    #[test]
    fn random_keyword_picks_one_of_the_known_exercises() {
        let picked = resolve_exercise(Some("random".into()));
        assert!(EXERCISES.contains(&picked));
    }

    #[test]
    fn missing_arg_picks_one_of_the_known_exercises() {
        let picked = resolve_exercise(None);
        assert!(EXERCISES.contains(&picked));
    }
}
