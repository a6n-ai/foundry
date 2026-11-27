import {
  createContext,
  useContext,
  type AnchorHTMLAttributes,
  type ComponentType,
  type ReactNode,
  type Ref,
} from "react"

export type ConsoleSearch = Record<string, unknown>

export type ConsoleLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string
  search?: ConsoleSearch
  replace?: boolean
  ref?: Ref<HTMLAnchorElement>
}

export type ConsoleNavigate = (target: {
  to?: string
  search: ConsoleSearch | ((prev: ConsoleSearch) => ConsoleSearch)
  replace?: boolean
}) => void

export interface ConsoleRouter {
  Link: ComponentType<ConsoleLinkProps>
  useSearch(): ConsoleSearch
  usePathname(): string
  useNavigate(): ConsoleNavigate
}

const RouterContext = createContext<ConsoleRouter | null>(null)

export function ConsoleRouterProvider({ router, children }: { router: ConsoleRouter; children: ReactNode }) {
  return <RouterContext.Provider value={router}>{children}</RouterContext.Provider>
}

export function useConsoleRouter(): ConsoleRouter {
  const router = useContext(RouterContext)
  if (!router) throw new Error("ConsoleRouterProvider is missing")
  return router
}

export function ConsoleLink(props: ConsoleLinkProps) {
  const { Link } = useConsoleRouter()
  return <Link {...props} />
}
