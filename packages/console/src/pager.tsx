import { Button } from "@foundry/ui/button"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { ConsoleLink, useConsoleRouter } from "./router"
import { withParam } from "./search-param"

export function Pager({ page, hasNext, param = "page" }: { page: number; hasNext: boolean; param?: string }) {
  const router = useConsoleRouter()
  const to = router.usePathname()
  const search = router.useSearch()
  const at = (n: number) => withParam(search, param, n > 1 ? String(n) : "", [])
  if (page <= 1 && !hasNext) return null
  return (
    <nav aria-label="Pagination" className="flex items-center justify-end gap-2 px-4 pb-4">
      {page > 1 ? (
        <Button variant="outline" render={<ConsoleLink to={to} search={at(page - 1)} />}>
          <ChevronLeftIcon />
          Previous
        </Button>
      ) : null}
      {hasNext ? (
        <Button variant="outline" render={<ConsoleLink to={to} search={at(page + 1)} />}>
          Next
          <ChevronRightIcon />
        </Button>
      ) : null}
    </nav>
  )
}
