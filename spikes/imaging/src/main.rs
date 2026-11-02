use image::{imageops::FilterType, ImageReader};
use std::time::Instant;
fn run() -> (u128, u128) {
    let t0 = Instant::now();
    let img = ImageReader::open("test8k.jpg").unwrap().decode().unwrap().to_rgb8();
    let decode = t0.elapsed().as_millis();
    for (i, w) in [1920u32, 960, 480].iter().enumerate() {
        let h = img.height() * w / img.width();
        let small = image::imageops::resize(&img, *w, h, FilterType::Triangle);
        small.save(format!("out/rust-{w}.jpg")).unwrap();
        if i == 0 { let _ = decode; }
    }
    (decode, t0.elapsed().as_millis())
}
fn main() { std::fs::create_dir_all("out").unwrap(); run(); for _ in 0..3 { let (d, t) = run(); println!("rust decodeMs {d} pyramidTotalMs {t}"); } }
