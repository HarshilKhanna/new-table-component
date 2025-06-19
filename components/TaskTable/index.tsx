"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import { type TaskData, type TaskRow } from "../../types/task";
import {
  groupTasksByAttributes,
  toggleRowExpansion,
  expandAllRows,
  collapseAllRows,
  applyTaskFilters,
  applySorting,
} from "../../utils/grouping"
import TaskDetails from "../TaskDetails"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "../ui/resizable";
import TableSidebar from './TableSidebar';

interface Column {
  id: string;
  label: string;
  field: keyof TaskRow;
  width: string;
  textAlign?: 'left' | 'center' | 'right';
  filterable?: boolean;
}

interface ColumnFilter {
  field: string;
  value: string;
}

interface TransposedRow {
  id: string;
  label: string;
  value: string;
  originalField: string;
  isExpandable?: boolean;
  tasks?: TaskData[];
  rowIndex?: number;
}

interface FilterRow {
  field: string;
  operator: string;
  value: string | number[];
  logic?: 'AND' | 'OR';
}

interface TaskTableProps {
  tasks: TaskData[]
}

type FilterState = { condition: 'AND' | 'OR', filters: Record<string, { operator: string, value: string }> };
type SortState = { field: string, order: 'asc' | 'desc' };

const TaskTable: React.FC<TaskTableProps> = ({ tasks }) => {
  const [groupedRows, setGroupedRows] = useState<TaskRow[]>(() => groupTasksByAttributes(tasks))
  const [filterState, setFilterState] = useState<FilterState>({ condition: "AND", filters: {} })
  const [sortStates, setSortStates] = useState<SortState[]>([])
  const [filteredTasks, setFilteredTasks] = useState<TaskData[]>(tasks)
  const [columnSort, setColumnSort] = useState<{ field: keyof TaskRow; order: "asc" | "desc" } | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [columns, setColumns] = useState<Column[]>([
    { id: 'expand', label: '', field: 'id', width: '48px', textAlign: 'center', filterable: false },
    { id: 'contractId', label: 'Contract ID', field: 'contractId', width: '180px', textAlign: 'left', filterable: true },
    { id: 'category', label: 'Category', field: 'category', width: '160px', textAlign: 'left', filterable: true },
    { id: 'domain', label: 'Domain', field: 'domain', width: '160px', textAlign: 'left', filterable: true },
    { id: 'subdomain', label: 'Subdomain', field: 'subdomain', width: '160px', textAlign: 'left', filterable: true },
    { id: 'owner', label: 'Owner', field: 'owner', width: '160px', textAlign: 'left', filterable: true },
    { id: 'tasks', label: 'Tasks', field: 'tasks', width: '100px', textAlign: 'center', filterable: false },
  ]);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([]);
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [isTransposed, setIsTransposed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const resizingColRef = useRef<number | null>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);
  const [columnVisibilityOpen, setColumnVisibilityOpen] = useState(false);
  const [pendingVisibleColumns, setPendingVisibleColumns] = useState<Set<string>>(new Set(columns.map(col => col.id)));
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(columns.map(col => col.id)));
  const [pendingSortColumn, setPendingSortColumn] = useState('');
  const [pendingSortDir, setPendingSortDir] = useState<'asc' | 'desc'>('asc');
  const [pendingIsTransposed, setPendingIsTransposed] = useState(isTransposed);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [sortRules, setSortRules] = useState<SortState[]>([{ field: '', order: 'asc' }]);
  const [filters, setFilters] = useState<{ field: string; operator: string; value: string | number[] }[]>([{ field: '', operator: 'is', value: '' }]);
  const [condition, setCondition] = useState<'AND' | 'OR'>('AND');
  const [viewType, setViewType] = useState<'grouped' | 'flat'>('grouped');
  const [flatVisibleColumns, setFlatVisibleColumns] = useState<Set<string>>(
    new Set([
      'contractId',
      'taskId',
      'obligationTitle',
      'category',
      'domain',
      'subdomain',
      'criticality',
      'owner',
      'triggeredTasks',
      'openTasks',
      'compliance',
    ])
  );
  const [groupedVisibleColumns, setGroupedVisibleColumns] = useState<Set<string>>(new Set(columns.map(col => col.id)));
  const [flatColumns, setFlatColumns] = useState([
    { id: 'contractId', label: 'Contract ID', field: 'contractId', width: '110px', textAlign: 'left', filterable: true },
    { id: 'taskId', label: 'Task ID', field: 'taskId', width: '90px', textAlign: 'left', filterable: true },
    { id: 'obligationTitle', label: 'Obligation Title', field: 'obligationTitle', width: '140px', textAlign: 'left', filterable: true },
    { id: 'category', label: 'Category', field: 'category', width: '100px', textAlign: 'left', filterable: true },
    { id: 'domain', label: 'Domain', field: 'domain', width: '100px', textAlign: 'left', filterable: true },
    { id: 'subdomain', label: 'Subdomain', field: 'subdomain', width: '100px', textAlign: 'left', filterable: true },
    { id: 'criticality', label: 'Criticality', field: 'criticality', width: '110px', textAlign: 'left', filterable: true },
    { id: 'owner', label: 'Owner', field: 'owner', width: '100px', textAlign: 'left', filterable: true },
    { id: 'triggeredTasks', label: 'Triggered Tasks', field: 'triggeredTasks', width: '130px', textAlign: 'right', filterable: true },
    { id: 'openTasks', label: 'Open Tasks', field: 'openTasks', width: '110px', textAlign: 'right', filterable: true },
    { id: 'compliance', label: 'Compliance', field: 'compliance', width: '110px', textAlign: 'left', filterable: true },
  ]);
  const [flatSort, setFlatSort] = useState<{ field: string; order: 'asc' | 'desc' | null } | null>(null);

  // Sync visibleColumns with columns state
  useEffect(() => {
    setPendingVisibleColumns(new Set(columns.map(col => col.id).filter(id => visibleColumns.has(id))));
  }, [columns]);

  // Sync pending state with actual state when columns or isTransposed changes
  useEffect(() => {
    setPendingSortColumn(columnSort?.field ? String(columnSort.field) : '');
    setPendingSortDir(columnSort?.order || 'asc');
    setPendingIsTransposed(isTransposed);
  }, [columnSort, isTransposed]);

  // When viewType changes, update visible columns
  useEffect(() => {
    if (viewType === 'flat') {
      // Always show all columns in flat view by default
      const allFlatColIds = new Set(flatColumns.map(col => col.id));
      setVisibleColumns(allFlatColIds);
      setPendingVisibleColumns(allFlatColIds);
      setFlatVisibleColumns(allFlatColIds);
    } else {
      setVisibleColumns(new Set(groupedVisibleColumns));
      setPendingVisibleColumns(new Set(groupedVisibleColumns));
    }
  }, [viewType, flatColumns]);

  // When visibleColumns changes, update the correct set
  useEffect(() => {
    if (viewType === 'flat') {
      setFlatVisibleColumns(new Set(visibleColumns));
    } else {
      setGroupedVisibleColumns(new Set(visibleColumns));
    }
  }, [visibleColumns, viewType]);

  const handleToggleColumn = (colId: string) => {
    setPendingVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(colId)) {
        newSet.delete(colId);
      } else {
        newSet.add(colId);
      }
      return newSet;
    });
  };

  const handleApplyColumnVisibility = () => {
    setVisibleColumns(new Set(pendingVisibleColumns));
    setColumnVisibilityOpen(false);
  };

  const getComplianceColor = (compliance: TaskData["compliance"]) => {
    switch (compliance) {
      case "Compliant":
        return "#10b981"
      case "Non-Compliant":
        return "#ef4444"
      case "At Risk":
        return "#f59e0b"
      case "Pending":
        return "#6b7280"
      default:
        return "#6b7280"
    }
  }

  const totalTasks = useMemo(() => filteredTasks.length, [filteredTasks])
  const totalRows = useMemo(() => groupedRows.length, [groupedRows])
  const activeFiltersCount = useMemo(() => Object.keys(filterState.filters || {}).length, [filterState.filters])
  const activeSortsCount = useMemo(() => sortStates.length, [sortStates])

  const handleColumnSort = (field: keyof TaskRow) => {
    setColumnSort((current) => {
      if (current?.field === field) {
        if (current.order === "asc") {
          return { field, order: "desc" }
        }
        return null
      }
      return { field, order: "asc" }
    })
  }

  const handleToggleRow = (rowId: string) => {
    setGroupedRows((prev) => toggleRowExpansion(prev, rowId))
  }

  const handleToggleTask = (taskId: string) => {
    setExpandedTasks((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  const handleColumnFilter = (field: string, value: string) => {
    setColumnFilters(prev => {
      const newFilters = prev.filter(f => f.field !== field);
      if (value) {
        newFilters.push({ field, value });
      }
      return newFilters;
    });
  };

  useEffect(() => {
    let filtered = tasks;

    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task =>
        Object.values(task)
          .filter(val => typeof val === 'string' || typeof val === 'number')
          .some(val => String(val).toLowerCase().includes(query))
      );
    }

    // Apply column filters
    if (columnFilters.length > 0) {
      filtered = filtered.filter(task => {
        return columnFilters.every(filter => {
          if (filter.field === 'tasks') {
            return true; // Skip filtering on tasks array
          }
          const value = String(task[filter.field as keyof TaskData]).toLowerCase();
          return value.includes(filter.value.toLowerCase());
        });
      });
    }

    // Determine if any filter is task-level
    const taskLevelFields = [
      'obligationTitle', 'criticality', 'triggeredTasks', 'openTasks', 'compliance'
    ];
    const allFilterFields = [
      ...Object.keys(filterState && filterState.filters ? filterState.filters : {}),
      ...columnFilters.map(f => f.field),
    ];
    const hasTaskLevelFilter = allFilterFields.some(f => taskLevelFields.includes(f));

    // Apply existing filters
    let filteredTasksForGrouping = filtered;
    if (filterState && filterState.filters && Object.keys(filterState.filters).length > 0) {
      filteredTasksForGrouping = applyTaskFilters(filtered, filterState);
    }
    setFilteredTasks(filteredTasksForGrouping);

    // Regroup and apply sorting
    let newRows: TaskRow[] = [];
    if (
      viewType === 'grouped' &&
      ((filterState && filterState.filters && Object.keys(filterState.filters).length > 0) || columnFilters.length > 0 || searchQuery.trim() !== "")
    ) {
      if (hasTaskLevelFilter) {
        // For each contract, only include tasks that match the filter
        const grouped = groupTasksByAttributes(filteredTasksForGrouping);
        // Remove contracts with no tasks
        newRows = grouped.filter(row => row.tasks.length > 0);
      } else {
        // For contract-level filters, show all tasks for matching contracts
        const matchingContractIds = new Set(filteredTasksForGrouping.map(t => t.contractId));
        const allTasksForMatchingContracts: TaskData[] = [];
        matchingContractIds.forEach(contractId => {
          allTasksForMatchingContracts.push(...tasks.filter(t => t.contractId === contractId));
        });
        newRows = groupTasksByAttributes(allTasksForMatchingContracts);
      }
    } else {
      newRows = groupTasksByAttributes(filteredTasksForGrouping);
    }
    if (sortStates.length > 0) {
      newRows = applySorting(newRows, sortStates);
    }
    setGroupedRows(newRows);
  }, [tasks, filterState, columnFilters, sortStates, searchQuery, viewType]);

  const handleExpandAll = () => {
    setGroupedRows((prev) => expandAllRows(prev))
  }

  const handleCollapseAll = () => {
    setGroupedRows((prev) => collapseAllRows(prev))
  }

  const handleApplyFilters = (newFilterState: FilterState) => {
    setFilterState(newFilterState)

    // Apply filters to original tasks
    const filtered = applyTaskFilters(tasks, newFilterState)
    setFilteredTasks(filtered)

    // Regroup and apply sorting
    let newRows = groupTasksByAttributes(filtered)
    if (sortStates.length > 0) {
      newRows = applySorting(newRows, sortStates)
    }

    setGroupedRows(newRows)
  }

  const handleApplySort = (newSortStates: SortState[]) => {
    setSortStates(newSortStates)

    // Apply sorting to current grouped rows
    const sortedRows = applySorting(groupedRows, newSortStates)
    setGroupedRows(sortedRows)
  }

  const handleDragStart = (e: React.DragEvent<HTMLTableCellElement>, columnId: string) => {
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLTableCellElement>, targetColumnId: string) => {
    e.preventDefault();
    
    if (!draggedColumn || draggedColumn === targetColumnId) return;

    setColumns(prevColumns => {
      const newColumns = [...prevColumns];
      const draggedIdx = newColumns.findIndex(col => col.id === draggedColumn);
      const targetIdx = newColumns.findIndex(col => col.id === targetColumnId);
      
      const [draggedCol] = newColumns.splice(draggedIdx, 1);
      newColumns.splice(targetIdx, 0, draggedCol);
      
      return newColumns;
    });

    setDraggedColumn(null);
  };

  const transposeData = (rows: TaskRow[]): TransposedRow[][] => {
    if (rows.length === 0) return [];

    const transposedRows: TransposedRow[][] = [];
    
    // Create header row
    const headerRow: TransposedRow[] = [];
    headerRow.push({ id: 'header', label: 'Field', value: 'Field', originalField: 'id' });
    rows.forEach((row, index) => {
      headerRow.push({
        id: `header-${index}`,
        label: `Row ${index + 1}`,
        value: `Row ${index + 1}`,
        originalField: 'id',
        isExpandable: true,
        tasks: row.tasks,
        rowIndex: index
      });
    });
    transposedRows.push(headerRow);

    // Create data rows
    columns.forEach(column => {
      if (column.id === 'expand') return; // Skip the expand column
      
      const dataRow: TransposedRow[] = [];
      dataRow.push({
        id: `field-${column.id}`,
        label: column.label,
        value: column.label,
        originalField: column.field.toString()
      });

      rows.forEach((row, index) => {
        let value = row[column.field];
        // Convert all values to strings
        if (column.field === 'tasks') {
          value = String((value as TaskData[]).length);
        } else {
          value = String(value);
        }
        
        dataRow.push({
          id: `${column.id}-${index}`,
          label: value,
          value: value,
          originalField: column.field.toString(),
          tasks: row.tasks,
          rowIndex: index
        });
      });

      transposedRows.push(dataRow);
    });

    return transposedRows;
  };

  const renderTransposeButton = () => (
    <button
      onClick={() => setIsTransposed(prev => !prev)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 16px",
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        backgroundColor: isTransposed ? "#f3f4f6" : "white",
        color: "#374151",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "500",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "#f9fafb";
        e.currentTarget.style.borderColor = "#9ca3af";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isTransposed ? "#f3f4f6" : "white";
        e.currentTarget.style.borderColor = "#d1d5db";
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 2H3v20h18V2zM7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>
      </svg>
      Transpose
    </button>
  );

  const handleResizeStart = (e: React.MouseEvent, colIdx: number) => {
    e.preventDefault();
    setResizingCol(colIdx);
    resizingColRef.current = colIdx;
    startXRef.current = e.clientX;
    startWidthRef.current = parseInt(columns[colIdx].width);
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleResizing);
    window.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizing = (e: MouseEvent) => {
    const colIdx = resizingColRef.current;
    if (colIdx === null) return;
    const delta = e.clientX - startXRef.current;
    setColumns(prev => prev.map((col, idx) =>
      idx === colIdx ? { ...col, width: Math.max(80, startWidthRef.current + delta) + 'px' } : col
    ));
  };

  const handleResizeEnd = () => {
    setResizingCol(null);
    resizingColRef.current = null;
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', handleResizing);
    window.removeEventListener('mouseup', handleResizeEnd);
  };

  const handleSidebarApply = () => {
    setSortStates(sortRules.filter(rule => rule.field));
    setVisibleColumns(new Set(pendingVisibleColumns));
    setIsTransposed(pendingIsTransposed);
  };

  const handleSidebarReset = () => {
    setPendingSortColumn('');
    setPendingSortDir('asc');
    setPendingVisibleColumns(new Set(columns.map(col => col.id)));
    setPendingIsTransposed(false);
  };

  const handleFlatResizing = (e: MouseEvent) => {
    const colIdx = resizingColRef.current;
    if (colIdx === null) return;
    const delta = e.clientX - startXRef.current;
    setFlatColumns(prev => prev.map((col, idx) =>
      idx === colIdx ? { ...col, width: Math.max(60, startWidthRef.current + delta) + 'px' } : col
    ));
  };

  const handleFlatResizeEnd = () => {
    setResizingCol(null);
    resizingColRef.current = null;
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', handleFlatResizing);
    window.removeEventListener('mouseup', handleFlatResizeEnd);
  };

  const sortedFlatTasks = React.useMemo(() => {
    if (!flatSort) return filteredTasks;
    const col = flatColumns.find(c => c.field === flatSort.field);
    if (!col) return filteredTasks;
    return [...filteredTasks].sort((a, b) => {
      const aValue = a[col.field as keyof TaskData];
      const bValue = b[col.field as keyof TaskData];
      if (flatSort.order === 'asc') {
        if (typeof aValue === 'number' && typeof bValue === 'number') return aValue - bValue;
        return String(aValue).localeCompare(String(bValue));
      } else {
        if (typeof aValue === 'number' && typeof bValue === 'number') return bValue - aValue;
        return String(bValue).localeCompare(String(aValue));
      }
    });
  }, [filteredTasks, flatSort, flatColumns]);

  function applyFiltersWithLogic(tasks: TaskData[], filters: FilterRow[]): TaskData[] {
    if (!filters.length || !filters[0].field) return tasks;
    // Start with the first filter
    let result = tasks.filter(task => filterMatches(task, filters[0]));
    for (let i = 1; i < filters.length; i++) {
      const filter = filters[i];
      if (!filter.field) continue;
      const nextSet = tasks.filter(task => filterMatches(task, filter));
      if ((filter.logic || 'AND') === 'AND') {
        result = result.filter(task => nextSet.includes(task));
      } else {
        // OR
        const idSet = new Set(result.map(t => t.taskId));
        nextSet.forEach(task => { if (!idSet.has(task.taskId)) result.push(task); });
      }
    }
    return result;
  }

  function filterMatches(task: TaskData, filter: FilterRow): boolean {
    const value = task[filter.field as keyof TaskData];
    const filterValue = filter.value;
    if (value === undefined || value === null) {
      if (filter.operator === 'isEmpty') return true;
      if (filter.operator === 'isNotEmpty') return false;
      return false;
    }
    const stringValue = String(value).toLowerCase();
    const stringFilterValue = String(filterValue).toLowerCase();
    switch (filter.operator) {
      case 'is': return stringValue === stringFilterValue;
      case 'isNot': return stringValue !== stringFilterValue;
      case 'contains': return stringValue.includes(stringFilterValue);
      case 'isEmpty': return stringValue === '' || stringValue === 'null' || stringValue === 'undefined';
      case 'isNotEmpty': return stringValue !== '' && stringValue !== 'null' && stringValue !== 'undefined';
      case 'greaterThan': return Number(value) > Number(filterValue);
      case 'lessThan': return Number(value) < Number(filterValue);
      case 'greaterThanOrEqual': return Number(value) >= Number(filterValue);
      case 'lessThanOrEqual': return Number(value) <= Number(filterValue);
      case 'range':
        if (Array.isArray(filterValue) && filterValue.length === 2) {
          const numValue = Number(value);
          const from = Number(filterValue[0]);
          const to = Number(filterValue[1]);
          if (!isNaN(from) && !isNaN(to)) {
            return numValue >= from && numValue <= to;
          }
        }
        return false;
      default:
        return false;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'ey_interstate, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            background: '#fff',
            borderRadius: '6px',
            border: '1px solid #dfe7ef',
            padding: 0,
            margin: '32px auto',
            maxWidth: '1400px',
            minWidth: '1200px',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              borderBottom: '1px solid #dfe7ef',
              background: '#fff',
            }}
          >
            <div>
              <h1 style={{ 
                fontSize: '16px', 
                fontWeight: 600, 
                color: '#2e2e38', 
                margin: 0,
                fontFamily: 'ey_interstate, Inter'
              }}>Table</h1>
              <p style={{ 
                fontSize: '14px', 
                color: '#6f6f7a', 
                margin: '4px 0 0 0',
                fontFamily: 'ey_interstate, Inter'
              }}>
                Descriptive text that describes your page or content.
              </p>
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  padding: "10px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "14px",
                  minWidth: "180px",
                  outline: "none",
                  transition: "border 0.2s",
                }}
              />
              <button
                onClick={() => setShowConfigModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  background: 'white',
                  color: '#374151',
                  fontWeight: 500,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ display: 'block' }}
                >
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                Configure
              </button>
            </div>
          </div>

          {/* Table Content */}
          <div
            style={{
              maxHeight: '70vh',
              minHeight: '70px',
              overflowY: 'auto',
              overflowX: 'auto',
              background: '#fff',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                minWidth: '1200px',
                fontFamily: 'ey_interstate, Inter',
              }}
            >
              {viewType === 'flat' && isTransposed ? (
                // Transposed Table
                <>
                  <thead>
                    <tr style={{ background: '#f7f9fb', borderBottom: '1px solid #dfe7ef' }}>
                      <th style={{ padding: '6px 8px', fontWeight: 600, fontSize: '13px', color: '#2e2e38', borderBottom: '1px solid #dfe7ef', background: '#f7f9fb', minWidth: 120 }}>Field</th>
                      {sortedFlatTasks.map((task) => (
                        <th key={task.taskId + '-col'} style={{ padding: '6px 8px', fontWeight: 600, fontSize: '13px', color: '#2e2e38', borderBottom: '1px solid #dfe7ef', background: '#f7f9fb', minWidth: 120 }}>
                          {task.taskId}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {flatColumns.filter(col => visibleColumns.has(col.id)).map((column) => (
                      <tr key={column.id + '-row'} style={{ background: '#fff', borderBottom: '1px solid #dfe7ef' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 600, fontSize: '13px', color: '#2e2e38', background: '#f7f9fb', minWidth: 120 }}>{column.label}</td>
                        {sortedFlatTasks.map((task) => (
                          <td key={task.taskId + '-' + column.id} style={{ padding: '6px 8px', fontSize: '13px', color: '#2e2e38', minWidth: 120 }}>
                            {String(task[column.field as keyof typeof task])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : viewType === 'flat' ? (
                <>
                  <thead>
                    <tr style={{ background: '#f7f9fb', borderBottom: '1px solid #dfe7ef' }}>
                      {flatColumns.filter(col => visibleColumns.has(col.id)).map((column, colIdx) => (
                        <th
                          key={column.id}
                          draggable
                          onDragStart={e => {
                            setDraggedColumn(column.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                          onDrop={e => {
                            e.preventDefault();
                            if (!draggedColumn || draggedColumn === column.id) return;
                            setFlatColumns(prev => {
                              const newCols = [...prev];
                              const draggedIdx = newCols.findIndex(col => col.id === draggedColumn);
                              const targetIdx = newCols.findIndex(col => col.id === column.id);
                              const [draggedCol] = newCols.splice(draggedIdx, 1);
                              newCols.splice(targetIdx, 0, draggedCol);
                              return newCols;
                            });
                            setDraggedColumn(null);
                          }}
                          onClick={() => {
                            if (!column.filterable) return;
                            setFlatSort(prev => {
                              if (!prev || prev.field !== column.field) return { field: column.field, order: 'asc' };
                              if (prev.order === 'asc') return { field: column.field, order: 'desc' };
                              if (prev.order === 'desc') return null;
                              return { field: column.field, order: 'asc' };
                            });
                          }}
                          style={{
                            padding: '4px 6px',
                            textAlign: column.textAlign as React.CSSProperties['textAlign'],
                            fontWeight: 600,
                            fontSize: '13px',
                            color: '#2e2e38',
                            borderBottom: '1px solid #dfe7ef',
                            background: '#f7f9fb',
                            width: column.width,
                            minWidth: column.width,
                            maxWidth: column.width,
                            position: 'relative',
                            cursor: 'grab',
                            opacity: draggedColumn === column.id ? 0.5 : 1,
                            transition: 'transform 0.2s ease, opacity 0.2s ease',
                            userSelect: 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', overflow: 'hidden' }}>
                            <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                              {column.label}
                              {flatSort && flatSort.field === column.field && (
                                <span style={{ marginLeft: 4, color: flatSort.order === 'asc' ? '#007bff' : '#6f6f7a', flexShrink: 0 }}>
                                  {flatSort.order === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                            {column.filterable && (
                              <div
                                onClick={e => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === column.id ? null : column.id); }}
                                style={{ cursor: 'pointer', padding: '4px', borderRadius: '4px', backgroundColor: activeFilterColumn === column.id ? '#e5e7eb' : 'transparent', flexShrink: 0, width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={activeFilterColumn === column.id ? "#007bff" : "#6f6f7a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                              </div>
                            )}
                          </div>
                          {/* Resizer handle, except for last column */}
                          {colIdx < flatColumns.length - 1 && (
                            <>
                              <div style={{ position: 'absolute', right: 0, top: 0, width: '2px', height: '100%', background: '#d1d5db', zIndex: 1, pointerEvents: 'none' }} />
                              <div
                                onMouseDown={e => {
                                  e.preventDefault();
                                  setResizingCol(colIdx);
                                  resizingColRef.current = colIdx;
                                  startXRef.current = e.clientX;
                                  startWidthRef.current = parseInt(flatColumns[colIdx].width);
                                  document.body.style.userSelect = 'none';
                                  window.addEventListener('mousemove', handleFlatResizing);
                                  window.addEventListener('mouseup', handleFlatResizeEnd);
                                }}
                                style={{ position: 'absolute', right: 0, top: 0, width: '8px', height: '100%', cursor: 'col-resize', zIndex: 2, userSelect: 'none' }}
                                onClick={e => e.stopPropagation()}
                              />
                            </>
                          )}
                        </th>
                      ))}
                    </tr>
                    {/* Filter row */}
                    <tr>
                      {flatColumns.filter(col => visibleColumns.has(col.id)).map(column => (
                        <th key={column.id} style={{ padding: '2px 4px', background: '#f7f9fb' }}>
                          {column.filterable && activeFilterColumn === column.id && (
                            <input
                              type="text"
                              placeholder="Contains..."
                              value={columnFilters.find(f => f.field === column.field)?.value || ''}
                              onChange={e => handleColumnFilter(column.field, e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', border: '1px solid #dfe7ef', borderRadius: '4px', fontSize: '13px', outline: 'none', transition: 'border-color 0.2s ease' }}
                              onFocus={e => { e.target.style.borderColor = '#007bff'; }}
                              onBlur={e => { e.target.style.borderColor = '#dfe7ef'; }}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFlatTasks.map((task, rowIdx) => (
                      <tr key={task.taskId + '-' + rowIdx} style={{ background: '#fff', borderBottom: '1px solid #dfe7ef' }}>
                        {flatColumns.filter(col => visibleColumns.has(col.id)).map((column) => (
                          <td
                            key={column.id}
                            style={{
                              padding: '4px 6px',
                              textAlign: column.textAlign as React.CSSProperties['textAlign'],
                              fontSize: '14px',
                              color: '#2e2e38',
                              verticalAlign: 'middle',
                              fontWeight: 400,
                            }}
                          >
                            {task[column.field as keyof TaskData]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : (
                <>
                  <thead>
                    <tr style={{ background: '#f7f9fb', borderBottom: '1px solid #dfe7ef' }}>
                      {columns.filter(col => visibleColumns.has(col.id)).map((column, colIdx) => (
                        <th
                          key={column.id}
                          draggable={column.id !== 'expand'}
                          onDragStart={(e) => handleDragStart(e, column.id)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, column.id)}
                          onClick={() => column.id !== 'expand' && handleColumnSort(column.field)}
                          style={{
                            padding: '6px 8px',
                            textAlign: column.textAlign || 'left',
                            fontWeight: 600,
                            fontSize: '13px',
                            color: '#2e2e38',
                            borderBottom: '1px solid #dfe7ef',
                            background: '#f7f9fb',
                            cursor: column.id !== 'expand' ? 'grab' : 'default',
                            userSelect: 'none',
                            width: column.width,
                            minWidth: column.width,
                            maxWidth: column.width,
                            position: 'relative',
                            opacity: draggedColumn === column.id ? 0.5 : 1,
                            transition: 'transform 0.2s ease, opacity 0.2s ease',
                            transform: draggedColumn && draggedColumn !== column.id ? 'translateX(0)' : 'none',
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: '100%',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              flex: '1 1 auto',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              minWidth: 0,
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                            }}>
                              {column.label}
                              {column.id !== 'expand' && columnSort?.field === column.field && (
                                <span style={{
                                  marginLeft: "4px",
                                  color: columnSort.order === "asc" ? "#007bff" : "#6f6f7a",
                                  flexShrink: 0,
                                }}>
                                  {columnSort.order === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </div>
                            {column.filterable && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveFilterColumn(activeFilterColumn === column.id ? null : column.id);
                                }}
                                style={{
                                  cursor: 'pointer',
                                  padding: '4px',
                                  borderRadius: '4px',
                                  transition: 'background-color 0.2s ease',
                                  backgroundColor: activeFilterColumn === column.id ? '#e5e7eb' : 'transparent',
                                  flexShrink: 0,
                                  width: '20px',
                                  height: '20px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke={activeFilterColumn === column.id ? "#007bff" : "#6f6f7a"}
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                                </svg>
                              </div>
                            )}
                          </div>
                          {/* Resizer handle, except for the last column and expand column */}
                          {column.id !== 'expand' && colIdx < columns.length - 1 && (
                            <>
                              {/* Divider line for resizer */}
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
                                  width: '2px',
                                  height: '100%',
                                  background: '#d1d5db',
                                  zIndex: 1,
                                  pointerEvents: 'none',
                                }}
                              />
                              {/* Resizer handle */}
                              <div
                                onMouseDown={e => handleResizeStart(e, colIdx)}
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
                                  width: '8px',
                                  height: '100%',
                                  cursor: 'col-resize',
                                  zIndex: 2,
                                  userSelect: 'none',
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                            </>
                          )}
                          {activeFilterColumn === column.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                width: '200px',
                                backgroundColor: '#fff',
                                border: '1px solid #dfe7ef',
                                borderRadius: '6px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                padding: '12px',
                                zIndex: 10,
                                marginTop: '4px',
                                animation: 'slideDown 0.2s ease',
                              }}
                            >
                              <input
                                type="text"
                                placeholder="Contains..."
                                value={columnFilters.find(f => f.field === column.field)?.value || ''}
                                onChange={(e) => handleColumnFilter(column.field, e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #dfe7ef',
                                  borderRadius: '4px',
                                  fontSize: '14px',
                                  outline: 'none',
                                  transition: 'border-color 0.2s ease',
                                }}
                                onFocus={(e) => {
                                  e.target.style.borderColor = '#007bff';
                                }}
                                onBlur={(e) => {
                                  e.target.style.borderColor = '#dfe7ef';
                                }}
                              />
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={columns.filter(col => visibleColumns.has(col.id)).length}
                          style={{
                            padding: "40px",
                            textAlign: "center",
                            color: "#6b7280",
                          }}
                        >
                          {activeFiltersCount > 0 ? "No tasks match the current filters" : "No tasks available"}
                        </td>
                      </tr>
                    ) : (
                      groupedRows.map((row) => (
                        <React.Fragment key={row.id}>
                          <tr
                            style={{
                              background: '#fff',
                              borderBottom: '1px solid #dfe7ef',
                              transition: 'background 0.2s ease, transform 0.2s ease',
                              cursor: 'pointer',
                            }}
                            onClick={() => handleToggleRow(row.id)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f7f9fb'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#fff'
                            }}
                          >
                            {columns.filter(col => visibleColumns.has(col.id)).map(column => {
                              if (column.id === 'expand') {
                                return (
                                  <td
                                    key={column.id}
                                    style={{
                                      padding: '6px 8px',
                                      textAlign: 'center',
                                      verticalAlign: 'middle',
                                      width: '32px',
                                      color: '#6f6f7a',
                                    }}
                                  >
                                    <span style={{ 
                                      fontSize: '14px',
                                      display: 'inline-block',
                                      transform: row.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                      lineHeight: 1,
                                    }}>
                                      ›
                                    </span>
                                  </td>
                                );
                              }

                              if (column.id === 'tasks') {
                                return (
                                  <td
                                    key={column.id}
                                    style={{
                                      padding: '6px 8px',
                                      textAlign: 'center',
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      color: '#3b82f6',
                                      verticalAlign: 'middle',
                                      transition: 'transform 0.2s ease',
                                    }}
                                  >
                                    <span
                                      style={{
                                        backgroundColor: '#dbeafe',
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        display: 'inline-block',
                                        transition: 'transform 0.2s ease',
                                      }}
                                    >
                                      {row.tasks.length}
                                    </span>
                                  </td>
                                );
                              }

                              if (column.id === 'owner') {
                                return (
                                  <td
                                    key={column.id}
                                    style={{
                                      padding: '6px 8px',
                                      fontSize: '13px',
                                      color: '#2e2e38',
                                      verticalAlign: 'middle',
                                      textAlign: column.textAlign,
                                      transition: 'transform 0.2s ease',
                                    }}
                                  >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <img
                                        src={'/placeholder-user.jpg'}
                                        alt="Owner"
                                        style={{
                                          width: '22px',
                                          height: '22px',
                                          borderRadius: '50%',
                                          objectFit: 'cover',
                                          background: '#e5e7eb',
                                          border: '1px solid #d1d5db',
                                        }}
                                      />
                                      {String(row[column.field])}
                                    </span>
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={column.id}
                                  style={{
                                    padding: '6px 8px',
                                    fontSize: '13px',
                                    color: '#2e2e38',
                                    verticalAlign: 'middle',
                                    textAlign: column.textAlign,
                                    transition: 'transform 0.2s ease',
                                  }}
                                >
                                  {column.field === 'tasks' ? row.tasks.length : row[column.field]}
                                </td>
                              );
                            })}
                          </tr>
                          {row.isExpanded && (
                            <tr>
                              <td colSpan={columns.filter(col => visibleColumns.has(col.id)).length} style={{ 
                                backgroundColor: '#f7f9fb', 
                                padding: '0',
                                overflow: 'hidden',
                              }}>
                                <div style={{ 
                                  padding: '8px',
                                  animation: 'slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                }}>
                                  <div
                                    style={{
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      color: '#2e2e38',
                                      marginBottom: '8px',
                                      borderBottom: '1px solid #dfe7ef',
                                      paddingBottom: '4px',
                                    }}
                                  >
                                    Tasks ({row.tasks.length})
                                  </div>
                                  {row.tasks.map((task: TaskData, index: number) => (
                                    <div 
                                      key={task.taskId}
                                      style={{
                                        animation: `fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.05}s`,
                                        marginBottom: 0,
                                        borderBottom: index < row.tasks.length - 1 ? '1px solid #e5e7eb' : 'none',
                                        borderRadius: 0,
                                        background: 'none',
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          padding: '6px',
                                          backgroundColor: 'transparent',
                                          borderRadius: 0,
                                          marginBottom: 0,
                                          cursor: 'pointer',
                                          border: 'none',
                                          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                        }}
                                        onClick={() => handleToggleTask(task.taskId)}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.transform = 'translateY(-1px)';
                                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.transform = 'none';
                                          e.currentTarget.style.boxShadow = 'none';
                                        }}
                                      >
                                        <span style={{ 
                                          marginRight: '8px',
                                          color: '#6f6f7a',
                                          fontSize: '14px',
                                          display: 'inline-block',
                                          transform: expandedTasks.has(task.taskId) ? 'rotate(90deg)' : 'rotate(0deg)',
                                          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                          lineHeight: 1,
                                        }}>
                                          ›
                                        </span>
                                        <div style={{ 
                                          flex: 1,
                                          fontSize: '14px',
                                          color: '#2e2e38',
                                          fontWeight: '500',
                                          fontFamily: 'ey_interstate, Inter'
                                        }}>
                                          {task.taskId}
                                        </div>
                                      </div>
                                      {expandedTasks.has(task.taskId) && (
                                        <div style={{ 
                                          marginLeft: '16px',
                                          marginBottom: '8px',
                                          padding: '8px',
                                          backgroundColor: '#f9fafb',
                                          borderRadius: '8px',
                                          border: '1px solid #e5e7eb',
                                          animation: 'slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        }}>
                                          <div style={{
                                            marginBottom: '8px',
                                            fontSize: '13px',
                                            color: '#111827'
                                          }}>
                                            <div style={{ fontWeight: '600', marginBottom: '4px' }}>{task.obligationTitle}</div>
                                            <div style={{ 
                                              display: 'grid', 
                                              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                              gap: '8px',
                                              marginTop: '6px'
                                            }}>
                                              <div>
                                                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Criticality</div>
                                                <div style={{ 
                                                  color: task.criticality === 'High' ? '#ef4444' : 
                                                        task.criticality === 'Medium' ? '#f59e0b' : '#10b981',
                                                  fontWeight: '500'
                                                }}>{task.criticality}</div>
                                              </div>
                                              <div>
                                                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Triggered Tasks</div>
                                                <div style={{ fontWeight: '500' }}>{task.triggeredTasks}</div>
                                              </div>
                                              <div>
                                                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Open Tasks</div>
                                                <div style={{ fontWeight: '500' }}>{task.openTasks}</div>
                                              </div>
                                              <div>
                                                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Compliance</div>
                                                <div style={{ 
                                                  display: 'inline-block',
                                                  padding: '2px 8px',
                                                  borderRadius: '12px',
                                                  fontSize: '12px',
                                                  fontWeight: '500',
                                                  backgroundColor: getComplianceColor(task.compliance),
                                                  color: '#fff'
                                                }}>
                                                  {task.compliance}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </>
              )}
            </table>
          </div>
        </div>
      </div>
      {showConfigModal && (
        <TableSidebar
          columns={viewType === 'flat' ? flatColumns : columns}
          visibleColumns={visibleColumns}
          pendingVisibleColumns={pendingVisibleColumns}
          setPendingVisibleColumns={setPendingVisibleColumns}
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
          isTransposed={pendingIsTransposed}
          setIsTransposed={setPendingIsTransposed}
          onApply={(filterState) => {
            if (filterState) setFilterState(filterState);
            handleSidebarApply();
            setShowConfigModal(false);
          }}
          onReset={handleSidebarReset}
          sortRules={sortRules}
          setSortRules={setSortRules}
          filters={filters}
          setFilters={setFilters}
          condition={condition}
          setCondition={setCondition}
          viewType={viewType}
          onViewTypeChange={setViewType}
          modal={true}
          onClose={() => setShowConfigModal(false)}
        />
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

export default TaskTable

