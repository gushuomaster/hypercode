import { createMemo } from "solid-js"
import { useSync } from "../context/sync"

export function useConnected() {
  const sync = useSync()
  return createMemo(() => sync.data.provider_product.some((provider) => provider.connected))
}
