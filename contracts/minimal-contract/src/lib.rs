wit_bindgen::generate!({
    world: "minimal-test",
    path: "wit",
    generate_all,
});

use exports::z::minimal_test::contracts::Guest;

struct Component;

impl Guest for Component {
    fn ping() -> String {
        "pong".to_string()
    }
}

export!(Component);
