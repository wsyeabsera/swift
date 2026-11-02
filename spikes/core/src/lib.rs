// Spike #1708: re-theme N nodes: each node has a token id; map token ids to colours of another project's brand. Pure arrays, no bindgen.
pub fn retheme(tokens: &[u32], map: &[u32], out: &mut [u32]) {
    for (i, t) in tokens.iter().enumerate() { out[i] = map[*t as usize]; }
}
#[no_mangle] pub extern "C" fn alloc(n: usize) -> *mut u32 { let mut v = Vec::<u32>::with_capacity(n); let p = v.as_mut_ptr(); std::mem::forget(v); p }
#[no_mangle] pub unsafe extern "C" fn retheme_raw(tokens: *const u32, n: usize, map: *const u32, m: usize, out: *mut u32) {
    retheme(std::slice::from_raw_parts(tokens, n), std::slice::from_raw_parts(map, m), std::slice::from_raw_parts_mut(out, n));
}
#[cfg(test)] mod tests {
    use super::*;
    #[test] fn maps_tokens() { let mut o = [0u32; 3]; retheme(&[0, 1, 1], &[10, 20], &mut o); assert_eq!(o, [10, 20, 20]); }
    #[test] fn empty_ok() { let mut o: [u32; 0] = []; retheme(&[], &[1], &mut o); }
}

// ---- heavier ops: hit-testing and property diff over N nodes (struct-of-arrays) ----
// rects: 4 f32 per node (x, y, w, h). Returns the LAST node containing (px,py) (top-most), or -1.
pub fn hit(rects: &[f32], px: f32, py: f32) -> i32 {
    let mut found = -1i32;
    for (i, r) in rects.chunks_exact(4).enumerate() { if px >= r[0] && px < r[0] + r[2] && py >= r[1] && py < r[1] + r[3] { found = i as i32; } }
    found
}
// count nodes intersecting the viewport (culling)
pub fn visible(rects: &[f32], vx: f32, vy: f32, vw: f32, vh: f32) -> u32 {
    rects.chunks_exact(4).filter(|r| r[0] < vx + vw && r[0] + r[2] > vx && r[1] < vy + vh && r[1] + r[3] > vy).count() as u32
}
// 4 u32 props per node; count changed props between a and b
pub fn diff(a: &[u32], b: &[u32]) -> u32 { a.iter().zip(b).filter(|(x, y)| x != y).count() as u32 }
#[no_mangle] pub unsafe extern "C" fn hit_raw(r: *const f32, n: usize, px: f32, py: f32) -> i32 { hit(std::slice::from_raw_parts(r, n * 4), px, py) }
#[no_mangle] pub unsafe extern "C" fn visible_raw(r: *const f32, n: usize, vx: f32, vy: f32, vw: f32, vh: f32) -> u32 { visible(std::slice::from_raw_parts(r, n * 4), vx, vy, vw, vh) }
#[no_mangle] pub unsafe extern "C" fn diff_raw(a: *const u32, b: *const u32, n: usize) -> u32 { diff(std::slice::from_raw_parts(a, n * 4), std::slice::from_raw_parts(b, n * 4)) }
#[no_mangle] pub extern "C" fn alloc_f32(n: usize) -> *mut f32 { let mut v = Vec::<f32>::with_capacity(n); let p = v.as_mut_ptr(); std::mem::forget(v); p }
