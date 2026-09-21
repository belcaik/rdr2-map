import { createApp } from "./app";
import { getDb, closeDb } from "./db";
import { configuration } from "./config";
const config = configuration();
const port = Number(process.env.PORT || 3001);
const server = createApp(getDb(), config.dataRoot, config.tilesRoot).listen(
  port,
  "127.0.0.1",
  () => console.log(`RDR2 Map API listening on http://127.0.0.1:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      closeDb();
      process.exit(0);
    }),
  );
