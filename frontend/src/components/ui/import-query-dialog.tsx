

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, FileCode, Clock, Trash2, Search, User } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "./button";
import { getFilteredQueries, deleteLocalQuery, LocalSavedQuery } from "~/lib/saved-queries";
import { useToast } from "./toast-provider";

interface ImportQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuerySelect: (query: LocalSavedQuery) => void;
  queryType: "redshift" | "sqlserver" | "merge";
  colorScheme?: "redshift" | "sqlserver" | "merge";
}

const AUTHORS = ["All", "Hasif", "Nazierul", "Asyraff", "Izhar"] as const;

export function ImportQueryDialog({
  open,
  onOpenChange,
  onQuerySelect,
  queryType,
  colorScheme = "redshift",
}: ImportQueryDialogProps) {
  const { showToast } = useToast();
  const [savedQueries, setSavedQueries] = React.useState<LocalSavedQuery[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [authorFilter, setAuthorFilter] = React.useState<string>("All");

  const loadSavedQueries = React.useCallback(() => {
    setIsLoading(true);
    try {
      const queries = getFilteredQueries();
      setSavedQueries(queries);
    } catch (error) {
      showToast("Failed to load saved queries", "error");
      setSavedQueries([]);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    if (open) {
      loadSavedQueries();
      setSearchTerm("");
      setAuthorFilter("All");
    }
  }, [open, loadSavedQueries]);

  const handleQueryClick = (query: LocalSavedQuery) => {
    onQuerySelect(query);
    onOpenChange(false);
  };

  const handleDeleteQuery = (e: React.MouseEvent, queryId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this query?")) return;

    try {
      deleteLocalQuery(queryId);
      showToast("Query deleted", "success");
      loadSavedQueries();
    } catch (error) {
      showToast("Failed to delete query", "error");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getQueryTypeColor = (queryType: string) => {
    switch (queryType) {
      case "redshift":
        return "text-redshift";
      case "sqlserver":
        return "text-sqlserver";
      case "merge":
        return "text-purple-400";
      default:
        return "text-on-surface-variant";
    }
  };

  const getQueryTypeBadge = (queryType: string) => {
    switch (queryType) {
      case "redshift":
        return "bg-redshift/20 text-redshift";
      case "sqlserver":
        return "bg-sqlserver/20 text-sqlserver";
      case "merge":
        return "bg-gradient-to-r from-redshift/20 to-sqlserver/20 text-on-surface";
      default:
        return "bg-surface-container-high text-on-surface-variant";
    }
  };

  const filteredQueries = React.useMemo(() => {
    // First filter by query type to match current editor
    let filtered = savedQueries.filter((q) => q.query_type === queryType);

    // Filter by author if not "All"
    if (authorFilter !== "All") {
      filtered = filtered.filter((q) => q.author === authorFilter);
    }

    // Then filter by search term if provided
    if (searchTerm) {
      filtered = filtered.filter((q) =>
        q.query_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [savedQueries, searchTerm, queryType, authorFilter]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            "w-full max-w-2xl max-h-[80vh] rounded-xl",
            "bg-surface-container shadow-elevation-3",
            "border border-outline-variant",
            "animate-in fade-in-0 zoom-in-95",
            "flex flex-col"
          )}
        >
          <div className="flex items-center justify-between p-6 pb-4 border-b border-outline-variant">
            <Dialog.Title className="text-lg font-semibold text-on-surface">
              Import Query
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className={cn(
                  "p-1.5 rounded-full",
                  "text-on-surface-variant hover:text-on-surface",
                  "hover:bg-surface-container-high transition-colors"
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Search and Filters */}
          <div className="px-6 pt-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input
                type="text"
                placeholder="Search queries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "w-full pl-10 pr-3 py-2 rounded-lg text-sm",
                  "bg-surface text-on-surface",
                  "border border-outline-variant",
                  "focus:outline-none focus:ring-2",
                  colorScheme === "redshift" && "focus:ring-redshift/50 focus:border-redshift",
                  colorScheme === "sqlserver" && "focus:ring-sqlserver/50 focus:border-sqlserver",
                  "placeholder:text-outline"
                )}
              />
            </div>

            {/* Author Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="author-filter" className="flex items-center gap-1.5 text-sm text-on-surface-variant flex-shrink-0">
                <User className="w-4 h-4" />
                Filter by author:
              </label>
              <select
                id="author-filter"
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-lg text-sm",
                  "bg-surface text-on-surface",
                  "border border-outline-variant",
                  "focus:outline-none focus:ring-2",
                  colorScheme === "redshift" && "focus:ring-redshift/50 focus:border-redshift",
                  colorScheme === "sqlserver" && "focus:ring-sqlserver/50 focus:border-sqlserver",
                  "cursor-pointer"
                )}
              >
                {AUTHORS.map((author) => (
                  <option key={author} value={author}>
                    {author}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Queries List */}
          <div className="flex-1 overflow-auto px-6 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-on-surface-variant">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-on-surface-variant mb-3"></div>
                  <p className="text-sm">Loading queries...</p>
                </div>
              </div>
            ) : filteredQueries.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center text-on-surface-variant">
                  <FileCode className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">
                    {searchTerm ? "No queries found matching your search" : "No saved queries yet"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredQueries.map((query) => (
                  <div
                    key={query.id}
                    onClick={() => handleQueryClick(query)}
                    className={cn(
                      "group p-4 rounded-lg cursor-pointer",
                      "bg-surface hover:bg-surface-container-high",
                      "border border-outline-variant hover:border-outline",
                      "transition-all"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FileCode className={cn("w-4 h-4 flex-shrink-0", getQueryTypeColor(query.query_type))} />
                          <h3 className="text-sm font-medium text-on-surface truncate">
                            {query.query_name}
                          </h3>
                          <span className={cn(
                            "px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0",
                            getQueryTypeBadge(query.query_type)
                          )}>
                            {query.query_type === "redshift" ? "Redshift" : query.query_type === "sqlserver" ? "SQL Server" : "Merge"}
                          </span>
                        </div>

                        {query.description && (
                          <p className="text-xs text-on-surface-variant mb-2 line-clamp-2">
                            {query.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-xs text-on-surface-variant/60">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(query.updated_at)}
                          </span>
                          {query.author && (
                            <>
                              <span>•</span>
                              <span>{query.author}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteQuery(e, query.id)}
                        className={cn(
                          "p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity",
                          "hover:bg-red-500/20 text-on-surface-variant hover:text-red-400"
                        )}
                        title="Delete query"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Query Preview */}
                    <div className="mt-3 p-2 rounded bg-surface-container-high border border-outline-variant">
                      <pre className="text-xs font-mono text-on-surface-variant overflow-x-auto whitespace-pre-wrap break-words line-clamp-3">
                        {query.query_text}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-outline-variant">
            <span className="text-xs text-on-surface-variant">
              {filteredQueries.length} {filteredQueries.length === 1 ? "query" : "queries"} available
            </span>
            <Dialog.Close asChild>
              <Button variant="default" size="sm">
                Close
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
