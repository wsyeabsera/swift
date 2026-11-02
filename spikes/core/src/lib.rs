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
