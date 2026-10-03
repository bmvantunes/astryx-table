import { Button } from "@astryxdesign/core/Button";
import { ToastViewport, useToast, type ToastDismissFn } from "@astryxdesign/core/Toast";
import { useRef, useState } from "react";
import { afterEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";

function ToastProbe() {
  const showToast = useToast();
  const dismiss = useRef<ToastDismissFn | undefined>(undefined);
  const [completed, setCompleted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  return (
    <>
      <Button
        label="Report failure"
        onClick={() => {
          dismiss.current = showToast({ body: "Save failed", type: "error", isAutoHide: false });
        }}
      />
      <Button label="Reconcile failure" onClick={() => dismiss.current?.()} />
      <Button
        label="Report fill rejection"
        onClick={() => {
          showToast({
            body: "Fill rejected: read-only destination",
            type: "error",
            isAutoHide: false,
            onHide: () => setDismissed(true),
          });
        }}
      />
      <Button label="Reset dismissal" onClick={() => setDismissed(false)} />
      <Button
        label="Report and reconcile"
        onClick={() => {
          const close = showToast({ body: "Already reconciled", type: "error", isAutoHide: false });
          close();
          setCompleted(true);
        }}
      />
      <output aria-label="Reconciliation">{completed ? "Complete" : "Pending"}</output>
      <output aria-label="Dismissal">{dismissed ? "Dismissed" : "Active"}</output>
    </>
  );
}

afterEach(cleanup);

test("a persistent fill rejection exposes a Close control and reports dismissal", async () => {
  await render(
    <ToastViewport>
      <ToastProbe />
    </ToastViewport>,
  );
  await page.getByRole("button", { name: "Report fill rejection" }).click();
  const notification = page.getByRole("region").getByRole("alert");
  await expect.element(notification).toHaveTextContent("Fill rejected: read-only destination");
  await notification.getByRole("button", { name: /dismiss/i }).click();
  await expect.element(notification).not.toBeInTheDocument();
  await expect
    .element(page.getByRole("status", { name: "Dismissal" }))
    .toHaveTextContent(/^Dismissed$/);
});

test("published toast dismisses an already displayed save failure", async () => {
  await render(
    <ToastViewport>
      <ToastProbe />
    </ToastViewport>,
  );
  await page.getByRole("button", { name: "Report failure", exact: true }).click();
  await expect
    .element(page.getByRole("region").getByRole("alert"))
    .toHaveTextContent("Save failed");
  await page.getByRole("button", { name: "Reconcile failure", exact: true }).click();
  await expect.element(page.getByRole("region").getByRole("alert")).not.toBeInTheDocument();
});

test("published toast retains an immediate dismissal before its first render", async () => {
  await render(
    <ToastViewport>
      <ToastProbe />
    </ToastViewport>,
  );
  await page.getByRole("button", { name: "Report and reconcile", exact: true }).click();
  await expect
    .element(page.getByRole("status", { name: "Reconciliation" }))
    .toHaveTextContent("Complete");
  await expect.element(page.getByRole("region").getByRole("alert")).not.toBeInTheDocument();
});
