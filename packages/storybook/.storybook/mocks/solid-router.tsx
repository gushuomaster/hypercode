import type { ParentProps } from "solid-js"

export function useParams() {
  return {
    dir: "c3Rvcnk=",
    id: "story-session",
  }
}

export function useNavigate() {
  return () => undefined
}

export function useSearchParams() {
  return [{}, () => undefined] as const
}

export function useLocation() {
  return {
    pathname: "/story/session/story-session",
    search: "",
    hash: "",
  }
}

export function useIsRouting() {
  return () => false
}

export function useMatch() {
  return () => undefined
}

export function MemoryRouter(props: ParentProps) {
  return props.children
}

export function Router(props: ParentProps) {
  return props.children
}

export function Route(props: ParentProps) {
  return props.children
}

export function A(props: ParentProps) {
  return props.children
}

export function Navigate() {
  return null
}
