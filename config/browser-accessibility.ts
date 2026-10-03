import type { BrowserCommand } from "vitest/node";
import type {} from "@vitest/browser-playwright";

export type AccessibilityNode = Readonly<{
  id: string;
  role: string;
  name: string;
  children: readonly string[];
}>;
type FrameTree = { frame: { id: string; url: string }; childFrames?: FrameTree[] };
function findFrame(tree: FrameTree, url: string): string | undefined {
  if (tree.frame.url === url) return tree.frame.id;
  for (const child of tree.childFrames ?? []) {
    const found = findFrame(child, url);
    if (found !== undefined) return found;
  }
  return undefined;
}

// Read the browser's actual accessibility tree, including cross-region aria-owns.
export const readGridAccessibility: BrowserCommand<[]> = async ({ page, frame }) => {
  const target = await frame();
  const session = await page.context().newCDPSession(page);
  try {
    const { frameTree } = await session.send("Page.getFrameTree");
    const frameId = findFrame(frameTree, target.url());
    if (frameId === undefined) throw new Error("Browser test frame was not found.");
    const { nodes } = await session.send("Accessibility.getFullAXTree", { frameId });
    return nodes
      .filter((node) => !node.ignored)
      .map(
        (node) =>
          ({
            id: node.nodeId,
            role: String(node.role?.value ?? ""),
            name: String(node.name?.value ?? ""),
            children: node.childIds ?? [],
          }) satisfies AccessibilityNode,
      );
  } finally {
    await session.detach();
  }
};

declare module "vitest/browser" {
  interface BrowserCommands {
    readGridAccessibility: () => Promise<readonly AccessibilityNode[]>;
  }
}
