// Real Chrome against a tiny local server: JS-rendered content must appear, the stylesheet must be inlined, scripts gone. Ignored by default (needs Chrome): cargo test --test capture -- --ignored
#[test] #[ignore] fn captures_a_js_rendered_page_with_its_css() {
    let port = std::env::var("CAPTURE_PORT").expect("CAPTURE_PORT: a local server serving index.html + s.css");
    let html = helper::capture::capture(&format!("http://localhost:{port}/index.html"), (1280, 800)).unwrap();
    assert!(html.contains("Rendered by JS") && html.contains("Hello radar"), "{html}"); assert!(html.contains("rgb(1,2,3)"), "{html}"); assert!(!html.to_lowercase().contains("<script"), "{html}");
}
