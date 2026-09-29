"use client";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { markAllRead, markRead } from "@/app/_actions/notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NotificationsModel } from "@/server/read/notifications";
export function NotificationsBell({ model }: { model: NotificationsModel }) {
  const [pending, startTransition] = useTransition(),
    router = useRouter();
  const mark = (id?: string, href?: string) =>
    startTransition(async () => {
      const result = id
        ? await markRead({ status: "idle" }, { id })
        : await markAllRead({ status: "idle" }, {});
      if (result.status === "error") toast.error(result.error.message);
      else if (href) router.push(href);
      else router.refresh();
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Notifications, ${model.unread} unread`}
          className="relative"
        >
          <Bell size={16} strokeWidth={1.5} aria-hidden />
          {model.unread !== "0" && (
            <span
              aria-hidden
              className="absolute -right-1 -top-1 rounded-sm bg-danger px-1 type-label text-on-green"
            >
              {model.unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <div className="px-2 py-2 type-title">Notifications</div>
        {model.items.length ? (
          model.items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              disabled={pending}
              onSelect={() => mark(item.id, item.href)}
              className={item.unread ? "bg-atlas-green-soft" : ""}
            >
              <span className="flex flex-col gap-1">
                <span>{item.text}</span>
                <span className="type-body-sm text-ink-muted">{item.relative}</span>
              </span>
            </DropdownMenuItem>
          ))
        ) : (
          <p className="px-2 py-3 type-body-sm text-ink-muted">No notifications yet.</p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending || model.unread === "0"} onSelect={() => mark()}>
          Mark all as read
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
