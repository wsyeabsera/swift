//! Memory guard: every Claude Code process holds ~250 MB (spike #1707), so a Say or Spark is refused while the Mac is short of free memory
//! (a 12-take Spark must never push a 16 GB machine into swap). macOS only (`vm_stat`); elsewhere the guard allows.
/// Refuse a new Claude process below this much available memory (override with SWIFT_MIN_FREE_MB).
pub const DEFAULT_MIN_FREE_MB: u64 = 1200;
/// Available MB from `vm_stat` output: free + inactive + speculative pages (reclaimable without swapping).
pub fn parse_vm_stat(text: &str) -> Option<u64> {
    let page: u64 = text.lines().next()?.split("page size of ").nth(1)?.split_whitespace().next()?.parse().ok()?;
    let pages = |label: &str| -> u64 { text.lines().find(|l| l.starts_with(label)).and_then(|l| l.split(':').nth(1)).map(|v| v.trim().trim_end_matches('.')).and_then(|v| v.parse().ok()).unwrap_or(0) };
    let total = pages("Pages free") + pages("Pages inactive") + pages("Pages speculative"); if total == 0 { return None; }
    Some(total * page / (1024 * 1024))
}
pub fn available_mb() -> Option<u64> { let out = std::process::Command::new("vm_stat").output().ok()?; if !out.status.success() { return None; } parse_vm_stat(&String::from_utf8_lossy(&out.stdout)) }
/// Err(message) when a new process should not start.
pub fn check(min_free_mb: u64, available: Option<u64>) -> Result<(), String> {
    match available { Some(free) if free < min_free_mb => Err(format!("not enough free memory ({free} MB free, need {min_free_mb} MB): finish or discard some takes first")), _ => Ok(()) }
}
#[cfg(test)] mod tests {
    use super::*;
    const SAMPLE: &str = "Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free:                               10000.\nPages active:                            500000.\nPages inactive:                           30000.\nPages speculative:                         2000.\nPages wired down:                        100000.\n";
    #[test] fn parses_vm_stat() { assert_eq!(parse_vm_stat(SAMPLE), Some(42000 * 16384 / 1048576)); assert_eq!(parse_vm_stat("garbage"), None); assert_eq!(parse_vm_stat("(page size of 4096 bytes)\nPages free: 0.\n"), None); }
    #[test] fn refuses_only_when_short_and_known() { assert!(check(1000, Some(999)).is_err()); assert!(check(1000, Some(1000)).is_ok()); assert!(check(1000, None).is_ok()); assert!(check(0, Some(0)).is_ok()); assert!(check(1000, Some(5)).unwrap_err().contains("5 MB free")); }
}
