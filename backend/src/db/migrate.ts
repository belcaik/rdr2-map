import { configuration } from "../config";
import { migrateDatabase } from "./schema";
const args = process.argv.slice(2);
const index = args.indexOf("--db");
if (
  args.some((arg, i) => arg.startsWith("--") && arg !== "--db") ||
  (index >= 0 && !args[index + 1])
)
  throw new Error("Usage: migrate --db DATABASE");
migrateDatabase(index >= 0 ? args[index + 1] : configuration().dbPath)
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
