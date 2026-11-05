//! `save_template` (#1835): the app builds the template folder (from the selection, or from a repo scan done here); this writes it to disk.
//! Destinations match the loader (`app/src/templateSources.ts`): `<data_dir>/templates/<slug>` (user) or `<repo>/.swift-canvas/templates/<slug>` (repo, only inside an allowed project root).
use crate::{mcp::Hub, scan};
use serde_json::{json, Value};
use std::{fs, path::{Path, PathBuf}, time::Duration};

const MAX_TOTAL: usize = 1024 * 1024;
const WAIT: Duration = Duration::from_secs(15);
fn slug_ok(s: &str) -> bool { !s.is_empty() && s.len() <= 40 && s.starts_with(|c: char| c.is_ascii_lowercase() || c.is_ascii_digit()) && s.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-') }
fn frame_file_ok(n: &str) -> bool { n.len() <= 65 && n.ends_with(".html") && !n.starts_with('.') && n.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-')) }

/// Write `files` ("template.json", "frames/<name>.html") as `<root>/<slug>/`, all or nothing. An existing template is kept unless `overwrite`.
pub fn write_template(root: &Path, slug: &str, files: &serde_json::Map<String, Value>, overwrite: bool) -> Result<PathBuf, String> {
    if !slug_ok(slug) { return Err(format!("bad template folder name {slug:?}")); }
    let mut total = 0; let mut list: Vec<(&str, &str)> = vec![];
    for (k, v) in files {
        let text = v.as_str().ok_or_else(|| format!("{k}: not text"))?; total += text.len();
        let ok = k == "template.json" || k.strip_prefix("frames/").is_some_and(frame_file_ok);
        if !ok { return Err(format!("refusing to write {k:?} (only template.json and frames/<name>.html)")); }
        list.push((k, text));
    }
    if total > MAX_TOTAL { return Err("template too large".into()); } if !files.contains_key("template.json") { return Err("template.json is missing".into()); }
    let dest = root.join(slug);
    if fs::symlink_metadata(&dest).is_ok() && !overwrite { return Err(format!("a template named {slug:?} already exists in {} (pass overwrite: true to replace it)", root.display())); }
    fs::create_dir_all(root).map_err(|e| format!("cannot create {}: {e}", root.display()))?;
    let tmp = root.join(format!(".tmp-{slug}-{}", std::process::id())); let _ = fs::remove_dir_all(&tmp);
    let res = (|| -> std::io::Result<()> {
        fs::create_dir_all(tmp.join("frames"))?; for (k, t) in &list { fs::write(tmp.join(k), t)?; }
        if fs::symlink_metadata(&dest).is_ok() { let md = fs::symlink_metadata(&dest)?; if md.is_dir() { fs::remove_dir_all(&dest)?; } else { fs::remove_file(&dest)?; } }
        fs::rename(&tmp, &dest)
    })();
    if let Err(e) = res { let _ = fs::remove_dir_all(&tmp); return Err(format!("cannot write the template: {e}")); }
    Ok(dest)
}

/// The MCP tool: `{ name, description?, frame?, frames?, from_repo?, dest?: "user"|"repo", overwrite? }`.
pub fn save_tool(hub: &Hub, data_dir: &Path, roots: &[PathBuf], args: &Value) -> Result<Value, String> {
    let name = args.get("name").and_then(|n| n.as_str()).ok_or("name is required")?;
    let dest = args.get("dest").and_then(|d| d.as_str()).unwrap_or("user"); let overwrite = args.get("overwrite").and_then(|o| o.as_bool()).unwrap_or(false);
    let mut ask = json!({ "name": name }); for k in ["description", "frame", "frames"] { if let Some(v) = args.get(k) { ask[k] = v.clone(); } }
    let repo = match args.get("from_repo").and_then(|r| r.as_str()) { Some(p) => Some(scan::allowed_root(Path::new(p), roots).ok_or("folder not allowed: pick it with Choose... in the app (or set SWIFT_PROJECT_ROOTS)")?), None => None };
    if let Some(r) = &repo { ask["scan"] = serde_json::to_value(scan::scan_dir(r).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?; }
    let root = match dest { "user" => data_dir.join("templates"), "repo" => repo.as_ref().ok_or("dest \"repo\" needs from_repo (the repository folder)")?.join(".swift-canvas").join("templates"), d => return Err(format!("dest must be \"user\" or \"repo\", not {d:?}")) };
    let r = hub.ask_app("save_template", ask, WAIT)?;
    let slug = r.get("slug").and_then(|s| s.as_str()).ok_or("the app returned no template")?; let files = r.get("files").and_then(|f| f.as_object()).ok_or("the app returned no files")?;
    let path = write_template(&root, slug, files, overwrite)?;
    Ok(json!({ "saved": path.display().to_string(), "slug": slug, "name": r.get("name"), "slots": r.get("slots"), "warnings": r.get("warnings"), "dest": dest }))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn files(v: Value) -> serde_json::Map<String, Value> { v.as_object().unwrap().clone() }
    fn tmp(n: &str) -> PathBuf { let p = std::env::temp_dir().join(format!("sc-tpl-{n}-{}", std::process::id())); let _ = fs::remove_dir_all(&p); p }
    #[test] fn writes_the_folder_and_refuses_overwrite_unless_asked() {
        let root = tmp("w"); let f = files(json!({ "template.json": "{}", "frames/home.html": "<div id=\"home\">x</div>" }));
        let d = write_template(&root, "my-t", &f, false).unwrap(); assert_eq!(fs::read_to_string(d.join("frames/home.html")).unwrap(), "<div id=\"home\">x</div>");
        assert!(write_template(&root, "my-t", &f, false).unwrap_err().contains("already exists"));
        let g = files(json!({ "template.json": "{\"v\":2}" })); write_template(&root, "my-t", &g, true).unwrap(); assert_eq!(fs::read_to_string(d.join("template.json")).unwrap(), "{\"v\":2}"); assert!(!d.join("frames/home.html").exists());
        assert_eq!(fs::read_dir(&root).unwrap().count(), 1, "no temp folder left"); let _ = fs::remove_dir_all(&root);
    }
    #[test] fn refuses_bad_names_paths_and_sizes() {
        let root = tmp("b"); let ok = files(json!({ "template.json": "{}" }));
        for s in ["", "../x", "A", "a/b", "-a", &"a".repeat(41)] { assert!(write_template(&root, s, &ok, false).is_err(), "{s}"); }
        for k in ["../evil.html", "frames/../x.html", "frames/.h.html", "frames/a/b.html", "other.txt", "frames/a.js"] { let f = files(json!({ "template.json": "{}", k: "x" })); assert!(write_template(&root, "t", &f, false).is_err(), "{k}"); }
        assert!(write_template(&root, "t", &files(json!({ "frames/a.html": "x" })), false).unwrap_err().contains("template.json"));
        assert!(write_template(&root, "t", &files(json!({ "template.json": "x".repeat(MAX_TOTAL + 1) })), false).unwrap_err().contains("too large"));
        assert!(write_template(&root, "t", &files(json!({ "template.json": 5 })), false).is_err()); assert!(!root.join("t").exists()); let _ = fs::remove_dir_all(&root);
    }
}
