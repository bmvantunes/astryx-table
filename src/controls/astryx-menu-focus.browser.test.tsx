import { Button } from "@astryxdesign/core/Button";
import { ContextMenu, ContextMenuItem } from "@astryxdesign/core/ContextMenu";
import { Dialog } from "@astryxdesign/core/Dialog";
import { Popover } from "@astryxdesign/core/Popover";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSubMenu,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@astryxdesign/core/DropdownMenu";
import { useListFocus } from "@astryxdesign/core/hooks";
import { useLayoutEffect, useRef, useState } from "react";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";

function MenuProbe() {
  const [groups, setGroups] = useState<string[]>([]);
  const restore = useRef(false);
  const { listRef, focusFirst } = useListFocus<HTMLDivElement>({
    itemSelector: '[data-add-group="true"]',
  });
  useLayoutEffect(() => {
    if (!restore.current) return;
    restore.current = false;
    focusFirst();
  }, [groups, focusFirst]);
  return (
    <>
      <div ref={listRef}>
        <DropdownMenu
          button={{
            label: "Add Group",
            "data-add-group": "true",
            isDisabled: groups.length === 2,
            ...(groups.length === 2 ? { tooltip: "All columns grouped" } : {}),
          }}
          items={["Country", "City"]
            .filter((name) => !groups.includes(name))
            .map((name) => ({
              id: name,
              label: name,
              onClick: () => setGroups((previous) => [...previous, name]),
            }))}
        />
        {groups.map((name) => (
          <Button
            key={name}
            label={`Remove ${name}`}
            onClick={() => {
              restore.current = groups.length === 1;
              setGroups((previous) => previous.filter((group) => group !== name));
            }}
          />
        ))}
      </div>
      <div style={{ marginTop: 320 }}>
        <Button label="After grouping" />
      </div>
      <output aria-label="Selected groups">{groups.join(",")}</output>
    </>
  );
}

afterEach(cleanup);

function MenuReviewTransferProbe() {
  const [reviewOpen, setReviewOpen] = useState(false);
  return (
    <>
      <DropdownMenu button={{ label: "Review column" }} presentation="popover">
        <DropdownMenuItem label="Inspect column" onClick={() => setReviewOpen(true)} />
      </DropdownMenu>
      <Dialog
        isOpen={reviewOpen}
        onOpenChange={setReviewOpen}
        purpose="form"
        aria-label="Column review"
      >
        <Button label="Close column review" data-autofocus onClick={() => setReviewOpen(false)} />
      </Dialog>
    </>
  );
}

test("a published menu transfers keyboard focus to a newly opened review", async () => {
  await render(<MenuReviewTransferProbe />);
  const trigger = page.getByRole("button", { name: "Review column", exact: true });
  trigger.element().focus();
  await userEvent.keyboard("{Enter}");
  await expect
    .element(page.getByRole("menuitem", { name: "Inspect column", exact: true }))
    .toHaveFocus();
  await userEvent.keyboard("{Enter}");
  const close = page.getByRole("button", { name: "Close column review", exact: true });
  await expect.element(close).toHaveFocus();
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
  await userEvent.keyboard("{Escape}");
  await expect.element(close).not.toBeInTheDocument();
  await expect.element(trigger).toHaveFocus();
});

function MenuFilterTransferProbe() {
  const [filterOpen, setFilterOpen] = useState(false);
  return (
    <>
      <DropdownMenu button={{ label: "Column menu" }} presentation="popover">
        <DropdownMenuItem label="Open filter" onClick={() => setFilterOpen(true)} />
      </DropdownMenu>
      <Popover
        label="Column filter"
        isOpen={filterOpen}
        onOpenChange={setFilterOpen}
        content={<Button label="Clear filter" />}
      >
        <Button label="Filter column" />
      </Popover>
    </>
  );
}

