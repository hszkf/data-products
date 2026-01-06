import * as React from "react";
import { Plus, X } from "lucide-react";
import { cn } from "~/lib/utils";
import type { DatabaseType } from "./editor-panel";

export interface EditorTab {
  id: string;
  name: string;
  query: string;
  isDirty?: boolean;
}

interface EditorTabsProps {
  tabs: EditorTab[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  onTabRename?: (tabId: string, newName: string) => void;
  colorScheme: DatabaseType;
}

export function EditorTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
  onTabRename,
  colorScheme,
}: EditorTabsProps) {
  const [editingTabId, setEditingTabId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDoubleClick = (tab: EditorTab) => {
    setEditingTabId(tab.id);
    setEditValue(tab.name);
  };

  const handleEditSubmit = (tabId: string) => {
    if (editValue.trim() && onTabRename) {
      onTabRename(tabId, editValue.trim());
    }
    setEditingTabId(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === "Enter") {
      handleEditSubmit(tabId);
    } else if (e.key === "Escape") {
      setEditingTabId(null);
    }
  };

  React.useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  return (
    <div className="flex items-center bg-surface-container/30 border-b border-outline-variant/20">
      {/* Scrollable tabs container */}
      <div className="flex-1 overflow-x-auto scrollbar-none min-w-0">
        <div className="flex items-center gap-0.5 px-1 py-0.5">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isEditing = editingTabId === tab.id;

            return (
              <div
                key={tab.id}
                className={cn(
                  "group flex items-center gap-1.5 px-2 py-1 rounded",
                  "cursor-pointer select-none transition-colors duration-100",
                  "flex-shrink-0 max-w-[140px]",
                  !isActive && "text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-surface-container/50",
                  isActive && "text-on-surface",
                  isActive && colorScheme === "redshift" && "bg-redshift/10 text-redshift",
                  isActive && colorScheme === "sqlserver" && "bg-sqlserver/10 text-sqlserver"
                )}
                onClick={() => !isEditing && onTabSelect(tab.id)}
                onDoubleClick={() => handleDoubleClick(tab)}
              >
                {/* Tab name */}
                {isEditing ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleEditSubmit(tab.id)}
                    onKeyDown={(e) => handleEditKeyDown(e, tab.id)}
                    className="w-full bg-transparent border-none outline-none text-[11px] text-on-surface"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-[11px] truncate">
                    {tab.name}
                    {tab.isDirty && <span className="ml-0.5 opacity-70">•</span>}
                  </span>
                )}

                {/* Close button */}
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTabClose(tab.id);
                    }}
                    className={cn(
                      "flex items-center justify-center w-3.5 h-3.5 rounded-sm flex-shrink-0",
                      "opacity-0 group-hover:opacity-100 transition-opacity",
                      "text-on-surface-variant/50 hover:text-on-surface hover:bg-surface-container-high",
                      isActive && "opacity-50"
                    )}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add new tab button - fixed on right */}
      <button
        onClick={onNewTab}
        className={cn(
          "flex items-center justify-center w-6 h-6 mx-1 rounded flex-shrink-0",
          "text-on-surface-variant/50 transition-colors",
          "hover:text-on-surface-variant hover:bg-surface-container/50"
        )}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
