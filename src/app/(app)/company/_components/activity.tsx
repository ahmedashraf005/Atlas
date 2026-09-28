import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActivityView } from "@/server/read/consoles";
export function Activity({ items }: { items: ActivityView[] }) {
  return items.length ? (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Actor</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Entity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((e) => (
          <TableRow key={e.seq}>
            <TableCell>{e.at}</TableCell>
            <TableCell className="whitespace-normal min-w-48">{e.actor}</TableCell>
            <TableCell>{e.action}</TableCell>
            <TableCell>
              {e.href ? (
                <Link className="text-atlas-green hover:underline" href={e.href}>
                  {e.entity}
                </Link>
              ) : (
                e.entity
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ) : (
    <p className="px-5 pb-5 type-body-sm text-ink-muted">No recent activity.</p>
  );
}
