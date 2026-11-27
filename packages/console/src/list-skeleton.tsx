import { Skeleton } from "@foundry/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@foundry/ui/table"

const WIDTHS = ["w-2/3", "w-1/2", "w-3/4", "w-1/2", "w-2/3"]
const COLUMNS = 4

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="px-4 pb-4 in-data-[slot=card-content]:p-0">
      <Table role="status" aria-label="Loading">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            {Array.from({ length: COLUMNS }, (_, c) => (
              <TableHead key={c}>
                <Skeleton className={`h-4 ${c === 0 ? "w-20" : "w-16"}`} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r}>
              <TableCell className="w-10">
                <Skeleton className="h-4 w-4" />
              </TableCell>
              {Array.from({ length: COLUMNS }, (_, c) => (
                <TableCell key={c}>
                  <Skeleton className={`h-4 ${WIDTHS[c % WIDTHS.length]}`} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
