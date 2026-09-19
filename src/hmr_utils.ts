
export function onHmrDispose(dispose: () => void | Promise<void>) {
  import.meta.hot?.dispose(dispose);
}
