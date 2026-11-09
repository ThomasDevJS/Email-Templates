/** jsdom lacks layout. ProseMirror's scrollIntoView and coordinate code need these to exist. */
export function stubLayout(): void {
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
