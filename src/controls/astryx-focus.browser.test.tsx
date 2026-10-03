import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { Dialog } from "@astryxdesign/core/Dialog";
import { useListFocus } from "@astryxdesign/core/hooks";
import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";

const options = [
  { value: "country", label: "Country" },
  { value: "city", label: "City" },
];

// Published-package integration probe, not a replacement for public grid tests.
function GroupFocusProbe() {
  const [groups, setGroups] = useState<string[]>([]);
  const restoreAddGroup = useRef(false);
  const { listRef, focusFirst } = useListFocus<HTMLDivElement>({
    itemSelector: '[data-focus-owner="add-group"]',
  });
  useLayoutEffect(() => {
    if (!restoreAddGroup.current) return;
    restoreAddGroup.current = false;
    focusFirst();
  }, [groups, focusFirst]);
  const inactive = options.filter((option) => !groups.includes(option.value));
  return (
    <>
      <div ref={listRef}>
        <Selector
          id="focus-probe-add-group"
          data-focus-owner="add-group"
          label="Add Group"
          placeholder="Add Group"
          isLabelHidden
          value=""
          options={inactive}
          isDisabled={inactive.length === 0}
          disabledMessage="All available columns are grouped"
          onChange={(columnId) => setGroups((previous) => [...previous, columnId])}
        />
        {groups.map((columnId) => (
          <Button
            key={columnId}
            label={`Remove ${columnId}`}
            onClick={() => {
              restoreAddGroup.current = groups.length === 1;
              setGroups((previous) => previous.filter((group) => group !== columnId));
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

function SelectionDialogProbe() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Selector
        label="Inspect column"
        value=""
        options={options}
        presentation="popover"
        onChange={() => flushSync(() => setOpen(true))}
      />
      <Dialog isOpen={open} onOpenChange={setOpen} aria-label="Selected column">
        <Button label="Review selected column" />
      </Dialog>
    </>
  );
}

test("Selector preserves focus when onChange synchronously opens a dialog", async () => {
  await render(<SelectionDialogProbe />);
  await page.getByRole("combobox", { name: "Inspect column" }).click();
  await page.getByRole("option", { name: "Country", exact: true }).click();
  await expect.element(page.getByRole("button", { name: "Review selected column" })).toHaveFocus();
  await expect.element(page.getByRole("dialog", { name: "Selected column" })).toBeVisible();
});

function BooleanOperandProbe() {
  const [value, setValue] = useState("");
  return (
    <>
      <Selector
        label="Boolean filter value"
        {...(value === ""
          ? { status: { type: "error" as const, message: "Choose a Boolean value." } }
          : {})}
        value={value}
        onChange={setValue}
        options={[
          { value: "", label: "Choose a value" },
          { value: "true", label: "True" },
          { value: "false", label: "False" },
        ]}
      />
      <output aria-label="Boolean operand token">{value}</output>
    </>
  );
}

test("a Boolean operand exposes its validation and preserves false and empty tokens", async () => {
  await render(<BooleanOperandProbe />);
  const selector = page.getByRole("combobox", { name: "Boolean filter value" });
  await expect.element(selector).toHaveAttribute("aria-invalid", "true");
  await expect.element(selector).toHaveAccessibleDescription("Choose a Boolean value.");
  await selector.click();
  await page.getByRole("option", { name: "False", exact: true }).click();
  await expect
    .element(page.getByRole("status", { name: "Boolean operand token" }))
    .toHaveTextContent(/^false$/);
  await expect.element(selector).not.toHaveAttribute("aria-invalid", "true");
  await selector.click();
  await page.getByRole("option", { name: "Choose a value", exact: true }).click();
  await expect
    .element(page.getByRole("status", { name: "Boolean operand token" }))
    .toBeEmptyDOMElement();
  await expect.element(selector).toHaveAccessibleDescription("Choose a Boolean value.");
});

function CustomOperandProbe() {
  const [token, setToken] = useState("");
  return (
    <>
      <Selector
        label="Custom filter value"
        value={token}
        onChange={setToken}
        options={[
          { value: "", label: "Choose a value" },
          { value: "option-0", label: "Same formatted value" },
          { value: "option-1", label: "Same formatted value" },
        ]}
      />
      <output aria-label="Custom operand token">{token}</output>
      <Button label="Reset custom operand" onClick={() => setToken("")} />
    </>
  );
}

test("a custom operand distinguishes option tokens with identical display labels", async () => {
  await render(<CustomOperandProbe />);
  const selector = page.getByRole("combobox", { name: "Custom filter value" });
  await selector.click();
  await page.getByRole("option", { name: "Same formatted value", exact: true }).nth(1).click();
  await expect
    .element(page.getByRole("status", { name: "Custom operand token" }))
    .toHaveTextContent(/^option-1$/);
  await selector.click();
  await page.getByRole("option", { name: "Same formatted value", exact: true }).nth(0).click();
  await expect
    .element(page.getByRole("status", { name: "Custom operand token" }))
    .toHaveTextContent(/^option-0$/);
});

function FilterControlFocusProbe() {
  const { listRef, getItems } = useListFocus<HTMLDivElement>({ itemSelector: '[role="combobox"]' });
  useLayoutEffect(() => {
    getItems()[0]?.focus({ preventScroll: true });
  }, [getItems]);
  return (
    <div ref={listRef}>
      <Selector
        label="Filter expression"
        value="leaf"
        options={[{ value: "leaf", label: "Single condition" }]}
      />
    </div>
  );
}

test("a filter focuses its published Selector through the supported item-discovery hook", async () => {
  await render(<FilterControlFocusProbe />);
  await expect.element(page.getByRole("combobox", { name: "Filter expression" })).toHaveFocus();
});

function FilterOperatorProbe() {
  const [operator, setOperator] = useState("equals");
  return (
    <>
      <Selector
        label="Filter operator"
        value={operator}
        onChange={setOperator}
        options={[
          { value: "equals", label: "Equals" },
          { value: "in", label: "Is one of" },
        ]}
      />
      <output aria-label="Operator token">{operator}</output>
      <Button label="Reset operator" onClick={() => setOperator("equals")} />
    </>
  );
}

function RegisteredFilterFocusProbe({
  label,
  focusRef,
}: {
  label: string;
  focusRef?: React.RefObject<HTMLElement | null>;
}) {
  const { listRef, getItems } = useListFocus<HTMLDivElement>({ itemSelector: '[role="combobox"]' });
  useLayoutEffect(() => {
    if (focusRef === undefined) return;
    const target = getItems()[0] ?? null;
    focusRef.current = target;
    return () => {
      if (focusRef.current === target) focusRef.current = null;
    };
  }, [focusRef, getItems]);
  return (
    <div ref={listRef}>
      <Selector label={label} value="default" options={["default"]} />
    </div>
  );
}

function FilterFocusOwnershipProbe() {
  const focusRef = useRef<HTMLElement | null>(null);
  const [blank, setBlank] = useState(true);
  return (
    <>
      <RegisteredFilterFocusProbe label="Expression fallback" {...(!blank ? { focusRef } : {})} />
      <RegisteredFilterFocusProbe label="Blank operator" {...(blank ? { focusRef } : {})} />
      <Button label="Use value operator" onClick={() => setBlank(false)} />
      <Button label="Use blank operator" onClick={() => setBlank(true)} />
      <Button
        label="Restore filter focus"
        onClick={() => focusRef.current?.focus({ preventScroll: true })}
      />
    </>
  );
}

test("a surviving expression remains the focus fallback after blank-operator ownership ends", async () => {
  await render(<FilterFocusOwnershipProbe />);
  await page.getByRole("button", { name: "Use value operator" }).click();
  await page.getByRole("button", { name: "Restore filter focus" }).click();
  await expect.element(page.getByRole("combobox", { name: "Expression fallback" })).toHaveFocus();
  await page.getByRole("button", { name: "Use blank operator" }).click();
  await page.getByRole("button", { name: "Restore filter focus" }).click();
  await expect.element(page.getByRole("combobox", { name: "Blank operator" })).toHaveFocus();
  await page.getByRole("button", { name: "Use value operator" }).click();
  await page.getByRole("button", { name: "Restore filter focus" }).click();
  await expect.element(page.getByRole("combobox", { name: "Expression fallback" })).toHaveFocus();
});

test("a filter operator receives the exact published Selector token", async () => {
  await render(<FilterOperatorProbe />);
  await page.getByRole("combobox", { name: "Filter operator" }).click();
  await page.getByRole("option", { name: "Is one of", exact: true }).click();
  await expect
    .element(page.getByRole("status", { name: "Operator token" }))
    .toHaveTextContent(/^in$/);
});

test("published useListFocus restores Add Group after its last removal button unmounts", async () => {
  await render(<GroupFocusProbe />);
  const trigger = page.getByRole("combobox", { name: "Add Group" });
  await trigger.click();
  await page.getByRole("option", { name: "Country", exact: true }).click();
  const remove = page.getByRole("button", { name: "Remove country" });
  remove.element().focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(remove).not.toBeInTheDocument();
  await expect.element(trigger).toHaveFocus();
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
});

test("published Selector closes with Escape and keeps its trigger focused", async () => {
  await render(<GroupFocusProbe />);
  const trigger = page.getByRole("combobox", { name: "Add Group" });
  trigger.element().focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
  await userEvent.keyboard("{Escape}");
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
  await expect.element(trigger).toHaveFocus();
});

test("published Selector lets Tab move to the next control without restoring old focus", async () => {
  await render(<GroupFocusProbe />);
  const trigger = page.getByRole("combobox", { name: "Add Group" });
  trigger.element().focus();
  await userEvent.keyboard("{Enter}");
  await userEvent.tab();
  await expect.element(page.getByRole("button", { name: "After grouping" })).toHaveFocus();
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
});

test("published Selector does not steal focus after clicking another control", async () => {
  await render(<GroupFocusProbe />);
  const trigger = page.getByRole("combobox", { name: "Add Group" });
  await trigger.click();
  const after = page.getByRole("button", { name: "After grouping" });
  await after.click();
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
  await expect.element(after).toHaveFocus();
});

test("published Selector retains keyboard focus when each selected option leaves its list", async () => {
  await render(<GroupFocusProbe />);
  const trigger = page.getByRole("combobox", { name: "Add Group" });
  trigger.element().focus();
  expect(document.getElementById("focus-probe-add-group")).toBe(trigger.element());
  await userEvent.keyboard("{Enter}{Enter}");
  await expect
    .element(page.getByRole("status", { name: "Selected groups" }))
    .toHaveTextContent("country");
  await expect.element(trigger).toHaveFocus();
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
  await userEvent.keyboard("{Enter}{Enter}");
  await expect
    .element(page.getByRole("status", { name: "Selected groups" }))
    .toHaveTextContent("country,city");
  await expect.element(trigger).toHaveFocus();
  await expect.element(trigger).toHaveAttribute("aria-disabled", "true");
});
