//! Brand-token extraction from a project folder (task #1736): CSS custom properties, colours and fonts found in .css/.scss/.html files.
//! Reads only folders the user explicitly allowed (`SWIFT_PROJECT_ROOTS`), never follows symlinks, skips dependency/build folders, and caps file count and size.
use serde::Serialize;
use std::{collections::HashMap, fs, io, path::{Path, PathBuf}};

const SKIP_DIRS: &[&str] = &["node_modules", ".git", "target", "dist", "build", ".next", ".venv", "venv", "__pycache__", ".cache", "vendor", "Pods"];
const EXTS: &[&str] = &["css", "scss", "html", "htm"];
pub const MAX_FILES: usize = 1500; pub const MAX_FILE_BYTES: u64 = 512 * 1024; pub const MAX_DEPTH: usize = 8;
#[derive(Debug, Serialize, PartialEq, Clone)] pub struct Token { pub name: String, pub value: String, pub file: String }
#[derive(Debug, Serialize, PartialEq)] pub struct Count { pub value: String, pub count: u32 }
#[derive(Debug, Serialize, Default)] pub struct Scan { pub files: usize, pub tokens: Vec<Token>, pub colors: Vec<Count>, pub fonts: Vec<Count> }

/// The canonical path if `path` is inside one of the allowed roots (symlink-safe: both sides are canonicalized), else None.
pub fn allowed_root(path: &Path, roots: &[PathBuf]) -> Option<PathBuf> {
    let p = fs::canonicalize(path).ok()?; roots.iter().filter_map(|r| fs::canonicalize(r).ok()).any(|r| p.starts_with(&r)).then_some(p)
}
/// `--name: value;` declarations (not `var(--name)` uses, which are preceded by `(`).
pub fn parse_tokens(text: &str, file: &str, out: &mut Vec<Token>) {
    let b = text.as_bytes(); let mut i = 0;
    while i + 3 < b.len() {
        if b[i] == b'-' && b[i + 1] == b'-' && (i == 0 || !matches!(b[i - 1], b'(' | b'-' | b'_' | b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9')) {
            let mut j = i + 2; while j < b.len() && (b[j].is_ascii_alphanumeric() || b[j] == b'-' || b[j] == b'_') { j += 1; }
            let name = &text[i..j]; let mut k = j; while k < b.len() && (b[k] == b' ' || b[k] == b'\t') { k += 1; }
            if j > i + 2 && k < b.len() && b[k] == b':' {
                let start = k + 1; let mut e = start; while e < b.len() && !matches!(b[e], b';' | b'}' | b'\n') { e += 1; }
                let value = text[start..e].trim().trim_end_matches("!important").trim(); if !value.is_empty() && value.len() <= 200 { out.push(Token { name: name.to_string(), value: value.to_string(), file: file.to_string() }); }
                i = e; continue;
            }
            i = j; continue;
        }
        i += 1;
    }
}
/// #rgb / #rrggbb (and 4/8-digit forms), normalised to lowercase 6 digits where possible.
pub fn parse_colors(text: &str, counts: &mut HashMap<String, u32>) {
    let b = text.as_bytes(); let mut i = 0;
    while i < b.len() {
        // a colour follows a delimiter; `a#fff1`, URL fragments (`/page#abc`) and `&#123;` entities are not colours
        if b[i] == b'#' && (i == 0 || matches!(b[i - 1], b':' | b' ' | b'\t' | b'\n' | b'\r' | b'(' | b',' | b'"' | b'\'' | b'=' | b';' | b'{')) { let mut j = i + 1; while j < b.len() && b[j].is_ascii_hexdigit() { j += 1; }
            let n = j - i - 1; let boundary = j >= b.len() || !(b[j].is_ascii_alphanumeric() || b[j] == b'_' || b[j] == b'-');
            if boundary && matches!(n, 3 | 4 | 6 | 8) { let h = text[i + 1..j].to_ascii_lowercase(); let norm = if n <= 4 { h.chars().take(3).flat_map(|c| [c, c]).collect::<String>() } else { h[..6].to_string() }; *counts.entry(format!("#{norm}")).or_insert(0) += 1; }
            i = j.max(i + 1); } else { i += 1; }
    }
}
/// The first family of each `font-family:` declaration.
pub fn parse_fonts(text: &str, counts: &mut HashMap<String, u32>) {
    let mut rest = text;
    while let Some(p) = rest.find("font-family") {
        rest = &rest[p + 11..]; let t = rest.trim_start(); let Some(t) = t.strip_prefix(':') else { continue };
        let end = t.find([';', '}', '"', '\n']).unwrap_or(t.len()); let first = t[..end].split(',').next().unwrap_or("").trim().trim_matches(['\'', '"']).trim();
        if !first.is_empty() && first.len() <= 40 && !first.starts_with("var(") && !first.starts_with('-') && !["inherit", "initial"].contains(&first) { *counts.entry(first.to_string()).or_insert(0) += 1; }
    }
}
fn top(m: HashMap<String, u32>, n: usize) -> Vec<Count> { let mut v: Vec<_> = m.into_iter().map(|(value, count)| Count { value, count }).collect(); v.sort_by(|a, b| b.count.cmp(&a.count).then(a.value.cmp(&b.value))); v.truncate(n); v }
pub fn scan_dir(root: &Path) -> io::Result<Scan> {
    let (mut tokens, mut colors, mut fonts, mut files) = (Vec::new(), HashMap::new(), HashMap::new(), 0usize);
    let mut stack = vec![(root.to_path_buf(), 0usize)];
    while let Some((dir, depth)) = stack.pop() {
        let Ok(rd) = fs::read_dir(&dir) else { continue }; let mut entries: Vec<_> = rd.filter_map(Result::ok).collect(); entries.sort_by_key(|e| e.file_name());
        for e in entries {
            let Ok(ft) = e.file_type() else { continue }; if ft.is_symlink() { continue; } // never follow links out of the project
            let name = e.file_name().to_string_lossy().into_owned();
            if ft.is_dir() { if depth < MAX_DEPTH && !SKIP_DIRS.contains(&name.as_str()) && !name.starts_with('.') { stack.push((e.path(), depth + 1)); } continue; }
            let path = e.path(); let ext = path.extension().and_then(|x| x.to_str()).unwrap_or("").to_ascii_lowercase();
            if !EXTS.contains(&ext.as_str()) || files >= MAX_FILES { continue; }
            if e.metadata().map(|m| m.len() > MAX_FILE_BYTES).unwrap_or(true) { continue; }
            let Ok(text) = fs::read_to_string(&path) else { continue }; files += 1; let rel = path.strip_prefix(root).unwrap_or(&path).to_string_lossy().into_owned();
            parse_tokens(&text, &rel, &mut tokens); parse_colors(&text, &mut colors); parse_fonts(&text, &mut fonts);
        }
    }
    let mut seen = std::collections::HashSet::new(); tokens.retain(|t| seen.insert(t.name.clone())); tokens.truncate(200);
    Ok(Scan { files, tokens, colors: top(colors, 12), fonts: top(fonts, 5) })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn tokens_are_declarations_not_uses() { let mut o = vec![]; parse_tokens(":root{--ink:#0b0b0f; --blue : #0a84ff !important;}\n.a{color:var(--ink);margin:-- 1px}\n  --font-ui: Inter, sans-serif\n", "a.css", &mut o); assert_eq!(o.iter().map(|t| (t.name.as_str(), t.value.as_str())).collect::<Vec<_>>(), vec![("--ink", "#0b0b0f"), ("--blue", "#0a84ff"), ("--font-ui", "Inter, sans-serif")]); }
    #[test] fn colors_normalise_and_ignore_non_colors() { let mut c = HashMap::new(); parse_colors("#FFF #ffffff #0A84FF #0a84ff #12345 #abcdefg a#fff1 #1c1c24", &mut c); assert_eq!(c["#ffffff"], 2); assert_eq!(c["#0a84ff"], 2); assert_eq!(c["#1c1c24"], 1); assert!(!c.contains_key("#12345") && !c.contains_key("#abcdef")); }
    #[test] fn fonts_take_the_first_family() { let mut f = HashMap::new(); parse_fonts("body{font-family: 'Inter', system-ui; } p{font-family:Inter,sans-serif} <div style=\"font-family: Barlow, sans\"> x{font-family:var(--f)} y{font-family: inherit}", &mut f); assert_eq!(f["Inter"], 2); assert_eq!(f["Barlow"], 1); assert!(!f.contains_key("var(--f)") && !f.contains_key("inherit")); }
    #[test] fn scan_walks_skips_dependencies_and_symlinks() {
        let d = std::env::temp_dir().join(format!("scan-{}", std::process::id())); let _ = fs::remove_dir_all(&d); fs::create_dir_all(d.join("web/node_modules/x")).unwrap(); fs::create_dir_all(d.join("web/src")).unwrap();
        fs::write(d.join("web/src/a.css"), ":root{--ac:#0a84ff} body{font-family:Inter} .x{color:#0a84ff}").unwrap(); fs::write(d.join("web/node_modules/x/b.css"), ":root{--evil:#ff0000}").unwrap(); fs::write(d.join("note.txt"), "--nope:#000").unwrap();
        let outside = std::env::temp_dir().join(format!("scan-out-{}", std::process::id())); fs::create_dir_all(&outside).unwrap(); fs::write(outside.join("secret.css"), ":root{--secret:#123456}").unwrap(); let _ = std::os::unix::fs::symlink(&outside, d.join("link"));
        let s = scan_dir(&d).unwrap(); assert_eq!(s.files, 1); assert_eq!(s.tokens.len(), 1); assert_eq!(s.tokens[0].name, "--ac"); assert_eq!(s.colors[0], Count { value: "#0a84ff".into(), count: 2 }); assert_eq!(s.fonts[0].value, "Inter");
    }
    #[test] fn only_allowed_roots_can_be_scanned() {
        let a = std::env::temp_dir().join(format!("root-a-{}", std::process::id())); let b = std::env::temp_dir().join(format!("root-b-{}", std::process::id())); fs::create_dir_all(a.join("sub")).unwrap(); fs::create_dir_all(&b).unwrap();
        assert!(allowed_root(&a.join("sub"), &[a.clone()]).is_some()); assert!(allowed_root(&b, &[a.clone()]).is_none()); assert!(allowed_root(&a.join("sub/../../"), &[a.clone()]).is_none()); assert!(allowed_root(&a, &[]).is_none()); assert!(allowed_root(&a.join("missing"), &[a.clone()]).is_none());
    }
}