test("a published menu transfers focus into a filter popover and restores its original opener", async () => {
  await render(<MenuFilterTransferProbe />);
  const menu = page.getByRole("button", { name: "Column menu", exact: true });
  menu.element().focus();
  await userEvent.keyboard("{Enter}");
  await expect
    .element(page.getByRole("menuitem", { name: "Open filter", exact: true }))
    .toHaveFocus();
  await userEvent.keyboard("{Enter}");
  const clear = page.getByRole("button", { name: "Clear filter", exact: true });
  await expect.element(clear).toHaveFocus();
  await expect.element(menu).toHaveAttribute("aria-expanded", "false");
  await userEvent.keyboard("{Escape}");
  await expect
    .element(page.getByRole("dialog", { name: "Column filter", includeHidden: true }))
    .not.toBeVisible();
  await expect.element(menu).toHaveFocus();
});

function ControlledHeaderMenuProbe() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(true);
  return (
    <>
      <Button label="Open header actions" onClick={() => setOpen(true)} />
      {mounted ? (
        <DropdownMenu
          button={{ label: "Header actions" }}
          isMenuOpen={open}
          onOpenChange={setOpen}
          presentation="popover"
        >
          <DropdownMenuItem label="Sort ascending" />
        </DropdownMenu>
      ) : null}
      <Button label="Remove header owner" onClick={() => setMounted(false)} />
    </>
  );
}

function HeaderContextMenuProbe() {
  return (
    <ContextMenu
      label="Header context actions"
      menuContent={<ContextMenuItem label="Sort this column" />}
      presentation="popover"
    >
      <DropdownMenu button={{ label: "Context header actions" }} presentation="popover">
        <DropdownMenuItem label="Sort this column" />
      </DropdownMenu>
    </ContextMenu>
  );
}

test("published header menus use ContextMenu for right-click and DropdownMenu for left-click", async () => {
  await render(<HeaderContextMenuProbe />);
  const trigger = page.getByRole("button", { name: "Context header actions", exact: true });
  await trigger.click({ button: "right" });
  const context = page.getByRole("menu", { name: "Header context actions", exact: true });
  await expect.element(context).toBeVisible();
  await expect
    .element(page.getByRole("menuitem", { name: "Sort this column", exact: true }))
    .toBeVisible();
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
  await userEvent.keyboard("{Escape}");
  await expect.element(context).not.toBeInTheDocument();
  await expect.element(trigger).toHaveFocus();
  await trigger.click();
  await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
  await expect
    .element(page.getByRole("menuitem", { name: "Sort this column", exact: true }))
    .toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect.element(trigger).toHaveFocus();
});

test("a mounted controlled menu admits keyboard opening and releases its removed owner", async () => {
  await render(<ControlledHeaderMenuProbe />);
  const opener = page.getByRole("button", { name: "Open header actions", exact: true });
  opener.element().focus();
  await userEvent.keyboard("{Enter}");
  const item = page.getByRole("menuitem", { name: "Sort ascending", exact: true });
  await expect.element(item).toHaveFocus();
  const remove = page.getByRole("button", { name: "Remove header owner", exact: true });
  await remove.click();
  await expect.element(item).not.toBeInTheDocument();
  await expect
    .element(page.getByRole("button", { name: "Header actions", exact: true }))
    .not.toBeInTheDocument();
  await expect.element(remove).toHaveFocus();
});

function ColumnMenuProbe({ direction }: { direction: "ltr" | "rtl" }) {
  const [pin, setPin] = useState("none");
  return (
    <div dir={direction}>
      <DropdownMenu button={{ label: "Column actions" }} presentation="popover">
        <DropdownMenuSubMenu label="Move">
          <DropdownMenuItem label="Move earlier" />
          <DropdownMenuItem label="Move later" />
        </DropdownMenuSubMenu>
        <DropdownMenuRadioGroup
          label="Pin column"
          value={pin}
          onChange={setPin}
          hasCloseOnSelect={false}
        >
          <DropdownMenuRadioItem value="none" label="Not pinned" />
          <DropdownMenuRadioItem value="start" label="Pin to start" />
        </DropdownMenuRadioGroup>
      </DropdownMenu>
      <output aria-label="Pinned position">{pin}</output>
    </div>
  );
}

