"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/cn";

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

export function MenuContent({ className, children, ...props }: DM.DropdownMenuContentProps) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={6}
        align="end"
        className={cn(
          "z-50 min-w-52 rounded-xl border border-border-strong bg-surface-2 p-1.5 text-sm text-fg shadow-2xl",
          className,
        )}
        {...props}
      >
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function MenuItem({ className, ...props }: DM.DropdownMenuItemProps) {
  return (
    <DM.Item
      className={cn(
        "flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-fg-muted outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-3 data-[highlighted]:text-fg [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function MenuLabel({ className, ...props }: DM.DropdownMenuLabelProps) {
  return <DM.Label className={cn("px-2.5 pt-1.5 pb-1 text-xs text-fg-subtle", className)} {...props} />;
}

export const MenuSeparator = () => <DM.Separator className="my-1.5 h-px bg-border" />;
