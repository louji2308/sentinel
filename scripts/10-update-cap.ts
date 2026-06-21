import Database from "better-sqlite3";

const db = new Database("data/sentinel.db");

const before = db.prepare("SELECT did, scope FROM agents WHERE did = ?").get("did:t3n:travel-agent-demo");
console.log("Before:", before);

db.prepare("UPDATE agents SET scope = ?, updated_at = ? WHERE did = ?").run(
  JSON.stringify(["spend:10000", "domain:flights,hotels,trains"]),
  Date.now(),
  "did:t3n:travel-agent-demo"
);

const after = db.prepare("SELECT did, scope FROM agents WHERE did = ?").get("did:t3n:travel-agent-demo");
console.log("After:", after);

db.close();
