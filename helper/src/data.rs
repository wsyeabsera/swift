//! Repo data for `fill_from_data` (task #1837): a JSON / CSV / TSV file or the examples of an OpenAPI document become a small table of strings.
//! The file is untrusted input: only inside an allowed project folder (symlink-safe, no `..`, no dependency/hidden folders as in scan.rs), only .json/.csv/.tsv,
//! at most MAX_BYTES read, and the table is capped (rows, columns, cell length). Everything cut is counted in `dropped` so the caller can say so.
use crate::scan::allowed_root;
use serde_json::{json, Map, Value};
use std::{fs, io::Read, path::{Component, Path, PathBuf}};

pub const MAX_BYTES: u64 = 1 << 20; pub const DEFAULT_ROWS: usize = 50; pub const MAX_ROWS: usize = 200; pub const MAX_COLS: usize = 20; pub const MAX_CELL: usize = 120; pub const MAX_EXAMPLES: usize = 60;
const SKIP: &[&str] = &["node_modules", ".git", "target", "dist", "build", ".next", ".venv", "venv", "__pycache__", ".cache", "vendor", "Pods"];

#[derive(Debug, Default, Clone)] pub struct Opts { pub max_rows: Option<usize>, pub pointer: Option<String>, pub example: Option<String>, pub columns: Option<Vec<String>> }
#[derive(Debug, Default)] struct Cut { rows: usize, cols: usize, cells: usize }

/// Resolve `path` (relative to an allowed root, or absolute inside one) to a canonical readable file; every refusal says why.
pub fn resolve(path: &str, roots: &[PathBuf]) -> Result<PathBuf, String> {
    if roots.is_empty() { return Err("no project folder is allowed: choose one in the app (Choose…) or set SWIFT_PROJECT_ROOTS".into()); }
    if path.is_empty() || path.len() > 1000 || path.contains('\0') { return Err("bad path".into()); }
    let p = Path::new(path);
    let cands: Vec<PathBuf> = if p.is_absolute() { vec![p.to_path_buf()] } else { roots.iter().map(|r| r.join(p)).collect() };
    let mut found = None; for c in &cands { if let Ok(real) = fs::canonicalize(c) { found = Some((c.clone(), real)); break; } }
    let (_, real) = found.ok_or_else(|| format!("{path}: not found inside the allowed project folders"))?;
    if allowed_root(&real, roots).is_none() { return Err(format!("{path}: outside the allowed project folders (only files inside a folder you chose are read)")); }
    // the same folder allow-list as scan: no dependency, build or hidden folders on the way (and no hidden file such as .env)
    let rel = roots.iter().filter_map(|r| fs::canonicalize(r).ok()).find_map(|r| real.strip_prefix(&r).ok().map(Path::to_path_buf)).unwrap_or_default();
    for c in rel.components() { if let Component::Normal(n) = c { let n = n.to_string_lossy(); if n.starts_with('.') || SKIP.contains(&n.as_ref()) { return Err(format!("{path}: {n} is a hidden, dependency or build path and is never read")); } } }
    let ext = real.extension().and_then(|x| x.to_str()).unwrap_or("").to_ascii_lowercase();
    if !matches!(ext.as_str(), "json" | "csv" | "tsv") { return Err(format!("{path}: only .json, .csv and .tsv files can be read (got .{ext})")); }
    let md = fs::metadata(&real).map_err(|e| format!("{path}: {e}"))?; if !md.is_file() { return Err(format!("{path}: not a regular file")); }
    if md.len() > MAX_BYTES { return Err(format!("{path}: {} bytes is over the {} byte limit", md.len(), MAX_BYTES)); }
    Ok(real)
}

