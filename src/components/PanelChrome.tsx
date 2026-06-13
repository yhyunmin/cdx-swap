import { GripVertical, X } from "lucide-react";
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
        <GripVertical size={18} />
        <span className="drag-fill" aria-hidden="true" />
        <button
          className="icon-button tooltip-trigger"
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={onClose}
          aria-label="Close"
          data-tooltip="닫기"
        >
          <X size={17} />
        </button>
      </div>
      {children}
    </main>
  );
}
