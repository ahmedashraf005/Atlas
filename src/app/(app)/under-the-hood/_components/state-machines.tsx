"use client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UnderTheHoodModel } from "@/server/read/under-the-hood";
import { MermaidDiagram } from "./mermaid-diagram";
export function StateMachines({ machines }: { machines: UnderTheHoodModel["machines"] }) {
  return (
    <Tabs defaultValue="holding">
      <TabsList aria-label="State machines" className="max-w-full flex-wrap">
        {machines.map((m) => (
          <TabsTrigger key={m.kind} value={m.kind}>
            {m.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {machines.map((m) => (
        <TabsContent key={m.kind} value={m.kind}>
          <MermaidDiagram text={m.text} label={`${m.label} state machine`} />
          <p className="my-3 type-body-sm text-ink-muted">{m.count}</p>
          <details>
            <summary className="cursor-pointer type-body-sm text-atlas-green focus-visible:outline-2 focus-visible:outline-focus-ring">
              View transition table
            </summary>
            <Table>
              <TableHeader>
                <TableRow>
                  {["From", "Event", "To", "Roles"].map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.rows.map((r, i) => (
                  <TableRow key={`${r.from}-${r.event}-${r.to}-${i}`}>
                    <TableCell>{r.from}</TableCell>
                    <TableCell className="type-mono">{r.event}</TableCell>
                    <TableCell>{r.to}</TableCell>
                    <TableCell>{r.roles}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </details>
        </TabsContent>
      ))}
    </Tabs>
  );
}
