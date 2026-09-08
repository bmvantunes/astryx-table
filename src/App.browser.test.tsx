import { expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";
import { App } from "./App";
import "./styles.css";

test("the published Astryx button works in real Chromium with compiled StyleX", async () => {
  await render(<App />);
  await expect.element(page.getByRole("heading", { name: "AstryxTable" })).toBeVisible();
  const main = document.querySelector("main");
  expect(main).not.toBeNull();
  expect(getComputedStyle(main!).paddingTop).toBe("32px");
  await page.getByRole("button", { name: "Verify Astryx interaction" }).click();
  await expect
    .element(page.getByRole("status", { name: "Workbench status" }))
    .toHaveTextContent("Astryx interaction confirmed");
});

test("the Astryx button is keyboard operable", async () => {
  await render(<App />);
  await userEvent.tab();
  await expect
    .element(page.getByRole("button", { name: "Verify Astryx interaction" }))
    .toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect
    .element(page.getByRole("status", { name: "Workbench status" }))
    .toHaveTextContent("Astryx interaction confirmed");
});
