#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use clap::{Parser, Subcommand};

#[derive(Parser, Debug, PartialEq)]
#[command(name = "fitcoding", version)]
struct Cli {
    #[command(subcommand)]
    command: Option<Cmd>,
}

#[derive(Subcommand, Debug, PartialEq)]
enum Cmd {
    /// Open the exercise window.
    Launch {
        /// Force a specific exercise (dev-only). Defaults to a random pick.
        #[arg(long, value_parser = ["random", "squat", "jumping_jack", "pushup"])]
        exercise: Option<String>,
    },
    /// Print the scoreboard to stdout.
    Board,
}

fn main() {
    let cli = Cli::parse();
    match cli.command.unwrap_or(Cmd::Launch { exercise: None }) {
        Cmd::Launch { exercise } => {
            println!("(stub) launch exercise={:?}", exercise);
        }
        Cmd::Board => {
            println!("(stub) board");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;

    #[test]
    fn no_args_means_launch_with_no_exercise() {
        let cli = Cli::try_parse_from(["fitcoding"]).unwrap();
        assert_eq!(cli.command, None);
    }

    #[test]
    fn explicit_launch_no_flag() {
        let cli = Cli::try_parse_from(["fitcoding", "launch"]).unwrap();
        assert_eq!(cli.command, Some(Cmd::Launch { exercise: None }));
    }

    #[test]
    fn launch_with_exercise() {
        let cli = Cli::try_parse_from(["fitcoding", "launch", "--exercise", "squat"]).unwrap();
        assert_eq!(cli.command, Some(Cmd::Launch { exercise: Some("squat".into()) }));
    }

    #[test]
    fn launch_rejects_unknown_exercise() {
        let res = Cli::try_parse_from(["fitcoding", "launch", "--exercise", "yoga"]);
        assert!(res.is_err());
    }

    #[test]
    fn board_subcommand() {
        let cli = Cli::try_parse_from(["fitcoding", "board"]).unwrap();
        assert_eq!(cli.command, Some(Cmd::Board));
    }
}