for (const direction of ["ltr", "rtl"] as const) {
  test(`compound menu handles nested Escape in ${direction}`, async () => {
    await render(<ColumnMenuProbe direction={direction} />);
    const trigger = page.getByRole("button", { name: "Column actions", exact: true });
    trigger.element().focus();
    await userEvent.keyboard("{Enter}");
    const move = page.getByRole("menuitem", { name: "Move", exact: true });
    await expect.element(move).toHaveFocus();
    await userEvent.keyboard(direction === "rtl" ? "{ArrowLeft}" : "{ArrowRight}");
    await expect
      .element(page.getByRole("menuitem", { name: "Move earlier", exact: true }))
      .toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect.element(move).toHaveFocus();
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    await expect.element(trigger).toHaveFocus();
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
  });
}

test("compound menu commits a radio choice without dismissing when requested", async () => {
  await render(<ColumnMenuProbe direction="ltr" />);
  const trigger = page.getByRole("button", { name: "Column actions", exact: true });
  trigger.element().focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(page.getByRole("menuitem", { name: "Move", exact: true })).toHaveFocus();
  await userEvent.keyboard("{ArrowDown}");
  await expect
    .element(page.getByRole("menuitemradio", { name: "Not pinned", exact: true }))
    .toHaveFocus();
  await userEvent.keyboard("{ArrowDown}");
  const start = page.getByRole("menuitemradio", { name: "Pin to start", exact: true });
  await expect.element(start).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect.element(start).toHaveAttribute("aria-checked", "true");
  await expect
    .element(page.getByRole("status", { name: "Pinned position" }))
    .toHaveTextContent("start");
  await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
  await userEvent.keyboard("{Escape}");
  await expect.element(trigger).toHaveFocus();
});

test("adding a group by pointer returns focus to Add Group", async () => {
  await render(<MenuProbe />);
  const trigger = page.getByRole("button", { name: "Add Group", exact: true });
  await trigger.click();
  await page.getByRole("menuitem", { name: "Country", exact: true }).click();
  await expect
    .element(page.getByRole("status", { name: "Selected groups" }))
    .toHaveTextContent("Country");
  await expect.element(trigger).toHaveFocus();
});

test("DropdownMenu restores its trigger after Escape", async () => {
  await render(<MenuProbe />);
  const trigger = page.getByRole("button", { name: "Add Group", exact: true });
  trigger.element().focus();
  await userEvent.keyboard("{Enter}{Escape}");
  await expect.element(trigger).toHaveFocus();
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
});

test("DropdownMenu lets Tab leave the menu for the next control", async () => {
  await render(<MenuProbe />);
  const trigger = page.getByRole("button", { name: "Add Group", exact: true });
  trigger.element().focus();
  await userEvent.keyboard("{Enter}");
  await userEvent.tab();
  await expect.element(page.getByRole("button", { name: "After grouping" })).toHaveFocus();
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
});

test("published focus hook restores the menu trigger after last-group removal", async () => {
  await render(<MenuProbe />);
  const trigger = page.getByRole("button", { name: "Add Group", exact: true });
  trigger.element().focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(page.getByRole("menuitem", { name: "Country", exact: true })).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  const remove = page.getByRole("button", { name: "Remove Country" });
  await expect.element(remove).toBeVisible();
  remove.element().focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(remove).not.toBeInTheDocument();
  await expect.element(trigger).toHaveFocus();
});

test("DropdownMenu returns focus after keyboard selection removes an action", async () => {
  await render(<MenuProbe />);
  const trigger = page.getByRole("button", { name: "Add Group", exact: true });
  trigger.element().focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(page.getByRole("menuitem", { name: "Country", exact: true })).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect
    .element(page.getByRole("status", { name: "Selected groups" }))
    .toHaveTextContent("Country");
  await expect.element(trigger).toHaveFocus();
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
  await userEvent.keyboard("{Enter}");
  await expect.element(page.getByRole("menuitem", { name: "City", exact: true })).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect
    .element(page.getByRole("status", { name: "Selected groups" }))
    .toHaveTextContent("Country,City");
  await expect.element(trigger).toHaveFocus();
});

test("DropdownMenu preserves focus on an outside-clicked button", async () => {
  await render(<MenuProbe />);
  const trigger = page.getByRole("button", { name: "Add Group", exact: true });
  await trigger.click();
  await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
  const outside = page.getByRole("button", { name: "After grouping" });
  await outside.click();
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
  await expect.element(outside).toHaveFocus();
});
