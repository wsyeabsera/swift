//! The generated TS types and JSON Schema in app/src/generated must match the Rust types.
#[test] fn generated_files_are_current() {
    let st = std::process::Command::new(env!("CARGO")).args(["run", "-q", "-p", "swift-canvas-core", "--example", "gen", "--", "--check"]).status().unwrap();
    assert!(st.success(), "app/src/generated is stale: run `cargo run -p swift-canvas-core --example gen`");
}
