import { TextInput } from "@astryxdesign/core/TextInput";
import { useState } from "react";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";

afterEach(cleanup);

type Change = { value: string; type: string; badInput: boolean };
function NumericInput({ changes }: { changes: Change[] }) {
  const [value, setValue] = useState("");
  return (
    <TextInput
      label="Native decimal"
      value={value}
      type="number"
      step="any"
      onChange={(next, event) => {
        changes.push({
          value: next,
          type: event.currentTarget.type,
          badInput: event.currentTarget.validity.badInput,
        });
        setValue(next);
      }}
    />
  );
}

test("native numeric TextInput forwards fractional step and its original input event", async () => {
  const changes: Change[] = [];
  await render(<NumericInput changes={changes} />);
  const input = page.getByRole("spinbutton", { name: "Native decimal", exact: true });
  await expect.element(input).toHaveAttribute("step", "any");
  await input.fill("1.25");
  expect(changes.at(-1)).toEqual({ value: "1.25", type: "number", badInput: false });
  expect((input.element() as HTMLInputElement).validity.stepMismatch).toBe(false);
  await input.fill("1e3");
  expect(changes.at(-1)).toEqual({ value: "1e3", type: "number", badInput: false });
  await input.fill("1");
  await userEvent.keyboard("e");
  expect(changes.at(-1)).toEqual({ value: "", type: "number", badInput: true });
});
