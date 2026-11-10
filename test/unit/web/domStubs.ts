/** `change` listeners of the stubbed `matchMedia`; a test calls them to act as a window resize. */
export const mediaListeners: ((event: { matches: boolean }) => void)[] = [];

/**
 * jsdom lacks layout. ProseMirror's scrollIntoView and coordinate code need these to exist, and the shell's
 * `matchMedia`.
 */
export function stubLayout(): void {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: (
        _type: string,
        listener: (event: { matches: boolean }) => void,
      ) => {
        mediaListeners.push(listener);
      },
    }) as unknown as MediaQueryList;
  const rect = (): DOMRect => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  });
  const rects = (): DOMRectList => {
    const list: DOMRect[] = [];
    return Object.assign(list, { item: () => null });
  };
  Range.prototype.getBoundingClientRect = rect;
  Range.prototype.getClientRects = rects;
  Element.prototype.scrollIntoView = () => undefined;
  document.elementFromPoint = () => null;
}
