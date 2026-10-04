import { useState } from "react";
import { afterEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";

afterEach(cleanup);

function ExactValues({ values }: { values: readonly bigint[] | undefined }) {
  return (
    <output aria-label="Exact values">
      {values?.map((value) => `${typeof value}:${value}`).join(",")}
    </output>
  );
}

function ReactBigIntCase({ next }: { next: readonly bigint[] }) {
  const [values, setValues] = useState<readonly bigint[] | undefined>(undefined);
  return (
    <>
      <button onClick={() => setValues(next)}>Change exact values</button>
      <ExactValues values={values} />
    </>
  );
}

test("React development profiling accepts changed bigint array props without changing values", async () => {
  await render(<ReactBigIntCase next={[90071992547409931234567891n]} />);
  await page.getByRole("button", { name: "Change exact values", exact: true }).click();
  await expect
    .element(page.getByRole("status", { name: "Exact values", exact: true }))
    .toHaveTextContent("bigint:90071992547409931234567891");
});
