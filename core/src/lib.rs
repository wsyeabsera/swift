//! Swift Canvas core: the document model shared by the helper (and, later, other native tools).
//! A node tree with stable ids, typed ops with EXACT inverses, a 3-way merge with per-property last-writer-wins, and a token resolver.
//! Simple ops stay in TypeScript in the renderer (spikes/core/RESULTS.md: no WASM win); the helper uses this crate to validate and dry-run
//! ops that arrive from the MCP server before the app ever sees them. TS types and JSON Schema are generated from these types (`examples/gen.rs`).
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use ts_rs::TS;
pub mod live;

pub const MAX_VALUE: usize = 200;
pub const MAX_TEXT: usize = 4000;
pub const MAX_HTML: usize = 4000;
pub const MAX_OPS: usize = 200;

/// One element. `style` holds CSS properties; `html` is opaque markup for nodes the helper only knows from an `add` op.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
pub struct Node {
    pub id: String,
    #[serde(default)] pub tag: String,
    #[serde(default)] pub text: String,
    #[serde(default)] pub style: BTreeMap<String, String>,
    #[serde(default)] #[ts(optional)] pub html: Option<String>,
    #[serde(default)] pub children: Vec<Node>,
}
/// A frame: its root element and its design tokens (CSS custom properties on the root).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
pub struct Tree {
    pub root: Node,
    #[serde(default)] pub tokens: BTreeMap<String, String>,
}
/// The flat element list the app reports (`CanvasApi.tree`).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
pub struct FlatNode {
    pub id: String,
    pub parent: Option<String>,
    #[serde(default)] pub tag: String,
    #[serde(default)] pub text: String,
}

/// A typed op. `set`/`token`/`text`/`add`/`remove` are the external language (same as the Say ops); `insert`/`replace` exist so every op has an exact inverse.
/// `value: null` (None) removes a property or token; external ops must carry a string.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
#[serde(tag = "op", rename_all = "lowercase")]
pub enum Op {
    Set { id: String, prop: String, value: Option<String> },
    Token { name: String, value: Option<String> },
    Text { id: String, value: String },
    Add { parent: String, id: String, html: String },
    Remove { id: String },
    Insert { parent: String, index: usize, node: Node },
    Replace { id: String, node: Node },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
pub struct OpError { pub code: String, pub message: String }
impl OpError { fn new(code: &str, message: impl Into<String>) -> Self { OpError { code: code.into(), message: message.into() } } }
impl std::fmt::Display for OpError { fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "{}: {}", self.code, self.message) } }
impl std::error::Error for OpError {}

fn is_prop(p: &str) -> bool {
    let p = p.strip_prefix("--").unwrap_or(p); let mut c = p.chars();
    matches!(c.next(), Some(f) if f.is_ascii_alphabetic()) && c.all(|x| x.is_ascii_alphanumeric() || x == '-')
}
fn is_token_name(n: &str) -> bool { n.len() > 2 && n.starts_with("--") && n[2..].chars().all(|x| x.is_ascii_alphanumeric() || x == '-') }
fn is_id(i: &str) -> bool { let mut c = i.chars(); matches!(c.next(), Some(f) if f.is_ascii_alphabetic()) && c.all(|x| x.is_ascii_alphanumeric() || x == '_' || x == '-') && i.len() <= 64 }
/// The same rules as app/src/say/ops.ts: no script tags, no on*= handlers, no javascript: URLs.
pub fn bad_html(h: &str) -> bool {
    let l = h.to_ascii_lowercase(); if l.contains("javascript:") { return true; }
    let b = l.as_bytes();
    for (i, _) in l.match_indices('<') { let rest = l[i + 1..].trim_start(); if rest.starts_with("script") { return true; } }
    for i in 0..b.len() { // \son\w+\s*=
        if b[i].is_ascii_whitespace() && b.get(i + 1) == Some(&b'o') && b.get(i + 2) == Some(&b'n') {
            let mut j = i + 3; let s = j; while j < b.len() && (b[j].is_ascii_alphanumeric() || b[j] == b'_') { j += 1; }
            if j > s { while j < b.len() && b[j].is_ascii_whitespace() { j += 1; } if b.get(j) == Some(&b'=') { return true; } }
        }
    }
    false
}
fn bad_value(v: &str) -> bool { v.len() > MAX_VALUE }

