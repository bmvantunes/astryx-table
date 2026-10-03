import { StrictMode, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Dialog } from "@astryxdesign/core/Dialog";
import { Popover } from "@astryxdesign/core/Popover";
import { TextInput } from "@astryxdesign/core/TextInput";
import { ToastViewport, useToast } from "@astryxdesign/core/Toast";
import { useFocusTrap } from "@astryxdesign/core/hooks";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";
afterEach(cleanup);

function ToastCases({
  action,
}: {
  action: (show: ReturnType<typeof useToast>, hidden: (reason: string) => void) => void;
}) {
  const show = useToast();
  const [reasons, setReasons] = useState<string[]>([]);
  return (
    <>
      <Button
        label="Run toast case"
        onClick={() => action(show, (reason) => setReasons((prev) => [...prev, reason]))}
      />
      <output aria-label="Hidden reasons">{reasons.join(",")}</output>
    </>
  );
}
for (const strict of [false, true]) {
  test(`immediate toast cancellation calls onHide once; strict=${strict}`, async () => {
    const view = (
      <ToastViewport>
        <ToastCases
          action={(show, hidden) => {
            const dismiss = show({
              body: "Cancelled operation",
              isAutoHide: false,
              onHide: hidden,
            });
            dismiss();
            dismiss();
          }}
        />
      </ToastViewport>
    );
    await render(strict ? <StrictMode>{view}</StrictMode> : view);
    await page.getByRole("button", { name: "Run toast case" }).click();
    await expect
      .element(page.getByText("Cancelled operation", { exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole("status", { name: "Hidden reasons" }))
      .toHaveTextContent(/^manual$/);
  });
}
test("queued toast cancellation cannot revive when visible toast leaves", async () => {
  let closeFirst: () => void = () => {};
  await render(
    <ToastViewport maxVisible={1}>
      <ToastCases
        action={(show, hidden) => {
          closeFirst = show({ body: "First operation", isAutoHide: false });
          const close = show({
            body: "Cancelled queued operation",
            isAutoHide: false,
            onHide: hidden,
          });
          close();
          close();
        }}
      />
      <Button label="Close first" onClick={() => closeFirst()} />
    </ToastViewport>,
  );
  await page.getByRole("button", { name: "Run toast case" }).click();
  await expect.element(page.getByText("First operation", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close first" }).click();
  await expect.element(page.getByText("First operation", { exact: true })).not.toBeInTheDocument();
  await expect
    .element(page.getByText("Cancelled queued operation", { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole("status", { name: "Hidden reasons" }))
    .toHaveTextContent(/^manual$/);
});
test("same-turn ignore and overwrite retain the right toast and ignore stale dismissals", async () => {
  await render(
    <ToastViewport>
      <ToastCases
        action={(show, hidden) => {
          const old = show({
            body: "Original",
            uniqueID: "save",
            isAutoHide: false,
          });
          const ignored = show({
            body: "Ignored",
            uniqueID: "save",
            collisionBehavior: "ignore",
            isAutoHide: false,
            onHide: hidden,
          });
          ignored();
          show({ body: "Replacement", uniqueID: "save", isAutoHide: false });
          old();
        }}
      />
    </ToastViewport>,
  );
  await page.getByRole("button", { name: "Run toast case" }).click();
  await expect.element(page.getByText("Replacement", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Original", { exact: true })).not.toBeInTheDocument();
  await expect.element(page.getByText("Ignored", { exact: true })).not.toBeInTheDocument();
  await expect.element(page.getByRole("status", { name: "Hidden reasons" })).toBeEmptyDOMElement();
});
test("onHide can synchronously publish a replacement without the old dismissal removing it", async () => {
  await render(
    <ToastViewport>
      <ToastCases
        action={(show, hidden) => {
          const close = show({
            body: "Old operation",
            uniqueID: "save",
            isAutoHide: false,
            onHide: (reason) => {
              hidden(reason);
              show({
                body: "Retry operation",
                uniqueID: "save",
                isAutoHide: false,
              });
            },
          });
          close();
          close();
        }}
      />
    </ToastViewport>,
  );
  await page.getByRole("button", { name: "Run toast case" }).click();
  await expect.element(page.getByText("Retry operation", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Old operation", { exact: true })).not.toBeInTheDocument();
  await expect
    .element(page.getByRole("status", { name: "Hidden reasons" }))
    .toHaveTextContent(/^manual$/);
});
test("fallback startup cancellation calls onHide once without leaving a toast", async () => {
  await render(
    <ToastCases
      action={(show, hidden) => {
        const close = show({
          body: "Fallback cancelled",
          isAutoHide: false,
          onHide: hidden,
        });
        close();
        close();
      }}
    />,
  );
  await page.getByRole("button", { name: "Run toast case" }).click();
  await expect
    .element(page.getByRole("status", { name: "Hidden reasons" }))
    .toHaveTextContent(/^manual$/);
  await expect
    .element(page.getByText("Fallback cancelled", { exact: true }))
    .not.toBeInTheDocument();
});
function InputProbe() {
  const [value, setValue] = useState("");
  return (
    <TextInput
      label="Exact search"
      type="search"
      inputMode="decimal"
      maxLength={32}
      value={value}
      onChange={setValue}
      hasClear
    />
  );
}
test("native search semantics, length enforcement and exact string values", async () => {
  await render(<InputProbe />);
  const input = page.getByRole("searchbox", { name: "Exact search" });
  await expect.element(input).toHaveAttribute("inputmode", "decimal");
  await input.click();
  await userEvent.keyboard("9007199254740993.012345678901234567890");
  await expect.element(input).toHaveValue("9007199254740993.012345678901234");
});
function NestedDialogs() {
  const [outer, setOuter] = useState(false);
  const [inner, setInner] = useState(false);
  return (
    <>
      <Button label="Open outer" onClick={() => setOuter(true)} />
      <Dialog isOpen={outer} onOpenChange={setOuter} aria-label="Outer">
        <Button label="Outer start" />
        <Button label="Open inner" onClick={() => setInner(true)} />
        <Button label="Outer end" />
        <Dialog isOpen={inner} onOpenChange={setInner} aria-label="Inner">
          <Button label="Inner start" />
          <Button label="Inner end" />
        </Dialog>
      </Dialog>
    </>
  );
}
test("nested dialogs wrap inside topmost dialog and restore outer navigation", async () => {
  await render(<NestedDialogs />);
  await page.getByRole("button", { name: "Open outer", exact: true }).click();
  await page.getByRole("button", { name: "Open inner", exact: true }).click();
  const start = page.getByRole("button", { name: "Inner start", exact: true });
  const end = page.getByRole("button", { name: "Inner end", exact: true });
  await expect.element(start).toHaveFocus();
  await userEvent.tab({ shift: true });
  await expect.element(end).toHaveFocus();
  await userEvent.tab();
  await expect.element(start).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  await expect.element(page.getByRole("button", { name: "Open inner", exact: true })).toHaveFocus();
  page.getByRole("button", { name: "Outer end", exact: true }).element().focus();
  await userEvent.tab();
  await expect
    .element(page.getByRole("button", { name: "Outer start", exact: true }))
    .toHaveFocus();
});
function DoubleTrap() {
  const [open, setOpen] = useState(false);
  const { containerRef } = useFocusTrap<HTMLDialogElement>({ isActive: open });
  return (
    <>
      <Button label="Open explicit trap" onClick={() => setOpen(true)} />
      <Dialog ref={containerRef} isOpen={open} onOpenChange={setOpen} aria-label="Explicit">
        <Button label="Explicit start" />
        <Button label="Explicit end" />
      </Dialog>
    </>
  );
}
test("composing the published focus hook with Dialog does not handle Tab twice", async () => {
  await render(<DoubleTrap />);
  await page.getByRole("button", { name: "Open explicit trap" }).click();
  await userEvent.tab({ shift: true });
  await expect.element(page.getByRole("button", { name: "Explicit end" })).toHaveFocus();
  await userEvent.tab();
  await expect.element(page.getByRole("button", { name: "Explicit start" })).toHaveFocus();
});

test("a committed toast hidden by maxVisible cannot revive after cancellation", async () => {
  let oldDismiss: () => void = () => {};
  let recentDismiss: () => void = () => {};
  function Probe() {
    const show = useToast();
    const [hidden, setHidden] = useState(0);
    return (
      <>
        <Button
          label="Show old"
          onClick={() => {
            oldDismiss = show({
              body: "Old clipped toast",
              isAutoHide: false,
              onHide: () => setHidden((n) => n + 1),
            });
          }}
        />
        <Button
          label="Show recent"
          onClick={() => {
            recentDismiss = show({
              body: "Recent visible toast",
              isAutoHide: false,
            });
          }}
        />
        <Button
          label="Cancel clipped"
          onClick={() => {
            oldDismiss();
            oldDismiss();
          }}
        />
        <Button label="Cancel recent" onClick={() => recentDismiss()} />
        <output aria-label="Clipped dismissal count">{hidden}</output>
      </>
    );
  }
  await render(
    <ToastViewport maxVisible={1}>
      <Probe />
    </ToastViewport>,
  );
  await page.getByRole("button", { name: "Show old" }).click();
  await expect.element(page.getByText("Old clipped toast", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show recent" }).click();
  await expect.element(page.getByText("Recent visible toast", { exact: true })).toBeVisible();
  await expect
    .element(page.getByText("Old clipped toast", { exact: true }))
    .not.toBeInTheDocument();
  await page.getByRole("button", { name: "Cancel clipped" }).click();
  await page.getByRole("button", { name: "Cancel recent" }).click();
  await expect
    .element(page.getByText("Recent visible toast", { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByText("Old clipped toast", { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole("status", { name: "Clipped dismissal count" }))
    .toHaveTextContent(/^1$/);
});

function NestedPopoverProbe() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button label="Open host dialog" onClick={() => setOpen(true)} />
      <Dialog isOpen={open} onOpenChange={setOpen} aria-label="Popover host" purpose="form">
        <Button label="Outer first" />
        <Popover
          label="Inner controls"
          hasCloseButton={false}
          content={
            <>
              <Button label="Inner first" />
              <Button label="Inner last" />
            </>
          }
        >
          <Button label="Open inner popover" />
        </Popover>
      </Dialog>
    </>
  );
}

test("a nested popover owns forward/reverse Tab and closes before its host dialog", async () => {
  await render(<NestedPopoverProbe />);
  const opener = page.getByRole("button", { name: "Open host dialog" });
  const host = page.getByRole("dialog", { name: "Popover host" });
  const trigger = page.getByRole("button", { name: "Open inner popover" });
  const first = page.getByRole("button", { name: "Inner first" });
  const last = page.getByRole("button", { name: "Inner last" });
  await opener.click();
  await trigger.click();
  await last.click();
  await userEvent.tab();
  await expect.element(first).toHaveFocus();
  await userEvent.tab({ shift: true });
  await expect.element(last).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  await expect.element(last).not.toBeInTheDocument();
  await expect.element(host).toBeVisible();
  await expect.element(trigger).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  await expect.element(host).not.toBeInTheDocument();
  await expect.element(opener).toHaveFocus();
});
