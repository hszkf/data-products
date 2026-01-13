

import * as React from "react";
import { cn } from "~/lib/utils";
import { highlightSql } from "~/lib/sql-syntax";
import { getSuggestions, getCurrentWord, isColumnContext, fetchTableColumns, type AutocompleteSuggestion } from "~/lib/sql-autocomplete";
import { AutocompleteDropdown } from "./autocomplete-dropdown";
import type { DatabaseType } from "./editor-panel";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCursorChange?: (position: { line: number; column: number }) => void;
  isLoading?: boolean;
  colorScheme: DatabaseType;
  placeholder?: string;
  errorLine?: number | null;
  errorMessage?: string | null;
}

export function CodeEditor({
  value,
  onChange,
  onKeyDown,
  onCursorChange,
  isLoading = false,
  colorScheme,
  placeholder,
  errorLine = null,
  errorMessage = null,
}: CodeEditorProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = React.useRef<HTMLDivElement>(null);
  const highlightRef = React.useRef<HTMLPreElement>(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = React.useState<AutocompleteSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [showAutocomplete, setShowAutocomplete] = React.useState(false);
  const [autocompletePosition, setAutocompletePosition] = React.useState({ top: 0, left: 0 });
  const shouldRetriggerRef = React.useRef(false);
  const skipBlurCloseRef = React.useRef(false);

  const lineCount = React.useMemo(() => {
    return Math.max(value.split("\n").length, 1);
  }, [value]);

  const highlightedCode = React.useMemo(() => {
    return value ? highlightSql(value) : '';
  }, [value]);

  const handleScroll = React.useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current && highlightRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Track pending column fetch to avoid duplicate requests
  const pendingFetchRef = React.useRef<string | null>(null);

  // Update autocomplete suggestions
  const updateAutocomplete = React.useCallback(async () => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const { word } = getCurrentWord(value, cursorPos);

    // Calculate position for dropdown (do this early)
    const textBeforeCursor = value.substring(0, cursorPos);
    const lines = textBeforeCursor.split("\n");
    const currentLine = lines.length;
    const currentColumn = lines[lines.length - 1].length;
    const top = 12 + currentLine * 20;
    const left = 44 + Math.min(currentColumn * 8, 300);

    // Get sync suggestions first
    let newSuggestions = getSuggestions(value, cursorPos, colorScheme);

    // If no suggestions but we're in column context, try to fetch columns
    if (newSuggestions.length === 0 && colorScheme === "redshift") {
      const columnCtx = isColumnContext(word);
      if (columnCtx) {
        const fetchKey = `${columnCtx.schema}.${columnCtx.table}`;

        // Avoid duplicate fetches
        if (pendingFetchRef.current !== fetchKey) {
          pendingFetchRef.current = fetchKey;

          // Fetch columns async
          await fetchTableColumns(columnCtx.schema, columnCtx.table);
          pendingFetchRef.current = null;

          // Re-get suggestions now that columns are cached
          newSuggestions = getSuggestions(value, cursorPos, colorScheme);
        }
      }
    }

    if (newSuggestions.length > 0) {
      setSuggestions(newSuggestions);
      setSelectedIndex(0);
      setShowAutocomplete(true);
      setAutocompletePosition({ top, left });
    } else {
      setShowAutocomplete(false);
    }
  }, [value, colorScheme]);

  // Re-trigger autocomplete after schema selection (when value updates)
  React.useEffect(() => {
    if (shouldRetriggerRef.current) {
      shouldRetriggerRef.current = false;
      // Small delay to ensure cursor is positioned correctly
      setTimeout(updateAutocomplete, 50);
    }
  }, [value, updateAutocomplete]);

  // Handle selecting an autocomplete suggestion
  const handleAutocompleteSelect = React.useCallback((suggestion: AutocompleteSuggestion) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const { start } = getCurrentWord(value, cursorPos);

    // Replace the current word with the suggestion
    const newValue = value.substring(0, start) + suggestion.value + value.substring(cursorPos);

    // If schema was selected (ends with dot), mark to re-trigger autocomplete
    if (suggestion.type === "schema" && suggestion.value.endsWith('.')) {
      shouldRetriggerRef.current = true;
      skipBlurCloseRef.current = true; // Prevent blur handler from closing dropdown
    }

    onChange(newValue);

    // Move cursor to end of inserted text
    const newCursorPos = start + suggestion.value.length;
    requestAnimationFrame(() => {
      textarea.selectionStart = textarea.selectionEnd = newCursorPos;
      textarea.focus();
    });

    setShowAutocomplete(false);
  }, [value, onChange]);

  // Close autocomplete on blur (with delay to allow click selection)
  const handleBlur = React.useCallback(() => {
    setTimeout(() => {
      // Don't close if we're about to re-trigger (schema selection)
      if (skipBlurCloseRef.current) {
        skipBlurCloseRef.current = false;
        return;
      }
      setShowAutocomplete(false);
    }, 150);
  }, []);

  const handleInput = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      // Trigger autocomplete update after a short delay
      setTimeout(updateAutocomplete, 50);
    },
    [onChange, updateAutocomplete]
  );

  const handleKeyDownInternal = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement;

      // Handle autocomplete navigation when dropdown is visible
      if (showAutocomplete && suggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % suggestions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          handleAutocompleteSelect(suggestions[selectedIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowAutocomplete(false);
          return;
        }
      }

      // Tab support - insert 2 spaces
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newValue =
          value.substring(0, start) + "  " + value.substring(end);
        onChange(newValue);

        // Set cursor position after the tab
        requestAnimationFrame(() => {
          target.selectionStart = target.selectionEnd = start + 2;
        });
      }

      // Cmd+/ or Ctrl+/ - Toggle line comment
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const start = target.selectionStart;
        const end = target.selectionEnd;

        // Find the start and end line indices
        const lines = value.split("\n");
        let charCount = 0;
        let startLineIndex = 0;
        let endLineIndex = 0;

        for (let i = 0; i < lines.length; i++) {
          const lineLength = lines[i].length + 1; // +1 for newline
          if (charCount + lineLength > start && startLineIndex === 0) {
            startLineIndex = i;
          }
          if (charCount + lineLength >= end) {
            endLineIndex = i;
            break;
          }
          charCount += lineLength;
        }

        // Get the lines to toggle
        const selectedLines = lines.slice(startLineIndex, endLineIndex + 1);

        // Check if all selected lines are commented (start with --)
        const allCommented = selectedLines.every(
          (line) => line.trimStart().startsWith("--")
        );

        // Toggle comments
        const newLines = [...lines];
        for (let i = startLineIndex; i <= endLineIndex; i++) {
          if (allCommented) {
            // Remove comment - handle "-- " and "--" patterns
            newLines[i] = lines[i].replace(/^(\s*)--\s?/, "$1");
          } else {
            // Add comment at the start (preserving indentation)
            const match = lines[i].match(/^(\s*)/);
            const indent = match ? match[1] : "";
            const content = lines[i].substring(indent.length);
            newLines[i] = indent + "-- " + content;
          }
        }

        const newValue = newLines.join("\n");
        onChange(newValue);

        // Adjust cursor position
        requestAnimationFrame(() => {
          // Calculate new positions
          const commentDiff = allCommented ? -3 : 3; // "-- " is 3 characters
          const linesDiff = (endLineIndex - startLineIndex + 1) * commentDiff;

          if (start === end) {
            // No selection - just move cursor
            const newPos = Math.max(0, start + commentDiff);
            target.selectionStart = target.selectionEnd = newPos;
          } else {
            // Maintain selection on the toggled lines
            const newStart = Math.max(0, start + (allCommented ? -3 : 3));
            const newEnd = Math.max(0, end + linesDiff);
            target.selectionStart = newStart;
            target.selectionEnd = newEnd;
          }
        });
      }

      // Cmd+D or Ctrl+D - Duplicate line
      if (e.key === "d" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const start = target.selectionStart;
        const lines = value.split("\n");

        // Find current line
        let charCount = 0;
        let currentLineIndex = 0;
        for (let i = 0; i < lines.length; i++) {
          charCount += lines[i].length + 1;
          if (charCount > start) {
            currentLineIndex = i;
            break;
          }
        }

        // Duplicate the line
        const newLines = [...lines];
        newLines.splice(currentLineIndex + 1, 0, lines[currentLineIndex]);
        const newValue = newLines.join("\n");
        onChange(newValue);

        // Move cursor to the duplicated line
        requestAnimationFrame(() => {
          const newPos = start + lines[currentLineIndex].length + 1;
          target.selectionStart = target.selectionEnd = newPos;
        });
      }

      // Cmd+Shift+Up/Down or Alt+Up/Down - Move line up/down
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && (e.altKey || (e.metaKey && e.shiftKey))) {
        e.preventDefault();
        const start = target.selectionStart;
        const lines = value.split("\n");

        // Find current line
        let charCount = 0;
        let currentLineIndex = 0;
        for (let i = 0; i < lines.length; i++) {
          charCount += lines[i].length + 1;
          if (charCount > start) {
            currentLineIndex = i;
            break;
          }
        }

        const direction = e.key === "ArrowUp" ? -1 : 1;
        const targetIndex = currentLineIndex + direction;

        // Check bounds
        if (targetIndex < 0 || targetIndex >= lines.length) {
          return;
        }

        // Swap lines
        const newLines = [...lines];
        [newLines[currentLineIndex], newLines[targetIndex]] = [newLines[targetIndex], newLines[currentLineIndex]];
        const newValue = newLines.join("\n");
        onChange(newValue);

        // Calculate new cursor position
        requestAnimationFrame(() => {
          let newCharCount = 0;
          for (let i = 0; i < targetIndex; i++) {
            newCharCount += newLines[i].length + 1;
          }
          // Position cursor at same offset within the moved line
          const lineOffset = start - (charCount - lines[currentLineIndex].length - 1);
          const newPos = newCharCount + Math.min(lineOffset, newLines[targetIndex].length);
          target.selectionStart = target.selectionEnd = newPos;
        });
      }

      onKeyDown?.(e);
    },
    [value, onChange, onKeyDown, showAutocomplete, suggestions, selectedIndex, handleAutocompleteSelect]
  );

  const handleSelect = React.useCallback(() => {
    if (textareaRef.current && onCursorChange) {
      const textarea = textareaRef.current;
      const textBeforeCursor = value.substring(0, textarea.selectionStart);
      const lines = textBeforeCursor.split("\n");
      const line = lines.length;
      const column = lines[lines.length - 1].length + 1;
      onCursorChange({ line, column });
    }
  }, [value, onCursorChange]);

  return (
    <div className="flex-1 relative overflow-hidden">
      <div className="absolute inset-0 flex">
        {/* Line Numbers */}
        <div
          ref={lineNumbersRef}
          className="line-numbers"
          aria-hidden="true"
        >
          {Array.from({ length: lineCount }, (_, i) => {
            const lineNum = i + 1;
            const isErrorLine = errorLine === lineNum;
            return (
              <div
                key={lineNum}
                className={cn(
                  isErrorLine && "bg-red-500/20 text-red-400 font-semibold"
                )}
              >
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Editor Container with Syntax Highlighting */}
        <div className={cn(
          "flex-1 relative",
          colorScheme === "redshift" && "text-redshift-500",
          colorScheme === "sqlserver" && "text-sqlserver-500"
        )}>
          {/* Syntax Highlighted Code (Background Layer) */}
          <pre
            ref={highlightRef}
            className={cn(
              "code-highlight",
              colorScheme === "redshift" && "redshift-theme",
              colorScheme === "sqlserver" && "sqlserver-theme"
            )}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: highlightedCode || '&nbsp;' }}
          />

          {/* Error Line Highlight Overlay */}
          {errorLine && (
            <div
              className="absolute inset-0 pointer-events-none overflow-hidden"
              style={{
                top: `calc(12px + ${(errorLine - 1) * 20}px)`,
                height: '20px',
              }}
            >
              <div className="w-full h-full bg-red-500/10 border-l-2 border-red-500" />
            </div>
          )}

          {/* Transparent Textarea (Foreground Layer) */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDownInternal}
            onScroll={handleScroll}
            onSelect={handleSelect}
            onClick={handleSelect}
            onBlur={handleBlur}
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            className={cn(
              "code-editor",
              colorScheme === "redshift" && "caret-redshift",
              colorScheme === "sqlserver" && "caret-sqlserver"
            )}
          />

          {/* Autocomplete Dropdown */}
          <AutocompleteDropdown
            suggestions={suggestions}
            selectedIndex={selectedIndex}
            onSelect={handleAutocompleteSelect}
            position={autocompletePosition}
            visible={showAutocomplete}
          />
        </div>
      </div>

      {/* Loading Overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-surface/80 flex items-center justify-center",
          "transition-all duration-300",
          isLoading
            ? "opacity-100 visible"
            : "opacity-0 invisible pointer-events-none"
        )}
      >
        <div className={cn("loading-spinner", colorScheme)} />
      </div>
    </div>
  );
}
