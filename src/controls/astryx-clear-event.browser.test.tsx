import { TextInput } from "@astryxdesign/core/TextInput";
import { afterEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";

afterEach(cleanup);
test("documents Core 0.6.5 native Clear passing null despite its declared ChangeEvent", async () => {
  const calls: unknown[][] = [];
  await render(
    <TextInput
      label="Clear contract"
      value="Ada"
      hasClear
      onChange={(value, event) => calls.push([value, event])}
    />,
  );
  await page.getByRole("button", { name: "Clear Clear contract", exact: true }).click();
  expect(calls).toEqual([["", null]]);
});
