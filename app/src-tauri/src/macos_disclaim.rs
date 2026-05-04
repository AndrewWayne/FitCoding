//! Detach from the parent terminal's TCC responsibility chain.
//!
//! When a CLI binary is launched from a terminal (Warp, iTerm, Claude Code's
//! shell), macOS attributes camera/mic/location permission requests to the
//! terminal app via the "responsible process" chain — not to our binary. TCC
//! then checks the terminal's Info.plist for NSCameraUsageDescription, doesn't
//! find one, and hard-crashes us with a privacy violation. Our own embedded
//! plist is never consulted.
//!
//! Fix: re-spawn ourselves once with `responsibility_spawnattrs_setdisclaim`,
//! which makes the child its own responsible process. TCC then reads our plist
//! and shows the standard permission prompt instead of crashing.

use std::env;
use std::ffi::CString;
use std::process::exit;
use std::ptr;

const SENTINEL: &str = "FITCODING_TCC_DISCLAIMED";

extern "C" {
    fn responsibility_spawnattrs_setdisclaim(
        attrs: *mut libc::posix_spawnattr_t,
        disclaim: libc::c_int,
    ) -> libc::c_int;
}

pub fn reexec_if_needed() {
    if env::var_os(SENTINEL).is_some() {
        return;
    }

    let exe = match env::current_exe() {
        Ok(p) => p,
        Err(_) => return,
    };
    let exe_c = match CString::new(exe.as_os_str().to_string_lossy().as_bytes()) {
        Ok(s) => s,
        Err(_) => return,
    };

    let argv: Vec<CString> = env::args()
        .filter_map(|a| CString::new(a).ok())
        .collect();
    let mut argv_ptrs: Vec<*mut libc::c_char> =
        argv.iter().map(|a| a.as_ptr() as *mut _).collect();
    argv_ptrs.push(ptr::null_mut());

    let envp: Vec<CString> = env::vars()
        .map(|(k, v)| format!("{k}={v}"))
        .chain(std::iter::once(format!("{SENTINEL}=1")))
        .filter_map(|s| CString::new(s).ok())
        .collect();
    let mut envp_ptrs: Vec<*mut libc::c_char> =
        envp.iter().map(|s| s.as_ptr() as *mut _).collect();
    envp_ptrs.push(ptr::null_mut());

    unsafe {
        let mut attr: libc::posix_spawnattr_t = ptr::null_mut();
        if libc::posix_spawnattr_init(&mut attr) != 0 {
            return;
        }
        if responsibility_spawnattrs_setdisclaim(&mut attr, 1) != 0 {
            libc::posix_spawnattr_destroy(&mut attr);
            return;
        }

        let mut pid: libc::pid_t = 0;
        let rc = libc::posix_spawn(
            &mut pid,
            exe_c.as_ptr(),
            ptr::null(),
            &attr,
            argv_ptrs.as_ptr(),
            envp_ptrs.as_ptr(),
        );
        libc::posix_spawnattr_destroy(&mut attr);

        if rc != 0 {
            return;
        }

        let mut status: libc::c_int = 0;
        if libc::waitpid(pid, &mut status, 0) < 0 {
            exit(1);
        }
        if libc::WIFEXITED(status) {
            exit(libc::WEXITSTATUS(status));
        }
        exit(1);
    }
}