/// Content rules for an EXTERNAL op (from MCP): shape and size only; whether ids exist is checked against a tree by `apply`.
pub fn validate_external(op: &Op) -> Result<(), OpError> {
    match op {
        Op::Set { prop, value, .. } => { if !is_prop(prop) { return Err(OpError::new("bad_property", format!("bad property {prop:?}"))); } match value { Some(v) if !bad_value(v) => Ok(()), _ => Err(OpError::new("bad_value", "value must be a string of at most 200 characters")) } }
        Op::Token { name, value } => { if !is_token_name(name) { return Err(OpError::new("bad_token", format!("bad token name {name:?} (use --name)"))); } match value { Some(v) if !bad_value(v) => Ok(()), _ => Err(OpError::new("bad_value", "value must be a string of at most 200 characters")) } }
        Op::Text { value, .. } => if value.len() > MAX_TEXT { Err(OpError::new("bad_text", "text longer than 4000 characters")) } else { Ok(()) },
        Op::Add { id, html, .. } => { if !is_id(id) { return Err(OpError::new("bad_id", format!("bad id {id:?}"))); } if html.is_empty() || html.len() > MAX_HTML || bad_html(html) { return Err(OpError::new("bad_html", "html must be 1-4000 characters with no script tags, on*= handlers or javascript: URLs")); } Ok(()) }
        Op::Remove { .. } => Ok(()),
        Op::Insert { .. } | Op::Replace { .. } => Err(OpError::new("internal_op", "insert/replace are internal ops and cannot be sent from MCP")),
    }
}

