/**
 * The one bundle entry (ADR-0005). Every export becomes a top-level Apps Script function through the
 * stubs scripts/build.mjs appends. Exports are the only callable functions; everything else stays inside the IIFE.
 */
export {
  onBack,
  onComposeOpen,
  onHomepage,
  onInsert,
  onOpenFolder,
  onOpenLibrary,
  onOpenLink,
  onPreview,
  onPromptInsert,
  onRefresh,
  onSpikeCard,
  onSpikeInsert,
} from "./addon/entry";
export {
  daily,
  doGet,
  doPost,
  refreshMembers,
  rpc,
  setup,
  tick,
} from "./server/entry";
