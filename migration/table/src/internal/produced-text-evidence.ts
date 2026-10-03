export function armAstryxTableProducedTextCapture(
  grid: HTMLElement,
  capture: HTMLElement | null,
): void {
  if (capture === null || grid.ownerDocument.activeElement !== grid) return;
  capture.textContent = "";
  const selection = grid.ownerDocument.getSelection();
  if (selection === null) return;
  const range = grid.ownerDocument.createRange();
  range.selectNodeContents(capture);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function clearAstryxTableProducedTextCapture(
  grid: HTMLElement,
  capture: HTMLElement | null,
): void {
  if (capture === null) return;
  capture.textContent = "";
  armAstryxTableProducedTextCapture(grid, capture);
}

export function installAstryxTableProducedTextEvidence(
  grid: HTMLElement,
  capture: HTMLElement | null,
  onProducedText: (text: string) => void,
): () => void {
  const ownsCaptureEvent = (target: EventTarget | null) => target === grid || target === capture;
  const handleCompositionStart = (event: CompositionEvent) => {
    if (!ownsCaptureEvent(event.target)) return;
    armAstryxTableProducedTextCapture(grid, capture);
  };
  const handleBeforeInput = (event: InputEvent) => {
    if (event.defaultPrevented || !ownsCaptureEvent(event.target)) return;
    if (event.isComposing || event.inputType === "insertCompositionText") return;
    if (event.inputType === "insertText" || event.inputType === "insertReplacementText") {
      const text =
        typeof event.data === "string" ? event.data : event.dataTransfer?.getData("text/plain");
      if (text !== undefined && text.length > 0) onProducedText(text);
      event.preventDefault();
      clearAstryxTableProducedTextCapture(grid, capture);
      return;
    }
    event.preventDefault();
    clearAstryxTableProducedTextCapture(grid, capture);
  };
  const handleCompositionEnd = (event: CompositionEvent) => {
    if (!ownsCaptureEvent(event.target)) return;
    onProducedText(event.data);
    event.preventDefault();
    clearAstryxTableProducedTextCapture(grid, capture);
  };
  grid.addEventListener("compositionstart", handleCompositionStart);
  grid.addEventListener("beforeinput", handleBeforeInput);
  grid.addEventListener("compositionend", handleCompositionEnd);
  return () => {
    grid.removeEventListener("compositionstart", handleCompositionStart);
    grid.removeEventListener("beforeinput", handleBeforeInput);
    grid.removeEventListener("compositionend", handleCompositionEnd);
  };
}