impl Node {
    pub fn find(&self, id: &str) -> Option<&Node> { if self.id == id { return Some(self); } self.children.iter().find_map(|c| c.find(id)) }
    fn find_mut(&mut self, id: &str) -> Option<&mut Node> { if self.id == id { return Some(self); } self.children.iter_mut().find_map(|c| c.find_mut(id)) }
    fn collect_ids<'a>(&'a self, out: &mut Vec<&'a str>) { out.push(&self.id); for c in &self.children { c.collect_ids(out); } }
    /// Remove the descendant `id`; returns (parent id, index, node).
    fn take(&mut self, id: &str) -> Option<(String, usize, Node)> {
        if let Some(i) = self.children.iter().position(|c| c.id == id) { let n = self.children.remove(i); return Some((self.id.clone(), i, n)); }
        self.children.iter_mut().find_map(|c| c.take(id))
    }
}
impl Tree {
    pub fn new(root: Node) -> Tree { Tree { root, tokens: BTreeMap::new() } }
    pub fn ids(&self) -> BTreeSet<String> { let mut v = Vec::new(); self.root.collect_ids(&mut v); v.into_iter().map(str::to_string).collect() }
    pub fn count(&self) -> usize { let mut v = Vec::new(); self.root.collect_ids(&mut v); v.len() }
    /// Build a tree from the app's flat element list (parents must precede children or be absent; the first parentless node is the root).
    pub fn from_flat(nodes: &[FlatNode]) -> Result<Tree, OpError> {
        let root = nodes.iter().find(|n| n.parent.is_none()).ok_or_else(|| OpError::new("empty_tree", "no root element"))?;
        let mut kids: HashMap<&str, Vec<&FlatNode>> = HashMap::new(); for n in nodes { if let Some(p) = &n.parent { kids.entry(p.as_str()).or_default().push(n); } }
        fn build(n: &FlatNode, kids: &HashMap<&str, Vec<&FlatNode>>, depth: usize) -> Result<Node, OpError> {
            if depth > 200 { return Err(OpError::new("too_deep", "tree deeper than 200")); }
            Ok(Node { id: n.id.clone(), tag: n.tag.clone(), text: n.text.clone(), style: BTreeMap::new(), html: None, children: kids.get(n.id.as_str()).map(|v| v.iter().map(|c| build(c, kids, depth + 1)).collect::<Result<Vec<_>, _>>()).transpose()?.unwrap_or_default() })
        }
        let root = build(root, &kids, 0)?; let t = Tree::new(root);
        let mut v = Vec::new(); t.root.collect_ids(&mut v); let set: BTreeSet<&&str> = v.iter().collect(); if set.len() != v.len() { return Err(OpError::new("duplicate_id", "the element list has duplicate ids")); }
        Ok(t)
    }
    fn need(&self, id: &str) -> Result<(), OpError> { if self.root.find(id).is_some() { Ok(()) } else { Err(OpError::new("unknown_id", format!("unknown id {id}"))) } }
    /// Apply one op and return its exact inverse. Validates ids against the tree; content rules are `validate_external`'s job (the app's own undo applies inverses unchecked by content).
    pub fn apply(&mut self, op: &Op) -> Result<Op, OpError> {
        match op {
            Op::Set { id, prop, value } => { self.need(id)?; let n = self.root.find_mut(id).unwrap(); let prev = match value { Some(v) => n.style.insert(prop.clone(), v.clone()), None => n.style.remove(prop) }; Ok(Op::Set { id: id.clone(), prop: prop.clone(), value: prev }) }
            Op::Token { name, value } => { let prev = match value { Some(v) => self.tokens.insert(name.clone(), v.clone()), None => self.tokens.remove(name) }; Ok(Op::Token { name: name.clone(), value: prev }) }
            Op::Text { id, value } => { self.need(id)?; let n = self.root.find_mut(id).unwrap(); let prev = std::mem::replace(&mut n.text, value.clone()); Ok(Op::Text { id: id.clone(), value: prev }) }
            Op::Add { parent, id, html } => { self.need(parent)?; if self.root.find(id).is_some() { return Err(OpError::new("duplicate_id", format!("id {id} already exists"))); } let p = self.root.find_mut(parent).unwrap(); p.children.push(Node { id: id.clone(), html: Some(html.clone()), ..Node::default() }); Ok(Op::Remove { id: id.clone() }) }
            Op::Remove { id } => { self.need(id)?; if *id == self.root.id { return Err(OpError::new("root_protected", "the frame root cannot be removed")); } let (parent, index, node) = self.root.take(id).unwrap(); Ok(Op::Insert { parent, index, node }) }
            Op::Insert { parent, index, node } => { self.need(parent)?; self.check_new(&node, None)?; let p = self.root.find_mut(parent).unwrap(); if *index > p.children.len() { return Err(OpError::new("bad_index", "index out of range")); } p.children.insert(*index, node.clone()); Ok(Op::Remove { id: node.id.clone() }) }
            Op::Replace { id, node } => { self.need(id)?; if node.id != *id { return Err(OpError::new("bad_id", "replacement must keep the id")); } self.check_new(node, Some(id))?; let n = self.root.find_mut(id).unwrap(); let old = std::mem::replace(n, node.clone()); Ok(Op::Replace { id: id.clone(), node: old }) }
        }
    }
    /// New subtree ids must be unique inside it and not clash with the rest of the tree (`except` = the subtree about to be replaced).
    fn check_new(&self, node: &Node, except: Option<&str>) -> Result<(), OpError> {
        let mut mine = Vec::new(); node.collect_ids(&mut mine); let set: BTreeSet<&&str> = mine.iter().collect(); if set.len() != mine.len() { return Err(OpError::new("duplicate_id", "duplicate ids inside the new subtree")); }
        let skip: BTreeSet<String> = except.and_then(|e| self.root.find(e)).map(|n| { let mut v = Vec::new(); n.collect_ids(&mut v); v.into_iter().map(str::to_string).collect() }).unwrap_or_default();
        for i in mine { if !skip.contains(i) && self.root.find(i).is_some() { return Err(OpError::new("duplicate_id", format!("id {i} already exists"))); } }
        Ok(())
    }
    /// Apply ops in order; returns the inverses ready to apply in the returned order (already reversed). On error the tree is left as it was.
    pub fn apply_all(&mut self, ops: &[Op]) -> Result<Vec<Op>, (usize, OpError)> {
        let backup = self.clone(); let mut inv = Vec::with_capacity(ops.len());
        for (i, op) in ops.iter().enumerate() { match self.apply(op) { Ok(x) => inv.push(x), Err(e) => { *self = backup; return Err((i, e)); } } }
        inv.reverse(); Ok(inv)
    }
}

/// Validate (content rules) and dry-run a batch against a copy of the tree. Ok = the inverses (what one undo step runs); Err = index of the first bad op and why.
pub fn dry_run(tree: &Tree, ops: &[Op]) -> Result<Vec<Op>, (usize, OpError)> {
    if ops.is_empty() { return Err((0, OpError::new("empty", "no ops"))); }
    if ops.len() > MAX_OPS { return Err((0, OpError::new("too_many_ops", format!("at most {MAX_OPS} ops per call")))); }
    for (i, o) in ops.iter().enumerate() { validate_external(o).map_err(|e| (i, e))?; }
    tree.clone().apply_all(ops)
}

