"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";
export function CommercialModal({
  title,
  description,
  children,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const trigger = useRef<HTMLElement | null>(
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement),
  );
  const content = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="cc-overlay" />
        <Dialog.Content
          ref={content}
          className={"crm commercial cc-dialog" + (wide ? " wide" : "")}
          onOpenAutoFocus={(e) => {
            const first = content.current?.querySelector<HTMLElement>(
              "form input:not([type=hidden]), form textarea, form select",
            );
            if (first) {
              e.preventDefault();
              first.focus();
            }
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            trigger.current?.focus();
          }}
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <div className="cc-dialog-head">
            <div>
              <Dialog.Title asChild>
                <h2>{title}</h2>
              </Dialog.Title>
              <Dialog.Description asChild>
                <p>{description || "Revisa los datos antes de confirmar."}</p>
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="cc-icon-button"
              disabled={busy}
              aria-label="Cerrar ventana"
            >
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
