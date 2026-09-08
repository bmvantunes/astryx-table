import { Button } from "@astryxdesign/core/Button";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

const styles = stylex.create({
  page: { maxWidth: 960, marginInline: "auto", padding: 32 },
  heading: { fontSize: 32, marginBottom: 16 },
  paragraph: { marginBottom: 16 },
});

export function App() {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Theme theme={neutralTheme}>
      <main {...stylex.props(styles.page)}>
        <h1 {...stylex.props(styles.heading)}>AstryxTable</h1>
        <p {...stylex.props(styles.paragraph)}>
          Migration workbench: Vite+, React Compiler, Astryx and StyleX. The grid migration is not
          implemented yet.
        </p>
        <Button label="Verify Astryx interaction" onClick={() => setConfirmed(true)} />
        <p role="status" aria-label="Workbench status">
          {confirmed ? "Astryx interaction confirmed" : "Ready to verify"}
        </p>
      </main>
    </Theme>
  );
}
