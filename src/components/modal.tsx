"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

/** Accessible dialog (native <dialog>) with a trigger button. Content is only mounted while open. */
export function Modal({
  trigger,
  title,
  description,
  children,
  triggerClassName = "btn-primary",
  wide = false,
  defaultOpen = false,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: (close: () => void) => ReactNode;
  triggerClassName?: string;
  wide?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false);
        }}
        className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-3xl" : "max-w-xl"} border border-line bg-paper-light p-0 text-ink shadow-xl backdrop:bg-ink-900/50`}
        aria-labelledby="modal-title"
      >
        {open && (
          <div className="max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h2 id="modal-title" className="font-serif text-lg font-semibold">
                  {title}
                </h2>
                {description && <p className="mt-0.5 text-sm text-mute">{description}</p>}
              </div>
              <button type="button" aria-label="Close" className="btn-quiet btn-sm -mr-2" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">{children(() => setOpen(false))}</div>
          </div>
        )}
      </dialog>
    </>
  );
}
