import { Button } from "@astryxdesign/core/Button";
import { Dialog } from "@astryxdesign/core/Dialog";
import { useFocusTrap } from "@astryxdesign/core/hooks";
import { StrictMode, useId, useState } from "react";
import { createPortal } from "react-dom";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";

afterEach(cleanup);

function PasteConfirmationProbe() {
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  const descriptionId = useId();
  return (
    <>
      <Button label="Request paste" onClick={() => setOpen(true)} />
      <output aria-label="Paste applied">{String(applied)}</output>
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        purpose="form"
        role="alertdialog"
        aria-label="Confirm paste"
        aria-describedby={descriptionId}
      >
        <h2>Confirm paste</h2>
        <p id={descriptionId}>Confirm the proposed linear destination before applying values.</p>
        <Button label="Cancel" onClick={() => setOpen(false)} />
        <Button
          label="Paste vertically"
          onClick={() => {
            setApplied(true);
            setOpen(false);
          }}
        />
      </Dialog>
    </>
  );
}

test("published alert dialog focuses cancellation, preserves values and restores its opener", async () => {
  await render(<PasteConfirmationProbe />);
  const opener = page.getByRole("button", { name: "Request paste" });
  const dialog = page.getByRole("alertdialog", { name: "Confirm paste" });
  await opener.click();
  await expect.element(dialog).toBeVisible();
  await expect
    .element(dialog)
    .toHaveAccessibleDescription("Confirm the proposed linear destination before applying values.");
  await expect.element(dialog.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  await expect.poll(() => dialog.all()).toHaveLength(0);
  await expect.element(opener).toHaveFocus();
  await expect
    .element(page.getByRole("status", { name: "Paste applied" }))
    .toHaveTextContent("false");

  await opener.click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => dialog.all()).toHaveLength(0);
  await expect.element(opener).toHaveFocus();
  await expect
    .element(page.getByRole("status", { name: "Paste applied" }))
    .toHaveTextContent("false");

  await opener.click();
  await dialog.getByRole("button", { name: "Paste vertically" }).click();
  await expect.poll(() => dialog.all()).toHaveLength(0);
  await expect.element(opener).toHaveFocus();
  await expect
    .element(page.getByRole("status", { name: "Paste applied" }))
    .toHaveTextContent("true");
});

function ConflictSaveProbe() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <>
      <Button label="Review conflicts" onClick={() => setOpen(true)} />
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        purpose={saving ? "required" : "form"}
        role="alertdialog"
        aria-label="Conflict Review"
      >
        <Button label="Cancel" isDisabled={saving} onClick={() => setOpen(false)} />
        <Button label="Start save" isDisabled={saving} onClick={() => setSaving(true)} />
        <Button label="Complete save" isDisabled={!saving} onClick={() => setSaving(false)} />
      </Dialog>
    </>
  );
}

test("published review dialog contains StrictMode focus across forward and reverse Tab", async () => {
  await render(
    <StrictMode>
      <ConflictSaveProbe />
    </StrictMode>,
  );
  const opener = page.getByRole("button", { name: "Review conflicts" });
  const dialog = page.getByRole("alertdialog", { name: "Conflict Review" });
  await opener.click();
  await expect.element(dialog.getByRole("button", { name: "Cancel" })).toHaveFocus();
  const trace = [];
  for (const keys of ["{Tab}", "{Tab}", "{Shift>}{Tab}{/Shift}"]) {
    await userEvent.keyboard(keys);
    trace.push({
      keys,
      tag: document.activeElement?.tagName,
      text: document.activeElement?.textContent?.trim().slice(0, 80),
      contained: dialog.element().contains(document.activeElement),
      modal: dialog.element().matches(":modal"),
    });
  }
  expect(dialog.element().contains(document.activeElement), JSON.stringify(trace)).toBe(true);
});

