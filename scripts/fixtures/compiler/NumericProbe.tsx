import { useState } from "react";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({ output: { color: "rgb(12, 34, 56)" } });

export function NumericProbe() {
  const [value, setValue] = useState(90071992547409931234567890n);
  const one: unknown = 1;
  const text: unknown = "1";
  const zero = 0n;
  const evidence = [
    value,
    -90071992547409931234567890n,
    0xffn + 0b10n + 0o7n,
    1_000n * 2n,
    1n == one,
    1n == text,
    !zero,
    `${42n}`,
  ].join("|");
  return (
    <>
      <output aria-label="Compiled exact values" {...stylex.props(styles.output)}>
        {evidence}
      </output>
      <button onClick={() => setValue(90071992547409931234567891n)}>Next exact value</button>
    </>
  );
}
