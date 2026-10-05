import {
  Children,
  Fragment,
  isValidElement,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { StackItem } from "@astryxdesign/core/Stack";
import * as stylex from "@stylexjs/stylex";
import { ClientContext } from "./internal/client-context";

const styles = stylex.create({ spacer: { minWidth: 8 } });

/** Optional composition wrapper; the owning table supplies the sole native toolbar. */
export function AstryxTableToolbar({ children }: { readonly children?: ReactNode }): ReactNode {
  const context = useContext(ClientContext);
  if (!hasToolbarContent(children)) return null;
  return context === undefined ? (
    <Toolbar label="Table controls" size="sm" startContent={children} />
  ) : (
    children
  );
}

export function AstryxTableToolbarSpacer() {
  return <StackItem as="span" size="fill" aria-hidden="true" xstyle={styles.spacer} />;
}

/** Inspects only transparent authored wrappers, never executes consumer components. */
export function hasToolbarContent(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (typeof child === "string") return child.length > 0;
    if (!isValidElement(child)) return true;
    if (child.type !== Fragment && child.type !== AstryxTableToolbar) return true;
    return hasToolbarContent(
      (child as ReactElement<{ readonly children?: ReactNode }>).props.children,
    );
  });
}
