//! Export into a user's repo on a NEW branch, never on the one they are on. `plan` previews what would change; `export` refuses a dirty tree
//! (their uncommitted work is never touched), commits the files on `swift-canvas/<name>[-n]`, then switches back, so the tree is exactly as it was.
//! Undo = delete the branch. The caller has already checked that `repo` is a folder the user allowed.
use std::{fs, io, path::{Component, Path, PathBuf}, process::Command};

#[derive(Debug, PartialEq)]
pub struct Entry { pub path: String, pub status: &'static str } // new | changed | same
#[derive(Debug)]
pub struct Plan { pub branch: String, pub entries: Vec<Entry> }

fn err(m: impl Into<String>) -> io::Error { io::Error::new(io::ErrorKind::InvalidInput, m.into()) }
fn git(repo: &Path, args: &[&str]) -> io::Result<String> {
    let o = Command::new("git").arg("-C").arg(repo).args(args).output().map_err(|e| err(format!("git not available: {e}")))?;
    if !o.status.success() { return Err(err(format!("git {}: {}", args.join(" "), String::from_utf8_lossy(&o.stderr).trim()))); }
    Ok(String::from_utf8_lossy(&o.stdout).trim().to_string())
}
/// Files must stay under `swift-canvas/`: relative, no `..`, no absolute paths.
fn safe(p: &str) -> io::Result<PathBuf> {
    let path = Path::new(p); if p.is_empty() || !p.starts_with("swift-canvas/") || path.components().any(|c| !matches!(c, Component::Normal(_))) { return Err(err(format!("path not allowed: {p}"))); } Ok(path.to_path_buf())
}
fn slug(name: &str) -> String { let s: String = name.to_lowercase().chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect(); let s = s.split('-').filter(|x| !x.is_empty()).collect::<Vec<_>>().join("-"); if s.is_empty() { "export".into() } else { s.chars().take(40).collect() } }
fn free_branch(repo: &Path, name: &str) -> io::Result<String> {
    let base = format!("swift-canvas/{}", slug(name)); let mut b = base.clone(); let mut n = 1;
    while git(repo, &["rev-parse", "--verify", "--quiet", &format!("refs/heads/{b}")]).is_ok() { n += 1; b = format!("{base}-{n}"); } Ok(b)
}
pub fn plan(repo: &Path, name: &str, files: &[(String, String)]) -> io::Result<Plan> {
    git(repo, &["rev-parse", "--git-dir"]).map_err(|_| err("not a git repository"))?;
    let mut entries = Vec::new();
    for (p, content) in files { let rel = safe(p)?; let status = match fs::read_to_string(repo.join(&rel)) { Ok(old) if &old == content => "same", Ok(_) => "changed", Err(_) => "new" }; entries.push(Entry { path: p.clone(), status }); }
    Ok(Plan { branch: free_branch(repo, name)?, entries })
}
pub fn export(repo: &Path, name: &str, files: &[(String, String)]) -> io::Result<String> {
    let plan = plan(repo, name, files)?;
    if !git(repo, &["status", "--porcelain"])?.is_empty() { return Err(err("the repo has uncommitted changes: commit or stash them first (nothing was written)")); }
    let start = git(repo, &["rev-parse", "--abbrev-ref", "HEAD"])?; let start = if start == "HEAD" { git(repo, &["rev-parse", "HEAD"])? } else { start };
    git(repo, &["switch", "-c", &plan.branch])?;
    let done = (|| -> io::Result<String> {
        for (p, content) in files { let t = repo.join(safe(p)?); if let Some(d) = t.parent() { fs::create_dir_all(d)?; } fs::write(&t, content)?; git(repo, &["add", "--", p])?; }
        git(repo, &["-c", "user.name=Swift Canvas", "-c", "user.email=swift-canvas@localhost", "commit", "-q", "-m", &format!("Swift Canvas export: {name}")])?; git(repo, &["rev-parse", "--short", "HEAD"])
    })();
    let back = git(repo, &["switch", &start]); // always return, even after a failure
    match (done, back) { (Ok(_), Ok(_)) => Ok(plan.branch), (Err(e), _) => { let _ = git(repo, &["switch", &start]); let _ = git(repo, &["branch", "-D", &plan.branch]); Err(e) } (_, Err(e)) => Err(e) }
}
#[cfg(test)] mod tests {
    use super::*;
    fn repo(n: &str) -> PathBuf { let d = std::env::temp_dir().join(format!("sc-repo-{n}-{}", std::process::id())); let _ = fs::remove_dir_all(&d); fs::create_dir_all(&d).unwrap();
        for a in [&["init", "-q", "-b", "main"][..], &["config", "user.email", "t@t"], &["config", "user.name", "t"]] { git(&d, a).unwrap(); } fs::write(d.join("a.txt"), "a").unwrap(); git(&d, &["add", "."]).unwrap(); git(&d, &["commit", "-qm", "init"]).unwrap(); d }
    fn f(p: &str, c: &str) -> (String, String) { (p.into(), c.into()) }
    #[test] fn exports_on_a_new_branch_and_leaves_the_tree_on_main_clean() {
        let d = repo("ok"); let b = export(&d, "TV Idle", &[f("swift-canvas/tv-idle.html", "<div>hi</div>")]).unwrap();
        assert_eq!(b, "swift-canvas/tv-idle"); assert_eq!(git(&d, &["rev-parse", "--abbrev-ref", "HEAD"]).unwrap(), "main"); assert!(git(&d, &["status", "--porcelain"]).unwrap().is_empty()); assert!(!d.join("swift-canvas").exists(), "main's working tree is untouched");
        assert_eq!(git(&d, &["show", &format!("{b}:swift-canvas/tv-idle.html")]).unwrap(), "<div>hi</div>"); assert_eq!(git(&d, &["rev-list", "--count", "main"]).unwrap(), "1", "main gained no commit");
    }
    #[test] fn a_second_export_gets_a_free_branch_name() { let d = repo("two"); let a = export(&d, "x", &[f("swift-canvas/x.html", "1")]).unwrap(); let b = export(&d, "x", &[f("swift-canvas/x.html", "2")]).unwrap(); assert_eq!((a.as_str(), b.as_str()), ("swift-canvas/x", "swift-canvas/x-2")); }
    #[test] fn a_dirty_tree_is_refused_and_untouched() { let d = repo("dirty"); fs::write(d.join("a.txt"), "mine").unwrap(); let e = export(&d, "x", &[f("swift-canvas/x.html", "1")]).unwrap_err(); assert!(e.to_string().contains("uncommitted"), "{e}"); assert_eq!(fs::read_to_string(d.join("a.txt")).unwrap(), "mine"); assert_eq!(git(&d, &["branch", "--list", "swift-canvas/*"]).unwrap(), ""); }
    #[test] fn plan_marks_new_changed_and_same() { let d = repo("plan"); export(&d, "x", &[f("swift-canvas/x.html", "1")]).unwrap(); git(&d, &["merge", "-q", "swift-canvas/x"]).unwrap(); let p = plan(&d, "x", &[f("swift-canvas/x.html", "1"), f("swift-canvas/y.html", "2")]).unwrap(); assert_eq!(p.entries.iter().map(|e| e.status).collect::<Vec<_>>(), ["same", "new"]); let p = plan(&d, "x", &[f("swift-canvas/x.html", "9")]).unwrap(); assert_eq!(p.entries[0].status, "changed"); }
    #[test] fn paths_cannot_escape_swift_canvas() { let d = repo("esc"); for bad in ["../x", "/etc/x", "a.txt", "swift-canvas/../a.txt", "swift-canvas/", ""] { assert!(export(&d, "x", &[f(bad, "1")]).is_err(), "{bad}"); } assert_eq!(fs::read_to_string(d.join("a.txt")).unwrap(), "a"); }
    #[test] fn not_a_git_repo_is_an_error() { let d = std::env::temp_dir().join(format!("sc-norepo-{}", std::process::id())); let _ = fs::create_dir_all(&d); assert!(plan(&d, "x", &[]).is_err()); }
}
