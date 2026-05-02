use rand::seq::SliceRandom;

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
