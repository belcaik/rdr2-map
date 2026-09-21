import type Database from "better-sqlite3";
import { configuration } from "../config";
import { openDatabase } from "./schema";
let db: Database.Database | null = null;
export function getDb(): Database.Database {
  return (db ||= openDatabase(configuration().dbPath));
}
export function closeDb() {
  db?.close();
  db = null;
}
