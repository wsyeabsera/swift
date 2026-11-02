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
/// Ok(None) when the project was never saved.
pub fn get(dir: &Path, id: &str) -> io::Result<Option<String>> { match fs::read_to_string(path_for(dir, id)?) { Ok(s) => Ok(Some(s)), Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None), Err(e) => Err(e) } }
#[cfg(test)] mod tests {
    use super::*;
    fn tmp(n: &str) -> PathBuf { let d = std::env::temp_dir().join(format!("sc-store-{n}-{}", std::process::id())); let _ = fs::remove_dir_all(&d); d }
    #[test] fn round_trip_and_missing() { let d = tmp("rt"); assert_eq!(get(&d, "tvdash").unwrap(), None); put(&d, "tvdash", "{\"frames\":[]}").unwrap(); assert_eq!(get(&d, "tvdash").unwrap().as_deref(), Some("{\"frames\":[]}")); put(&d, "tvdash", "{\"a\":1}").unwrap(); assert_eq!(get(&d, "tvdash").unwrap().as_deref(), Some("{\"a\":1}")); assert!(!d.join(".tvdash.tmp").exists()); }
    #[test] fn ids_cannot_escape_the_dir() { let d = tmp("id"); for bad in ["", "..", "../x", "a/b", "A", "-x", "a b", "x.json", &"a".repeat(41)] { assert!(put(&d, bad, "{}").is_err(), "{bad}"); assert!(get(&d, bad).is_err(), "{bad}"); } assert!(!d.exists() || fs::read_dir(&d).unwrap().count() == 0); }
    #[test] fn rejects_non_json_and_oversize() { let d = tmp("bad"); assert!(put(&d, "x", "not json").is_err()); assert!(put(&d, "x", &format!("\"{}\"", "a".repeat(MAX_BYTES))).is_err()); assert_eq!(get(&d, "x").unwrap(), None); }
    #[test] fn unreadable_file_is_an_error_not_missing() { let d = tmp("ro"); fs::create_dir_all(d.join("x.project.json")).unwrap(); assert!(get(&d, "x").is_err()); }
}
