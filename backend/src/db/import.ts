import { configuration } from "../config";
import { openDatabase } from "./schema";
import { importDataset } from "./importer";
const args = process.argv.slice(2),
  filename = args.shift();
const config = configuration();
if (!filename || filename.startsWith("--"))
  throw new Error(
    "Usage: import-data DATASET.json [--db DATABASE] [--data-root DIRECTORY]",
  );
while (args.length) {
  const option = args.shift(),
    value = args.shift();
  if (!value) throw new Error("Missing option value");
  if (option === "--db") config.dbPath = value;
  else if (option === "--data-root") config.dataRoot = value;
  else throw new Error("Unknown option: " + option);
}
const db = openDatabase(config.dbPath);
importDataset(db, filename, config.dataRoot)
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
