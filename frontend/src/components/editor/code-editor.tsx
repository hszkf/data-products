

import * as React from "react";
import { cn } from "~/lib/utils";
import { highlightSql } from "~/lib/sql-syntax";
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

  const handleInput = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleKeyDownInternal = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Tab support
      if (e.key === "Tab") {
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
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

      onKeyDown?.(e);
    },
    [value, onChange, onKeyDown]
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
                top: `${(errorLine - 1) * 20}px`,
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
