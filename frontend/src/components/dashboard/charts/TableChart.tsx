

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Pagination } from "~/components/ui/pagination";

interface TableChartProps {
  data: Record<string, unknown>[];
  columns?: string[];
  width?: number;
  height?: number;
  pageSize?: number;
  className?: string;
}

export function TableChart({
  data,
  columns: propColumns,
  width = 400,
  height = 300,
  pageSize = 10,
  className = "",
}: TableChartProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(0);

  const columns = useMemo(() => {
    if (propColumns && propColumns.length > 0) return propColumns;
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data, propColumns]);

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const cmp = aStr.localeCompare(bStr);
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [data, sortColumn, sortDirection]);

  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(data.length / pageSize);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const formatCell = (value: unknown): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") {
      return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
    }
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (value instanceof Date) return value.toLocaleDateString();
    return String(value);
  };

  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-on-surface-variant ${className}`} style={{ width, height }}>
        No data available
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`} style={{ width, height }}>
      {/* Table container */}
      <div className="flex-1 overflow-auto border border-outline-variant/30 rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-container-high">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-medium text-on-surface-variant cursor-pointer hover:bg-surface-container-highest transition-colors"
                  onClick={() => handleSort(col)}
                >
                  <div className="flex items-center gap-1">
                    <span className="truncate">{col}</span>
                    {sortColumn === col ? (
                      sortDirection === "asc" ? (
                        <ChevronUp className="w-4 h-4 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0" />
                      )
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 shrink-0 opacity-30" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-t border-outline-variant/20 hover:bg-surface-container/50 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col} className="px-3 py-2 text-on-surface truncate max-w-[200px]">
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-2 text-xs text-on-surface-variant">
          <span>
            {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, data.length)} of {data.length}
          </span>
          <Pagination
            currentPage={currentPage + 1}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page - 1)}
          />
        </div>
      )}
    </div>
  );
}