pub fn load_table(path: &str, roots: &[PathBuf], o: &Opts) -> Result<Value, String> {
    let real = resolve(path, roots)?; let mut buf = Vec::new();
    fs::File::open(&real).and_then(|f| f.take(MAX_BYTES + 1).read_to_end(&mut buf)).map_err(|e| format!("{path}: {e}"))?;
    if buf.len() as u64 > MAX_BYTES { return Err(format!("{path}: over the {MAX_BYTES} byte limit")); }
    let text = String::from_utf8(buf).map_err(|_| format!("{path}: not UTF-8 text"))?; let text = text.trim_start_matches('\u{feff}');
    let ext = real.extension().and_then(|x| x.to_str()).unwrap_or("").to_ascii_lowercase();
    let (kind, columns, mut rows, note): (&str, Vec<String>, Vec<Vec<String>>, Value) = if ext == "json" {
        let v: Value = serde_json::from_str(text).map_err(|e| format!("{path}: bad JSON: {e}"))?;
        if v.get("openapi").is_some() || v.get("swagger").is_some() { openapi(&v, o.example.as_deref())? } else { let (c, r) = json_table(&v, o.pointer.as_deref())?; ("json", c, r, Value::Null) }
    } else { let (c, r) = csv_table(text, if ext == "tsv" { b'\t' } else { b',' })?; ("csv", c, r, Value::Null) };
    let total = rows.len(); let mut cut = Cut::default();
    let mut columns = columns;
    if let Some(want) = &o.columns { let idx: Vec<usize> = want.iter().map(|w| columns.iter().position(|c| c == w).ok_or_else(|| format!("no column {w:?} (columns: {})", columns.join(", ")))).collect::<Result<_, _>>()?;
        rows = rows.into_iter().map(|r| idx.iter().map(|&i| r.get(i).cloned().unwrap_or_default()).collect()).collect(); columns = idx.iter().map(|&i| columns[i].clone()).collect(); }
    if columns.len() > MAX_COLS { cut.cols = columns.len() - MAX_COLS; columns.truncate(MAX_COLS); for r in &mut rows { r.truncate(MAX_COLS); } }
    let cap = o.max_rows.unwrap_or(DEFAULT_ROWS).clamp(1, MAX_ROWS); if rows.len() > cap { cut.rows = rows.len() - cap; rows.truncate(cap); }
    for r in &mut rows { for c in r.iter_mut() { if c.chars().count() > MAX_CELL { *c = c.chars().take(MAX_CELL - 1).collect::<String>() + "…"; cut.cells += 1; } } }
    let mut out = json!({ "source": path, "kind": kind, "columns": columns, "rows": rows, "totalRows": total, "dropped": { "rows": cut.rows, "columns": cut.cols, "truncatedCells": cut.cells } });
    if !note.is_null() { out["examples"] = note; }
    Ok(out)
}

fn cell(v: &Value) -> String { match v { Value::Null => String::new(), Value::String(s) => s.clone(), Value::Bool(b) => b.to_string(), Value::Number(n) => n.to_string(), other => other.to_string() } }
/// Rows of a JSON value: an array of objects (columns = union of keys in first-seen order), an array of arrays/scalars, or one object (one row). `pointer` (RFC 6901) picks a nested value, e.g. /data/items.
fn json_table(v: &Value, pointer: Option<&str>) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let v = match pointer.filter(|p| !p.is_empty()) { Some(p) => v.pointer(p).ok_or_else(|| format!("pointer {p} not found in the JSON"))?, None => v };
    let items: Vec<&Value> = match v { Value::Array(a) => a.iter().collect(), other => vec![other] };
    if items.is_empty() { return Err("the JSON array is empty".into()); }
    let objs = items.iter().all(|i| i.is_object());
    if objs { let mut cols: Vec<String> = vec![]; for i in &items { for k in i.as_object().unwrap().keys() { if !cols.contains(k) && cols.len() < 200 { cols.push(k.clone()); } } }
        let rows = items.iter().map(|i| { let m: &Map<String, Value> = i.as_object().unwrap(); cols.iter().map(|c| m.get(c).map(cell).unwrap_or_default()).collect() }).collect(); return Ok((cols, rows)); }
    if items.iter().all(|i| i.is_array()) { let w = items.iter().map(|i| i.as_array().unwrap().len()).max().unwrap_or(0).min(200);
        return Ok(((1..=w).map(|n| format!("col{n}")).collect(), items.iter().map(|i| { let a = i.as_array().unwrap(); (0..w).map(|k| a.get(k).map(cell).unwrap_or_default()).collect() }).collect())); }
    Ok((vec!["value".into()], items.iter().map(|i| vec![cell(i)]).collect()))
}

/// RFC 4180 style: quoted fields with "" escapes and embedded newlines; the first record is the header.
fn csv_table(text: &str, sep: u8) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let (mut recs, mut rec, mut f, mut q) = (Vec::<Vec<String>>::new(), Vec::<String>::new(), String::new(), false);
    let mut it = text.chars().peekable(); let sep = sep as char;
    while let Some(c) = it.next() {
        if q { if c == '"' { if it.peek() == Some(&'"') { f.push('"'); it.next(); } else { q = false; } } else { f.push(c); } continue; }
        match c { '"' if f.is_empty() => q = true, c if c == sep => { rec.push(std::mem::take(&mut f)); }
            '\r' => {} '\n' => { rec.push(std::mem::take(&mut f)); recs.push(std::mem::take(&mut rec)); if recs.len() > 100_000 { return Err("too many records".into()); } }
            c => f.push(c) }
    }
    if q { return Err("bad CSV: a quoted field is never closed".into()); }
    if !f.is_empty() || !rec.is_empty() { rec.push(f); recs.push(rec); }
    recs.retain(|r| !(r.len() == 1 && r[0].is_empty()));
    let mut it = recs.into_iter(); let head = it.next().ok_or("the CSV is empty")?; let w = head.len();
    let cols: Vec<String> = head.iter().enumerate().map(|(i, h)| if h.trim().is_empty() { format!("col{}", i + 1) } else { h.trim().to_string() }).collect();
    let rows: Vec<Vec<String>> = it.map(|mut r| { r.resize(w, String::new()); r }).collect(); Ok((cols, rows))
}

