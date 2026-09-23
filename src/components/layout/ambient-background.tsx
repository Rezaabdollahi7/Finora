/**
 * The moving light behind every screen (docs/DESIGN_SYSTEM.md §0.8).
 *
 * A server component with no JavaScript at all: the drift is CSS keyframes
 * on transform, so it runs on the compositor and costs the main thread
 * nothing. Fixed and pointer-transparent, below everything else.
 */
function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden"
    >
      <div className="ambient-blob ambient-blob-1" />
      <div className="ambient-blob ambient-blob-2" />
      <div className="ambient-blob ambient-blob-3" />
      <div className="ambient-blob ambient-blob-4" />
      <div className="ambient-grain" />
    </div>
  );
}

export { AmbientBackground };
