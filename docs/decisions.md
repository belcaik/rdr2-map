# Decisions

- **Keep numerical IDs.** Source and legacy use positive integer identities. No
  title matching or map-dependent progress key is introduced.
- **Additive migration, explicit invocation.** Version-zero SQLite contains data.
  Back up through SQLite, compare all legacy values and migrate transactionally.
- **Merge without deactivation.** Public endpoint coverage omits premium points.
  Neither complete nor partial imports remove absent metadata or progress in v1.
- **Content-addressed local media.** Crop category symbols from the verified RDR2
  sprite. Preserve JPEG/WebP/PNG photos. Keep relationships/captions separate from
  file deduplication. Do not invent thumbnails without a measured need.
- **Preserve projection and rendering intent.** Current user changes already use
  EPSG3857 identity and viewport canvas rendering. Keep that alignment, local zoom
  2–6 and cached symbol rendering; do not transfer GTA calibration or all-DOM points.
- **RDR2 visual identity.** Existing fullscreen map remains primary. Restrained
  leather/brown detail surfaces, warm readable text and one found-state green
  support source symbols and photography. Modal shading isolates enlarged photos;
  no unrelated decorative UI or product redesign is added.
- **One contract and instruction source.** Dataset schema plus generated types;
  AGENTS.md plus minimal Claude import. No multigame layer or AI runtime is added.
