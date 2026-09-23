import type { ProductSessionNavigationInput } from "../../src"

export const navigationFixture: ProductSessionNavigationInput = {
  currentSessionID: "root",
  activeChildID: "child-b",
  nodes: [
    { id: "root", order: 0 },
    { id: "child-b", parentID: "root", title: "B", order: 2 },
    { id: "child-a", parentID: "root", title: "A", order: 1 },
    { id: "child-offline", parentID: "root", title: "Offline", order: 3, available: false },
    { id: "child-archived", parentID: "root", title: "Archived", order: 4, archivedAt: 9 },
    { id: "sibling", parentID: "parent", title: "Sibling", order: 1 },
    { id: "parent", order: 0 },
  ],
}