// ---------------------------------------------------------------- merge
fn scalar<T: Clone + PartialEq>(b: &Option<T>, l: &Option<T>, r: &Option<T>) -> Option<T> { if l == r { l.clone() } else if l == b { r.clone() } else if r == b { l.clone() } else { r.clone() } } // both changed differently: the later writer (right) wins
fn map3(b: &BTreeMap<String, String>, l: &BTreeMap<String, String>, r: &BTreeMap<String, String>) -> BTreeMap<String, String> {
    let keys: BTreeSet<&String> = b.keys().chain(l.keys()).chain(r.keys()).collect();
    keys.into_iter().filter_map(|k| scalar(&b.get(k).cloned(), &l.get(k).cloned(), &r.get(k).cloned()).map(|v| (k.clone(), v))).collect()
}
fn index(n: &Node, m: &mut HashMap<String, Node>) { m.insert(n.id.clone(), n.clone()); for c in &n.children { index(c, m); } }
fn child_ids(m: &HashMap<String, Node>, id: &str) -> Vec<String> { m.get(id).map(|n| n.children.iter().map(|c| c.id.clone()).collect()).unwrap_or_default() }

/// 3-way merge of two edited copies of `base`. Per property (style key, token, text, tag, html) a change on one side wins over no change; if both changed
/// differently the later writer (`right`) wins. A child deleted by either side is deleted (delete beats edit); children added by either side are kept; a child
/// list changed on one side only takes that side's order, if both changed the right order is the base and the left's additions are slotted in after their predecessor.
/// Deterministic; `merge(b, l, r) == merge(b, r, l)` whenever the sides do not touch the same property.
pub fn merge(base: &Tree, left: &Tree, right: &Tree) -> Result<Tree, OpError> {
    if base.root.id != left.root.id || base.root.id != right.root.id { return Err(OpError::new("root_mismatch", "trees have different roots")); }
    let (mut b, mut l, mut r) = (HashMap::new(), HashMap::new(), HashMap::new()); index(&base.root, &mut b); index(&left.root, &mut l); index(&right.root, &mut r);
    let mut placed = BTreeSet::new();
    let root = merge_node(&base.root.id, &b, &l, &r, &mut placed).ok_or_else(|| OpError::new("root_mismatch", "root vanished"))?;
    let (bt, lt, rt) = (&base.tokens, &left.tokens, &right.tokens);
    Ok(Tree { root, tokens: map3(bt, lt, rt) })
}
fn merge_node(id: &str, b: &HashMap<String, Node>, l: &HashMap<String, Node>, r: &HashMap<String, Node>, placed: &mut BTreeSet<String>) -> Option<Node> {
    let (nb, nl, nr) = (b.get(id), l.get(id), r.get(id));
    if nl.is_none() && nr.is_none() { return None; }
    // an absent node counts as "no value" per field, so a node added on one side is taken from that side
    let tag = scalar(&nb.map(|n| n.tag.clone()), &nl.map(|n| n.tag.clone()), &nr.map(|n| n.tag.clone())).unwrap_or_default();
    let text = scalar(&nb.map(|n| n.text.clone()), &nl.map(|n| n.text.clone()), &nr.map(|n| n.text.clone())).unwrap_or_default();
    let html = scalar(&nb.and_then(|n| n.html.clone()), &nl.and_then(|n| n.html.clone()), &nr.and_then(|n| n.html.clone()));
    let empty = BTreeMap::new();
    let style = map3(nb.map(|n| &n.style).unwrap_or(&empty), nl.map(|n| &n.style).unwrap_or(&empty), nr.map(|n| &n.style).unwrap_or(&empty));
    let (bc, lc, rc) = (child_ids(b, id), child_ids(l, id), child_ids(r, id));
    let bset: BTreeSet<&String> = bc.iter().collect(); let (lset, rset): (BTreeSet<&String>, BTreeSet<&String>) = (lc.iter().collect(), rc.iter().collect());
    let keep = |x: &String| (lset.contains(x) || rset.contains(x)) && !(bset.contains(x) && (!lset.contains(x) || !rset.contains(x)));
    let (primary, other) = if lc == bc { (&rc, &lc) } else if rc == bc { (&lc, &rc) } else { (&rc, &lc) };
    let mut order: Vec<String> = primary.iter().filter(|x| keep(x)).cloned().collect();
    for (i, x) in other.iter().enumerate() { if keep(x) && !order.contains(x) { let pos = other[..i].iter().rev().find_map(|p| order.iter().position(|o| o == p)).map(|p| p + 1).unwrap_or(0); order.insert(pos, x.clone()); } }
    let mut children = Vec::new();
    for c in order { if placed.insert(c.clone()) { if let Some(n) = merge_node(&c, b, l, r, placed) { children.push(n); } } }
    Some(Node { id: id.to_string(), tag, text, style, html, children })
}

