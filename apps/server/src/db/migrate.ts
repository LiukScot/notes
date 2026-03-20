import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "./index.js";

migrate(db, { migrationsFolder: "./src/db/migrations" });
console.log("Migrations complete.");