/// Example values of an OpenAPI document: media-type `example` / `examples.*.value`, schema `example`, and components.schemas.*.example. Each is labelled ("GET /users 200", "schema User");
/// `pick` chooses one by label (substring, case-insensitive), the default is the first with several rows else the first. The labels found are returned so a caller can choose.
fn openapi(doc: &Value, pick: Option<&str>) -> Result<(&'static str, Vec<String>, Vec<Vec<String>>, Value), String> {
    let mut found: Vec<(String, Value)> = vec![];
    if let Some(paths) = doc.get("paths").and_then(|p| p.as_object()) { for (path, item) in paths { let Some(item) = item.as_object() else { continue };
        for (method, op) in item { if !matches!(method.as_str(), "get" | "post" | "put" | "patch" | "delete") { continue; }
            let mut sources: Vec<(String, &Value)> = vec![];
            if let Some(resps) = op.get("responses").and_then(|r| r.as_object()) { for (code, r) in resps { if let Some(media) = r.get("content").and_then(|c| c.as_object()) { for (_, m) in media { sources.push((format!("{} {} {}", method.to_uppercase(), path, code), m)); } } } }
            if let Some(media) = op.pointer("/requestBody/content").and_then(|c| c.as_object()) { for (_, m) in media { sources.push((format!("{} {} request", method.to_uppercase(), path), m)); } }
            for (label, m) in sources {
                if let Some(e) = m.get("example") { found.push((label.clone(), e.clone())); }
                if let Some(ex) = m.get("examples").and_then(|e| e.as_object()) { for (n, e) in ex { if let Some(v) = e.get("value") { found.push((format!("{label} {n}"), v.clone())); } } }
                if let Some(e) = m.pointer("/schema/example") { found.push((label, e.clone())); }
            } } } }
    if let Some(sc) = doc.pointer("/components/schemas").and_then(|s| s.as_object()) { for (n, s) in sc { if let Some(e) = s.get("example") { found.push((format!("schema {n}"), e.clone())); } } }
    if found.is_empty() { return Err("the OpenAPI document has no example values (add `example` / `examples` to responses or schemas)".into()); }
    found.truncate(MAX_EXAMPLES); let labels: Vec<String> = found.iter().map(|(l, _)| l.clone()).collect();
    let i = match pick { Some(p) => { let p = p.to_ascii_lowercase(); found.iter().position(|(l, _)| l.to_ascii_lowercase().contains(&p)).ok_or_else(|| format!("no example matches {p:?} (examples: {})", labels.join("; ")))? }
        None => found.iter().position(|(_, v)| v.as_array().map(|a| a.len() > 1).unwrap_or(false)).unwrap_or(0) };
    let (c, r) = json_table(&found[i].1, None)?; Ok(("openapi", c, r, json!({ "used": labels[i], "available": labels })))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn tmp(n: &str) -> PathBuf { let d = std::env::temp_dir().join(format!("data-{n}-{}", std::process::id())); let _ = fs::remove_dir_all(&d); fs::create_dir_all(&d).unwrap(); fs::canonicalize(d).unwrap() }
    #[test] fn csv_quotes_newlines_and_ragged_rows() {
        let (c, r) = csv_table("name,note,n\r\n\"Ada, L\",\"say \"\"hi\"\"\nthere\",3\nBob\n\n", b',').unwrap();
        assert_eq!(c, ["name", "note", "n"]); assert_eq!(r[0], ["Ada, L", "say \"hi\"\nthere", "3"]); assert_eq!(r[1], ["Bob", "", ""]); assert_eq!(r.len(), 2);
        assert!(csv_table("a,b\n\"open", b',').is_err());
    }
    #[test] fn json_shapes() {
        let (c, r) = json_table(&json!([{ "a": 1, "b": "x" }, { "b": null, "c": { "k": 1 } }]), None).unwrap(); assert_eq!(c, ["a", "b", "c"]); assert_eq!(r[1], ["", "", "{\"k\":1}"]);
        assert_eq!(json_table(&json!({ "data": { "items": [1, 2] } }), Some("/data/items")).unwrap().1, vec![vec!["1"], vec!["2"]]);
        assert!(json_table(&json!([]), None).is_err()); assert!(json_table(&json!({}), Some("/x")).unwrap_err().contains("not found"));
    }
    #[test] fn openapi_examples_are_found_and_selectable() {
        let d = json!({ "openapi": "3.0.0", "paths": { "/users": { "get": { "responses": { "200": { "content": { "application/json": { "example": [{ "id": 1, "name": "Ada" }, { "id": 2, "name": "Bo" }] } } } } } },
            "/me": { "get": { "responses": { "200": { "content": { "application/json": { "examples": { "main": { "value": { "id": 9, "name": "Me" } } } } } } } } } }, "components": { "schemas": { "Org": { "example": { "title": "Acme" } } } } });
        let (_, c, r, n) = openapi(&d, None).unwrap(); assert_eq!(c, ["id", "name"]); assert_eq!(r.len(), 2); assert_eq!(n["available"].as_array().unwrap().len(), 3);
        let (_, c, r, _) = openapi(&d, Some("schema org")).unwrap(); assert_eq!((c, r), (vec!["title".to_string()], vec![vec!["Acme".to_string()]]));
        assert!(openapi(&d, Some("nope")).unwrap_err().contains("examples:")); assert!(openapi(&json!({ "openapi": "3", "paths": {} }), None).is_err());
    }
    #[test] fn paths_outside_the_root_and_unsafe_names_are_refused() {
        let root = tmp("root"); let out = tmp("out"); fs::write(out.join("secret.csv"), "a\n1").unwrap(); fs::write(root.join("ok.csv"), "a,b\n1,2\n").unwrap(); fs::write(root.join(".env.json"), "[]").unwrap();
        fs::create_dir_all(root.join("node_modules/x")).unwrap(); fs::write(root.join("node_modules/x/d.json"), "[1]").unwrap(); fs::write(root.join("notes.txt"), "x").unwrap();
        std::os::unix::fs::symlink(&out, root.join("link")).unwrap(); std::os::unix::fs::symlink(out.join("secret.csv"), root.join("s.csv")).unwrap();
        let roots = vec![root.clone()];
        assert!(load_table("ok.csv", &roots, &Opts::default()).is_ok());
        assert!(load_table(root.join("ok.csv").to_str().unwrap(), &roots, &Opts::default()).is_ok());
        for bad in ["../secret.csv", out.join("secret.csv").to_str().unwrap(), "link/secret.csv", "s.csv", ".env.json", "node_modules/x/d.json", "notes.txt", "missing.csv", "/etc/passwd"] { assert!(load_table(bad, &roots, &Opts::default()).is_err(), "{bad} must be refused"); }
        assert!(load_table("ok.csv", &[], &Opts::default()).unwrap_err().contains("no project folder"));
        let e = load_table("s.csv", &roots, &Opts::default()).unwrap_err(); assert!(e.contains("outside"), "{e}");
    }
    #[test] fn caps_rows_columns_cells_and_reports_them() {
        let root = tmp("caps"); let head: Vec<String> = (0..25).map(|i| format!("c{i}")).collect(); let mut s = head.join(",") + "\n";
        for i in 0..300 { s += &format!("{i},{}\n", "é".repeat(500)); } fs::write(root.join("big.csv"), s).unwrap();
        let t = load_table("big.csv", &[root.clone()], &Opts { max_rows: Some(1000), ..Default::default() }).unwrap();
        assert_eq!(t["rows"].as_array().unwrap().len(), MAX_ROWS); assert_eq!(t["totalRows"], 300); assert_eq!(t["dropped"]["rows"], 100); assert_eq!(t["dropped"]["columns"], 5); assert_eq!(t["dropped"]["truncatedCells"], MAX_ROWS);
        assert_eq!(t["rows"][0][1].as_str().unwrap().chars().count(), MAX_CELL);
        let t = load_table("big.csv", &[root.clone()], &Opts { columns: Some(vec!["c1".into(), "c0".into()]), max_rows: Some(2), ..Default::default() }).unwrap(); assert_eq!(t["columns"], json!(["c1", "c0"])); assert_eq!(t["rows"][1][1], "1");
        assert!(load_table("big.csv", &[root.clone()], &Opts { columns: Some(vec!["zz".into()]), ..Default::default() }).is_err());
        fs::write(root.join("huge.json"), vec![b' '; MAX_BYTES as usize + 1]).unwrap(); assert!(load_table("huge.json", &[root], &Opts::default()).unwrap_err().contains("limit"));
    }
}
