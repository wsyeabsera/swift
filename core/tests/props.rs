//! Property tests: any op sequence followed by its inverses restores the tree exactly; merge is deterministic, idempotent and commutes for disjoint edits.
use proptest::prelude::*;
use std::collections::BTreeMap;
use swift_canvas_core::*;

fn base() -> Tree {
    let n = |id: &str, ch: Vec<Node>| Node { id: id.into(), tag: "div".into(), text: format!("t-{id}"), children: ch, ..Node::default() };
    Tree::new(n("root", vec![n("a", vec![n("a1", vec![]), n("a2", vec![])]), n("b", vec![n("b1", vec![])]), n("c", vec![])]))
}
/// A raw op description resolved against the tree it will run on (so ids are mostly valid and the sequence is meaningful).
#[derive(Clone, Debug)]
struct Raw { kind: u8, a: usize, b: usize, prop: u8, val: u8 }
fn raw() -> impl Strategy<Value = Raw> { (0u8..8, 0usize..64, 0usize..64, 0u8..4, 0u8..5).prop_map(|(kind, a, b, prop, val)| Raw { kind, a, b, prop, val }) }
fn resolve(t: &Tree, r: &Raw, fresh: usize, only: &str) -> Op {
    let ids: Vec<String> = t.ids().into_iter().collect(); let pick = |i: usize| ids[i % ids.len()].clone();
    let prop = format!("{only}p{}", r.prop); let value = if r.val == 0 { None } else { Some(format!("v{}", r.val)) };
    match r.kind {
        0 | 1 => Op::Set { id: pick(r.a), prop, value },
        2 => Op::Text { id: pick(r.a), value: format!("x{}", r.val) },
        3 => Op::Token { name: format!("--t{}", r.prop), value },
        4 => Op::Add { parent: pick(r.a), id: format!("n{fresh}"), html: "<i>x</i>".into() },
        5 => Op::Remove { id: pick(r.b) }, // may hit the root: then it is rejected, which the runner skips
        6 => { let id = pick(r.b); let node = t.root.find(&id).cloned().unwrap(); Op::Replace { id, node: Node { text: "replaced".into(), ..node } } }
        _ => Op::Insert { parent: pick(r.a), index: r.b % 3, node: Node { id: format!("i{fresh}"), tag: "p".into(), ..Node::default() } },
    }
}
fn run(t: &mut Tree, raws: &[Raw], only: &str) -> Vec<Op> {
    let mut inv = Vec::new();
    for (i, r) in raws.iter().enumerate() { let op = resolve(t, r, i, only); if let Ok(x) = t.apply(&op) { inv.push(x); } }
    inv.reverse(); inv
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(400))]
    #[test] fn ops_then_inverses_restore_exactly(raws in proptest::collection::vec(raw(), 0..40)) {
        let mut t = base(); let orig = t.clone(); let inv = run(&mut t, &raws, "");
        for i in &inv { t.apply(i).unwrap(); }
        prop_assert_eq!(t, orig);
    }
    #[test] fn inverse_of_inverse_is_original_op(raws in proptest::collection::vec(raw(), 1..20)) {
        // redo = invert the inverses: applying inverses then their inverses lands where the ops did
        let mut t = base(); let inv = run(&mut t, &raws, ""); let after = t.clone();
        let mut redo = Vec::new(); for i in &inv { redo.push(t.apply(i).unwrap()); } redo.reverse();
        for o in &redo { t.apply(o).unwrap(); } prop_assert_eq!(t, after);
    }
    #[test] fn batch_is_atomic(raws in proptest::collection::vec(raw(), 0..20)) {
        let t = base(); let mut ops = Vec::new(); let mut sim = t.clone(); for (i, r) in raws.iter().enumerate() { let op = resolve(&sim, r, i, ""); if sim.apply(&op).is_ok() { ops.push(op); } }
        ops.push(Op::Remove { id: "does-not-exist".into() }); let mut t2 = t.clone();
        prop_assert!(t2.apply_all(&ops).is_err()); prop_assert_eq!(t2, t);
    }
    #[test] fn merge_deterministic_idempotent_and_commutes_when_disjoint(l_raw in proptest::collection::vec(raw(), 0..15), r_sets in proptest::collection::vec((0usize..64, 0u8..4, 1u8..5), 0..15)) {
        let b = base(); let mut l = b.clone(); run_left(&mut l, &l_raw);
        let mut r = b.clone(); for (a, p, v) in &r_sets { let ids: Vec<String> = r.ids().into_iter().collect(); let _ = r.apply(&Op::Set { id: ids[a % ids.len()].clone(), prop: format!("rp{p}"), value: Some(format!("r{v}")) }); }
        let m1 = merge(&b, &l, &r).unwrap(); let m2 = merge(&b, &l, &r).unwrap(); let m3 = merge(&b, &r, &l).unwrap();
        prop_assert_eq!(&m1, &m2); prop_assert_eq!(&m1, &m3);
        prop_assert_eq!(merge(&b, &l, &l).unwrap(), l.clone()); prop_assert_eq!(merge(&b, &b, &r).unwrap(), r.clone()); prop_assert_eq!(merge(&b, &l, &b).unwrap(), l);
    }
}
/// The left side may do anything except use the property names the right side writes (`rp*`) and may not reuse right-side-only ids.
fn run_left(t: &mut Tree, raws: &[Raw]) { for (i, r) in raws.iter().enumerate() { if r.kind == 6 || r.kind == 7 { continue; } let op = resolve(t, r, i, "l"); let _ = t.apply(&op); } }

#[test] fn tokens_are_per_key_lww() {
    let b = base(); let mut l = b.clone(); let mut r = b.clone();
    l.apply(&Op::Token { name: "--ac".into(), value: Some("red".into()) }).unwrap(); r.apply(&Op::Token { name: "--ac".into(), value: Some("blue".into()) }).unwrap(); r.apply(&Op::Token { name: "--bg".into(), value: Some("black".into()) }).unwrap();
    let m = merge(&b, &l, &r).unwrap(); let want: BTreeMap<String, String> = [("--ac", "blue"), ("--bg", "black")].into_iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(); assert_eq!(m.tokens, want);
}
