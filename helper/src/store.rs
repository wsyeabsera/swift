//! Project files: one JSON document per project in the helper's data dir. The app keeps localStorage as its fast cache; this is the durable copy
//! (survives clearing browser data). Writes are atomic (temp file + rename) so a crash never leaves half a file.
use std::{fs, io, path::{Path, PathBuf}};
pub const MAX_BYTES: usize = 8 * 1024 * 1024;
pub fn valid_id(id: &str) -> bool { !id.is_empty() && id.len() <= 40 && id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-') && !id.starts_with('-') }
fn path_for(dir: &Path, id: &str) -> io::Result<PathBuf> { if valid_id(id) { Ok(dir.join(format!("{id}.project.json"))) } else { Err(io::Error::new(io::ErrorKind::InvalidInput, "bad project id")) } }
pub fn put(dir: &Path, id: &str, data: &str) -> io::Result<()> {
    if data.len() > MAX_BYTES { return Err(io::Error::new(io::ErrorKind::InvalidInput, "project too large")); }
    serde_json::from_str::<serde_json::Value>(data).map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "not JSON"))?;
    let path = path_for(dir, id)?; fs::create_dir_all(dir)?; let tmp = dir.join(format!(".{id}.tmp")); fs::write(&tmp, data)?; fs::rename(&tmp, path)
}
/// The git-friendly copy: `<repo>/.swift-canvas/project.json` (atomic write). The caller has already checked that `repo` is a folder the user allowed.
pub fn put_in_repo(repo: &Path, data: &str) -> io::Result<PathBuf> {
    if data.len() > MAX_BYTES { return Err(io::Error::new(io::ErrorKind::InvalidInput, "project too large")); }
    serde_json::from_str::<serde_json::Value>(data).map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "not JSON"))?;
    let dir = repo.join(".swift-canvas"); fs::create_dir_all(&dir)?; let tmp = dir.join(".project.tmp"); let path = dir.join("project.json"); fs::write(&tmp, data)?; fs::rename(&tmp, &path)?; Ok(path)
}
/// Crew sheets: the `.md` files in `<repo>/.swift-canvas/crew/`, sorted by name, at most 30, each read up to 20,001 bytes (an oversize sheet is passed on and refused by the app with its reason). A missing folder is simply no sheets. The caller has already checked that `repo` is a folder the user allowed.
pub fn read_crew(repo: &Path) -> io::Result<Vec<(String, String)>> {
    use std::io::Read;
    let dir = repo.join(".swift-canvas").join("crew");
    let rd = match fs::read_dir(&dir) { Ok(r) => r, Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(vec![]), Err(e) => return Err(e) };
    let mut names: Vec<String> = rd.filter_map(|e| e.ok()).filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false)).filter_map(|e| e.file_name().into_string().ok()).filter(|n| n.to_lowercase().ends_with(".md") && !n.starts_with('.')).collect();
    names.sort(); names.truncate(30);
    let mut out = Vec::new();
    for n in names { let mut buf = Vec::new(); fs::File::open(dir.join(&n))?.take(20_001).read_to_end(&mut buf)?; out.push((n, String::from_utf8_lossy(&buf).into_owned())); }
    Ok(out)
}
/// Ok(None) when the project was never saved.
pub fn get(dir: &Path, id: &str) -> io::Result<Option<String>> { match fs::read_to_string(path_for(dir, id)?) { Ok(s) => Ok(Some(s)), Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None), Err(e) => Err(e) } }
#[cfg(test)] mod tests {
    use super::*;
    fn tmp(n: &str) -> PathBuf { let d = std::env::temp_dir().join(format!("sc-store-{n}-{}", std::process::id())); let _ = fs::remove_dir_all(&d); d }
    #[test] fn round_trip_and_missing() { let d = tmp("rt"); assert_eq!(get(&d, "tvdash").unwrap(), None); put(&d, "tvdash", "{\"frames\":[]}").unwrap(); assert_eq!(get(&d, "tvdash").unwrap().as_deref(), Some("{\"frames\":[]}")); put(&d, "tvdash", "{\"a\":1}").unwrap(); assert_eq!(get(&d, "tvdash").unwrap().as_deref(), Some("{\"a\":1}")); assert!(!d.join(".tvdash.tmp").exists()); }
    #[test] fn ids_cannot_escape_the_dir() { let d = tmp("id"); for bad in ["", "..", "../x", "a/b", "A", "-x", "a b", "x.json", &"a".repeat(41)] { assert!(put(&d, bad, "{}").is_err(), "{bad}"); assert!(get(&d, bad).is_err(), "{bad}"); } assert!(!d.exists() || fs::read_dir(&d).unwrap().count() == 0); }
    #[test] fn the_repo_copy_lands_in_a_dot_folder_and_replaces_atomically() { let d = tmp("repo"); fs::create_dir_all(&d).unwrap(); let p = put_in_repo(&d, "{\"a\":1}").unwrap(); assert_eq!(p, d.join(".swift-canvas").join("project.json")); put_in_repo(&d, "{\"a\":2}").unwrap(); assert_eq!(fs::read_to_string(&p).unwrap(), "{\"a\":2}"); assert!(!d.join(".swift-canvas").join(".project.tmp").exists()); assert!(put_in_repo(&d, "nope").is_err()); }
    #[test] fn crew_sheets_are_read_sorted_filtered_and_capped() {
        let none = tmp("nocrew"); fs::create_dir_all(&none).unwrap(); assert!(read_crew(&none).unwrap().is_empty(), "no folder = no sheets");
        let d = tmp("crew"); let c = d.join(".swift-canvas").join("crew"); fs::create_dir_all(&c).unwrap();
        fs::write(c.join("b.md"), "B").unwrap(); fs::write(c.join("A.MD"), "A").unwrap(); fs::write(c.join("notes.txt"), "x").unwrap(); fs::write(c.join(".hidden.md"), "h").unwrap(); fs::create_dir_all(c.join("sub.md")).unwrap(); fs::write(c.join("big.md"), "x".repeat(50_000)).unwrap();
        let got = read_crew(&d).unwrap(); assert_eq!(got.iter().map(|(n, _)| n.as_str()).collect::<Vec<_>>(), ["A.MD", "b.md", "big.md"]); assert_eq!(got[0].1, "A"); assert_eq!(got[2].1.len(), 20_001, "an oversize sheet is cut so the app can refuse it");
        for i in 0..40 { fs::write(c.join(format!("z{i:02}.md")), "z").unwrap(); } assert_eq!(read_crew(&d).unwrap().len(), 30);
    }
    #[test] fn rejects_non_json_and_oversize() { let d = tmp("bad"); assert!(put(&d, "x", "not json").is_err()); assert!(put(&d, "x", &format!("\"{}\"", "a".repeat(MAX_BYTES))).is_err()); assert_eq!(get(&d, "x").unwrap(), None); }
    #[test] fn unreadable_file_is_an_error_not_missing() { let d = tmp("ro"); fs::create_dir_all(d.join("x.project.json")).unwrap(); assert!(get(&d, "x").is_err()); }
}
