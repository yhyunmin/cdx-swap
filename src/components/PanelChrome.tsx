import { GripHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";

interface PanelChromeProps {
  children: ReactNode;
  onClose: () => void;
  onStartDrag: () => void;
}

export function PanelChrome({ children, onClose, onStartDrag }: PanelChromeProps) {
  return (
    <main className="tray-shell">
      <div
        className="drag-bar"
        onMouseDown={(event) => {
          if (event.button === 0) onStartDrag();
        }}
        role="presentation"
      >
        <GripHorizontal size={18} />
        <button
          className="icon-button"
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={onClose}
          aria-label="Close"
        >
          <X size={17} />
        </button>
      </div>
      {children}
    </main>
  );
}
