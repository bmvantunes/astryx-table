import { StrictMode, useEffect, useState } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import { usePopover } from "@astryxdesign/core/Popover";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import "../styles.css";

afterEach(cleanup);

function Menu({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div style={{ overflow: "hidden" }} dir="rtl">
      <DropdownMenu
        button={{ label: "Column actions" }}
        isMenuOpen={open}
        onOpenChange={setOpen}
        items={[{ id: "sort", label: "Sort column" }]}
      />
      <button onClick={() => setOpen((value) => !value)}>Toggle controlled menu</button>
    </div>
  );
}

test("closed native menus defer layers and still reopen with keyboard focus", async () => {
  await render(
    <StrictMode>
      <Menu />
    </StrictMode>,
  );
  expect(page.getByRole("menu", { includeHidden: true }).elements()).toHaveLength(0);
  const trigger = page.getByRole("button", { name: "Column actions", exact: true });
  for (let cycle = 0; cycle < 2; cycle++) {
    (trigger.element() as HTMLElement).focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect.element(page.getByRole("menuitem", { name: "Sort column" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect.element(trigger).toHaveFocus();
    await expect
      .poll(() => page.getByRole("menu", { includeHidden: true }).elements().length)
      .toBe(0);
  }
});

test("a native menu initially controlled open can close and mount again", async () => {
  await render(
    <StrictMode>
      <Menu initialOpen />
    </StrictMode>,
  );
  await expect.element(page.getByRole("menuitem", { name: "Sort column" })).toBeVisible();
  await page.getByRole("button", { name: "Toggle controlled menu" }).click();
  await expect
    .poll(() => page.getByRole("menu", { includeHidden: true }).elements().length)
    .toBe(0);
  await page.getByRole("button", { name: "Toggle controlled menu" }).click();
  await expect.element(page.getByRole("menuitem", { name: "Sort column" })).toBeVisible();
});

test("a controlled menu can reject a deferred opening without a second notification", async () => {
  const changed = vi.fn();
  await render(
    <DropdownMenu
      button={{ label: "Rejected menu" }}
      isMenuOpen={false}
      onOpenChange={changed}
      items={[{ id: "action", label: "Action" }]}
    />,
  );
  await page.getByRole("button", { name: "Rejected menu" }).click();
  await expect.poll(() => changed.mock.calls.length).toBe(1);
  expect(changed).toHaveBeenCalledWith(true);
  await expect
    .element(page.getByRole("button", { name: "Rejected menu" }))
    .toHaveAttribute("aria-expanded", "false");
  expect(page.getByRole("menu", { includeHidden: true }).elements()).toHaveLength(0);
});

test("a dismissing trigger click does not reopen a lazy menu", async () => {
  const changed = vi.fn();
  await render(
    <DropdownMenu
      button={{ label: "Toggle menu" }}
      onOpenChange={changed}
      items={[{ id: "action", label: "Action" }]}
    />,
  );
  const trigger = page.getByRole("button", { name: "Toggle menu" });
  for (let cycle = 0; cycle < 2; cycle++) {
    await trigger.click();
    await expect.element(page.getByRole("menuitem", { name: "Action" })).toBeVisible();
    await trigger.click();
    await expect
      .poll(() => page.getByRole("menu", { includeHidden: true }).elements().length)
      .toBe(0);
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
  }
  expect(changed.mock.calls.map(([open]) => open)).toEqual([true, false, true, false]);
});

function EffectOpenedPopover() {
  const {
    show,
    triggerRef,
    render: renderPopover,
  } = usePopover({ dialogLabel: "Effect-opened popup" });
  useEffect(show, [show]);
  return (
    <>
      <button ref={triggerRef}>Effect trigger</button>
      {renderPopover(<button>Popup action</button>)}
    </>
  );
}

test("public Popover show remains a void-returning React effect callback", async () => {
  await render(<EffectOpenedPopover />);
  await expect.element(page.getByRole("dialog", { name: "Effect-opened popup" })).toBeVisible();
});
