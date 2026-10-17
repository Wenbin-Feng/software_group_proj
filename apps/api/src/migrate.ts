import { openDatabase } from "./core/db.js";
const { db } = openDatabase(process.env.DATA_DIR || "./data");
console.log("Database migrations applied successfully.");
db.close();
