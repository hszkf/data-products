/**
 * Autocomplete Dropdown Component
 *
 * Displays Redshift schema and table suggestions.
 */

import * as React from "react";
import { cn } from "~/lib/utils";
import { Database, FolderTree } from "lucide-react";
import type { AutocompleteSuggestion } from "~/lib/sql-autocomplete";

interface AutocompleteDropdownProps {
  suggestions: AutocompleteSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: AutocompleteSuggestion) => void;
  position: { top: number; left: number };
  visible: boolean;
}

export function AutocompleteDropdown({
  suggestions,
  selectedIndex,
  onSelect,
  position,
  visible,
}: AutocompleteDropdownProps) {
  const listRef = React.useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  React.useEffect(() => {
    if (listRef.current && visible) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, visible]);

  if (!visible || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute z-50 min-w-[240px] max-w-[360px] max-h-[200px] overflow-auto",
        "bg-surface-container border border-outline-variant rounded-md shadow-lg",
        "py-0.5 font-mono text-xs"
      )}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div ref={listRef}>
        {suggestions.map((suggestion, index) => (
          <div
            key={`${suggestion.type}-${suggestion.value}-${index}`}
            className={cn(
              "flex items-center gap-2 px-2 py-1 cursor-pointer",
              index === selectedIndex
                ? "bg-primary/20 text-on-surface"
                : "text-on-surface-variant hover:bg-surface-container-high"
            )}
            onClick={() => onSelect(suggestion)}
          >
            {/* Icon */}
            {suggestion.type === "schema" ? (
              <FolderTree className="w-3 h-3 text-amber-400 flex-shrink-0" />
            ) : (
              <Database className="w-3 h-3 text-blue-400 flex-shrink-0" />
            )}

            {/* Label */}
            <span className="flex-1 truncate">{suggestion.label}</span>

            {/* Schema name for tables */}
            {suggestion.detail && (
              <span className="text-[10px] text-on-surface-variant/50 flex-shrink-0">
                {suggestion.detail}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Hint */}
      <div className="px-2 py-1 border-t border-outline-variant/30 text-[10px] text-on-surface-variant/40">
        ↑↓ Tab Enter
      </div>
    </div>
  );
}
