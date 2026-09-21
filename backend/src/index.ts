import { createApp } from "./app";
import { getDb, closeDb } from "./db";
import { configuration } from "./config";
const config = configuration();
const server = createApp(getDb(), config.dataRoot, config.tilesRoot, config.staticRoot).listen(
  config.port,
  config.host,
  () => console.log(`RDR2 Map API listening on http://${config.host}:${config.port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      closeDb();
      process.exit(0);
    }),
  );