// ---------------------------------------------------------------- tokens
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ResolveError { Unknown(String), Cycle(String), TooDeep }
impl std::fmt::Display for ResolveError { fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { match self { ResolveError::Unknown(n) => write!(f, "unknown token {n}"), ResolveError::Cycle(n) => write!(f, "token cycle at {n}"), ResolveError::TooDeep => write!(f, "tokens nested too deep") } } }
impl std::error::Error for ResolveError {}
/// Replace every `var(--name)` / `var(--name, fallback)` using `tokens` (recursively; cycles and runaway nesting are errors; the fallback is used for unknown names).
pub fn resolve(value: &str, tokens: &BTreeMap<String, String>) -> Result<String, ResolveError> { resolve_in(value, tokens, &mut Vec::new(), 0) }
fn resolve_in(value: &str, tokens: &BTreeMap<String, String>, stack: &mut Vec<String>, depth: usize) -> Result<String, ResolveError> {
    if depth > 16 { return Err(ResolveError::TooDeep); }
    let mut out = String::new(); let mut rest = value;
    while let Some(i) = rest.find("var(") {
        out.push_str(&rest[..i]); let body = &rest[i + 4..]; let mut d = 1; let mut end = None;
        for (k, ch) in body.char_indices() { match ch { '(' => d += 1, ')' => { d -= 1; if d == 0 { end = Some(k); break; } } _ => {} } }
        let Some(end) = end else { out.push_str(&rest[i..]); return Ok(out); };
        let inner = &body[..end]; let mut depth_p = 0; let mut split = None;
        for (k, ch) in inner.char_indices() { match ch { '(' => depth_p += 1, ')' => depth_p -= 1, ',' if depth_p == 0 => { split = Some(k); break; } _ => {} } }
        let (name, fallback) = match split { Some(k) => (inner[..k].trim(), Some(inner[k + 1..].trim())), None => (inner.trim(), None) };
        if stack.iter().any(|s| s == name) { return Err(ResolveError::Cycle(name.to_string())); }
        match tokens.get(name) {
            Some(v) => { stack.push(name.to_string()); let r = resolve_in(v, tokens, stack, depth + 1); stack.pop(); out.push_str(&r?); }
            None => match fallback { Some(f) => out.push_str(&resolve_in(f, tokens, stack, depth + 1)?), None => return Err(ResolveError::Unknown(name.to_string())) },
        }
        rest = &body[end + 1..];
    }
    out.push_str(rest); Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn n(id: &str, ch: Vec<Node>) -> Node { Node { id: id.into(), tag: "div".into(), children: ch, ..Node::default() } }
    fn t() -> Tree { Tree::new(n("root", vec![n("a", vec![n("a1", vec![])]), n("b", vec![])])) }
    #[test] fn html_rules_match_ts() {
        assert!(bad_html("<script>x</script>")); assert!(bad_html("< SCRIPT src=x>")); assert!(bad_html("<img onerror=alert(1)>")); assert!(bad_html("<a href='javascript:x'>")); assert!(bad_html("<b onclick = 'x'>"));
        assert!(!bad_html("<div>one two</div>")); assert!(!bad_html("<p>emotion = great</p>")); assert!(!bad_html("<p>the button</p>"));
    }
    #[test] fn set_remove_inverse_exact() {
        let mut tr = t(); let orig = tr.clone();
        let inv = tr.apply_all(&[Op::Set { id: "a".into(), prop: "color".into(), value: Some("red".into()) }, Op::Remove { id: "a".into() }, Op::Token { name: "--x".into(), value: Some("1".into()) }]).unwrap();
        assert_ne!(tr, orig); for i in &inv { tr.apply(i).unwrap(); } assert_eq!(tr, orig);
    }
    #[test] fn dry_run_rejects_with_index() {
        let e = dry_run(&t(), &[Op::Set { id: "a".into(), prop: "color".into(), value: Some("red".into()) }, Op::Set { id: "zz".into(), prop: "color".into(), value: Some("red".into()) }]).unwrap_err(); assert_eq!(e.0, 1); assert_eq!(e.1.code, "unknown_id");
        assert_eq!(dry_run(&t(), &[Op::Add { parent: "a".into(), id: "n1".into(), html: "<script>".into() }]).unwrap_err().1.code, "bad_html");
        assert_eq!(dry_run(&t(), &[Op::Set { id: "a".into(), prop: "font size".into(), value: Some("1".into()) }]).unwrap_err().1.code, "bad_property");
        assert_eq!(dry_run(&t(), &[Op::Remove { id: "root".into() }]).unwrap_err().1.code, "root_protected");
        assert_eq!(dry_run(&t(), &[Op::Replace { id: "a".into(), node: n("a", vec![]) }]).unwrap_err().1.code, "internal_op");
        assert!(dry_run(&t(), &[]).is_err());
    }
    #[test] fn failed_batch_leaves_tree() { let mut tr = t(); let o = tr.clone(); assert!(tr.apply_all(&[Op::Remove { id: "a".into() }, Op::Remove { id: "nope".into() }]).is_err()); assert_eq!(tr, o); }
    #[test] fn flat_tree() {
        let f = vec![FlatNode { id: "r".into(), parent: None, tag: "div".into(), text: "".into() }, FlatNode { id: "c".into(), parent: Some("r".into()), tag: "p".into(), text: "hi".into() }];
        let tr = Tree::from_flat(&f).unwrap(); assert_eq!(tr.count(), 2); assert!(Tree::from_flat(&[]).is_err());
    }
    #[test] fn merge_lww_and_disjoint() {
        let base = t(); let mut l = base.clone(); let mut r = base.clone();
        l.apply(&Op::Set { id: "a".into(), prop: "color".into(), value: Some("red".into()) }).unwrap(); l.apply(&Op::Set { id: "a".into(), prop: "top".into(), value: Some("1px".into()) }).unwrap();
        r.apply(&Op::Set { id: "a".into(), prop: "color".into(), value: Some("blue".into()) }).unwrap();
        let m = merge(&base, &l, &r).unwrap(); let a = m.root.find("a").unwrap(); assert_eq!(a.style["color"], "blue"); assert_eq!(a.style["top"], "1px"); // conflict: right wins; disjoint property kept
        let m2 = merge(&base, &r, &l).unwrap(); assert_eq!(m2.root.find("a").unwrap().style["color"], "red");
    }
    #[test] fn merge_structure() {
        let base = t(); let mut l = base.clone(); let mut r = base.clone();
        l.apply(&Op::Add { parent: "root".into(), id: "n1".into(), html: "<i>".into() }).unwrap(); l.apply(&Op::Remove { id: "b".into() }).unwrap();
        r.apply(&Op::Set { id: "b".into(), prop: "color".into(), value: Some("red".into()) }).unwrap(); r.apply(&Op::Add { parent: "root".into(), id: "n2".into(), html: "<i>".into() }).unwrap();
        let m = merge(&base, &l, &r).unwrap(); let ids = m.ids(); assert!(ids.contains("n1") && ids.contains("n2") && !ids.contains("b")); assert_eq!(m, merge(&base, &l, &r).unwrap());
    }
    #[test] fn tokens_resolve() {
        let mut m = BTreeMap::new(); m.insert("--a".to_string(), "var(--b)".to_string()); m.insert("--b".to_string(), "#fff".to_string()); m.insert("--c".to_string(), "var(--d)".to_string()); m.insert("--d".to_string(), "var(--c)".to_string());
        assert_eq!(resolve("1px solid var(--a)", &m).unwrap(), "1px solid #fff"); assert_eq!(resolve("var(--zz, var(--b))", &m).unwrap(), "#fff"); assert_eq!(resolve("var(--zz)", &m), Err(ResolveError::Unknown("--zz".into()))); assert!(matches!(resolve("var(--c)", &m), Err(ResolveError::Cycle(_))));
    }
}
