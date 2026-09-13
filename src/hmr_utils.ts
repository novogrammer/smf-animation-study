
export function onHmrDispose(dispose: () => void) {
  import.meta.hot?.dispose(dispose);
}