test("published review dialog blocks Escape until save completes", async () => {
  await render(
    <StrictMode>
      <ConflictSaveProbe />
    </StrictMode>,
  );
  const opener = page.getByRole("button", { name: "Review conflicts" });
  const dialog = page.getByRole("alertdialog", { name: "Conflict Review" });
  await opener.click();
  await dialog.getByRole("button", { name: "Start save" }).click();
  await expect.element(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await userEvent.keyboard("{Escape}");
  await expect.element(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Complete save" }).click();
  await expect.element(dialog.getByRole("button", { name: "Cancel" })).toBeEnabled();
  await userEvent.keyboard("{Escape}");
  await expect.poll(() => dialog.all()).toHaveLength(0);
  await expect.element(opener).toHaveFocus();
});

test("published review dialog contains focus after the retained batched Tab sequence", async () => {
  await render(
    <StrictMode>
      <ConflictSaveProbe />
    </StrictMode>,
  );
  const dialog = page.getByRole("alertdialog", { name: "Conflict Review" });
  await page.getByRole("button", { name: "Review conflicts" }).click();
  await expect.element(dialog.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await userEvent.keyboard("{Tab}{Tab}{Shift>}{Tab}{/Shift}");
  expect(
    dialog.element().contains(document.activeElement),
    JSON.stringify({
      tag: document.activeElement?.tagName,
      modal: dialog.element().matches(":modal"),
    }),
  ).toBe(true);
});

function ExplicitContainmentProbe() {
  const [open, setOpen] = useState(false);
  // Dialog alone owns Escape; the published hook supplies explicit Tab containment.
  const { containerRef } = useFocusTrap<HTMLDialogElement>({ isActive: open });
  return (
    <>
      <Button label="Open contained review" onClick={() => setOpen(true)} />
      <Dialog
        ref={containerRef}
        isOpen={open}
        onOpenChange={setOpen}
        purpose="form"
        role="alertdialog"
        aria-label="Contained Review"
      >
        <Button label="Cancel" onClick={() => setOpen(false)} />
        <Button label="Review action" />
      </Dialog>
    </>
  );
}

test("published focus hook contains the native dialog's batched Tab sequence", async () => {
  await render(
    <StrictMode>
      <ExplicitContainmentProbe />
    </StrictMode>,
  );
  const opener = page.getByRole("button", { name: "Open contained review" });
  const dialog = page.getByRole("alertdialog", { name: "Contained Review" });
  await opener.click();
  await expect.element(dialog.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await userEvent.keyboard("{Tab}{Tab}{Shift>}{Tab}{/Shift}");
  expect(dialog.element().contains(document.activeElement)).toBe(true);
  await userEvent.keyboard("{Escape}");
  await expect.poll(() => dialog.all()).toHaveLength(0);
  await expect.element(opener).toHaveFocus();
});

test("published dialog and focus hook retain containment in the owning secondary document", async () => {
  const frame = document.createElement("iframe");
  frame.title = "Secondary review document";
  document.body.append(frame);
  try {
    const owner = frame.contentDocument;
    if (owner === null) throw new Error("Expected a same-origin review document");
    await render(createPortal(<ExplicitContainmentProbe />, owner.body));
    const opener = owner.querySelector<HTMLButtonElement>("button");
    if (opener === null) throw new Error("Expected the secondary-document opener");
    opener.focus();
    opener.click();
    const dialog = owner.querySelector<HTMLDialogElement>("dialog");
    if (dialog === null) throw new Error("Expected the secondary-document dialog");
    await expect.poll(() => dialog.open).toBe(true);
    await expect.poll(() => dialog.contains(owner.activeElement)).toBe(true);
    const tabTargets: boolean[] = [];
    const recordTab = (event: KeyboardEvent) => {
      if (event.key === "Tab") tabTargets.push(dialog.contains(event.target as Node));
    };
    owner.addEventListener("keydown", recordTab, true);
    try {
      await userEvent.keyboard("{Tab}{Tab}{Shift>}{Tab}{/Shift}");
    } finally {
      owner.removeEventListener("keydown", recordTab, true);
    }
    expect(tabTargets, "Every Tab must reach a control in the owning dialog").toEqual([
      true,
      true,
      true,
    ]);
    expect(
      dialog.contains(owner.activeElement),
      JSON.stringify({
        activeTag: owner.activeElement?.tagName,
        parentActiveTag: document.activeElement?.tagName,
        modal: dialog.matches(":modal"),
      }),
    ).toBe(true);
  } finally {
    await cleanup();
    frame.remove();
  }
});
