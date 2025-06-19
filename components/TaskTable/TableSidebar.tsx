import React from 'react';

interface FilterRow {
  field: string;
  operator: string;
  value: string | number[];
  logic?: 'AND' | 'OR';
}

interface TableSidebarProps {
  columns: { id: string; label: string }[];
  visibleColumns: Set<string>;
  pendingVisibleColumns: Set<string>;
  setPendingVisibleColumns: React.Dispatch<React.SetStateAction<Set<string>>>;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  isTransposed: boolean;
  setIsTransposed: (v: boolean) => void;
  onApply: (filterState?: any) => void;
  onReset: () => void;
  sortRules: { field: string; order: 'asc' | 'desc' }[];
  setSortRules: React.Dispatch<React.SetStateAction<{ field: string; order: 'asc' | 'desc' }[]>>;
  filters: FilterRow[];
  setFilters: React.Dispatch<React.SetStateAction<FilterRow[]>>;
  condition: 'AND' | 'OR';
  setCondition: React.Dispatch<React.SetStateAction<'AND' | 'OR'>>;
  viewType: 'grouped' | 'flat';
  onViewTypeChange: (viewType: 'grouped' | 'flat') => void;
  modal?: boolean;
  onClose?: () => void;
}

const FIELD_OPTIONS = [
  { label: 'Task ID', value: 'taskId', isNumeric: true },
  { label: 'Contract ID', value: 'contractId', isNumeric: false },
  { label: 'Obligation Title', value: 'obligationTitle', isNumeric: false },
  { label: 'Category', value: 'category', isNumeric: false },
  { label: 'Domain', value: 'domain', isNumeric: false },
  { label: 'Subdomain', value: 'subdomain', isNumeric: false },
  { label: 'Criticality', value: 'criticality', isNumeric: false },
  { label: 'Owner', value: 'owner', isNumeric: false },
  { label: 'Triggered Tasks', value: 'triggeredTasks', isNumeric: true },
  { label: 'Open Tasks', value: 'openTasks', isNumeric: true },
  { label: 'Compliance', value: 'compliance', isNumeric: false },
];

const TableSidebar: React.FC<TableSidebarProps> = ({
  columns,
  visibleColumns,
  pendingVisibleColumns,
  setPendingVisibleColumns,
  onExpandAll,
  onCollapseAll,
  isTransposed,
  setIsTransposed,
  onApply,
  onReset,
  sortRules,
  setSortRules,
  filters,
  setFilters,
  condition,
  setCondition,
  viewType,
  onViewTypeChange,
  modal = false,
  onClose,
}) => {
  const handleToggleColumn = (colId: string) => {
    setPendingVisibleColumns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(colId)) newSet.delete(colId);
      else newSet.add(colId);
      return newSet;
    });
  };

  // Switch style for transpose
  const switchTrack = {
    width: 36,
    height: 20,
    borderRadius: 12,
    background: isTransposed ? '#2563eb' : '#e5e7eb',
    position: 'relative' as const,
    transition: 'background 0.2s',
    cursor: 'pointer',
    display: 'inline-block',
    marginRight: 8,
    verticalAlign: 'middle',
  };
  const switchThumb = {
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#fff',
    position: 'absolute' as const,
    top: 2,
    left: isTransposed ? 18 : 2,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    transition: 'left 0.2s',
  };

  // Modal overlay and container styles
  const overlayStyle = modal
    ? {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.12)',
        zIndex: 1000,
      }
    : {};
  const modalStyle = modal
    ? {
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 1.5px 4px rgba(0,0,0,0.08)',
        maxWidth: 340,
        width: 340,
        padding: 0,
        position: 'fixed' as const,
        right: 0,
        top: 0,
        height: '100vh',
        overflow: 'hidden',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column' as const,
        zIndex: 1001,
      }
    : {};

  // Sorting drag state
  const [dragState, setDragState] = React.useState<{ isDragging: boolean; dragIndex: number | null; dragOverIndex: number | null }>({
    isDragging: false,
    dragIndex: null,
    dragOverIndex: null,
  });

  const handleAddSort = () => {
    setSortRules([...sortRules, { field: '', order: 'asc' }]);
  };
  const handleRemoveSort = (index: number) => {
    if (sortRules.length === 1) {
      setSortRules([{ field: '', order: 'asc' }]);
    } else {
      setSortRules(sortRules.filter((_, i) => i !== index));
    }
  };
  const handleSortChange = (index: number, field: string, value: any) => {
    const newRules = [...sortRules];
    newRules[index] = { ...newRules[index], [field]: value };
    setSortRules(newRules);
  };
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragState({ isDragging: true, dragIndex: index, dragOverIndex: null });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragState((prev) => ({ ...prev, dragOverIndex: index }));
  };
  const handleDragLeave = () => {
    setDragState((prev) => ({ ...prev, dragOverIndex: null }));
  };
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const { dragIndex } = dragState;
    if (dragIndex !== null && dragIndex !== dropIndex) {
      const newRules = [...sortRules];
      const draggedItem = newRules[dragIndex];
      newRules.splice(dragIndex, 1);
      newRules.splice(dropIndex, 0, draggedItem);
      setSortRules(newRules);
    }
    setDragState({ isDragging: false, dragIndex: null, dragOverIndex: null });
  };
  const handleDragEnd = () => {
    setDragState({ isDragging: false, dragIndex: null, dragOverIndex: null });
  };
  const isNumericField = (fieldValue: string) => {
    const field = FIELD_OPTIONS.find((option) => option.value === fieldValue);
    return field?.isNumeric || false;
  };

  const getOperatorOptions = (field: string) => {
    if (field === 'triggeredTasks' || field === 'openTasks' || field === 'taskId' || field === 'contractId') {
      return [
        { label: 'equals', value: 'is' },
        { label: 'greater than', value: 'greaterThan' },
        { label: 'less than', value: 'lessThan' },
        { label: 'greater than or equal', value: 'greaterThanOrEqual' },
        { label: 'less than or equal', value: 'lessThanOrEqual' },
        { label: 'range', value: 'range' },
      ];
    } else {
      return [
        { label: 'is', value: 'is' },
        { label: 'is not', value: 'isNot' },
        { label: 'contains', value: 'contains' },
        { label: 'is empty', value: 'isEmpty' },
        { label: 'is not empty', value: 'isNotEmpty' },
      ];
    }
  };
  const handleAddFilter = () => setFilters([...filters, { field: '', operator: 'is', value: '' }]);
  const handleRemoveFilter = (index: number) => {
    if (filters.length > 1) setFilters(filters.filter((_, i) => i !== index));
  };
  const handleFilterChange = (index: number, field: string, value: any) => {
    const newFilters = [...filters];
    if (field === 'logic') {
      newFilters[index].logic = value;
    } else {
      newFilters[index] = { ...newFilters[index], [field]: value };
      if (field === 'field') {
        newFilters[index].operator = isNumericField(value) ? 'is' : 'is';
        newFilters[index].value = '';
      }
    }
    setFilters(newFilters);
  };
  const handleClearFilters = () => {
    setFilters([{ field: '', operator: 'is', value: '' }]);
    setCondition('AND');
  };
  const handleApplyFilters = () => {
    const filterState: any = { condition, filters: {} };
    filters.forEach((filter) => {
      if (filter.field && (filter.value || filter.operator === 'isEmpty' || filter.operator === 'isNotEmpty')) {
        let value = filter.value;
        if (filter.operator === 'range' && Array.isArray(value)) {
          value = [Number(value[0]), Number(value[1])];
        }
        (filterState.filters as any)[filter.field] = {
          operator: filter.operator,
          value,
        };
      }
    });
    if (typeof onApply === 'function') onApply(filterState);
  };

  return (
    <>
      {modal && <div style={overlayStyle} onClick={onClose} />}
      <div
        style={modal ? modalStyle : {}}
        className={modal ? '' : 'transition-all duration-300'}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button for modal */}
        {modal && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'none',
              border: 'none',
              fontSize: 22,
              color: '#6b7280',
              cursor: 'pointer',
              zIndex: 2,
            }}
            aria-label="Close"
          >
            ×
          </button>
        )}
        <div style={{ padding: '28px 28px 0 28px', borderBottom: '1px solid #f1f1f1', fontWeight: 700, fontSize: 20, color: '#222', letterSpacing: 0.1 }}>
          Table Controls
          <div style={{ fontWeight: 400, fontSize: 14, color: '#6b7280', marginTop: 4 }}>Configure your data view</div>
        </div>
        <div style={{ padding: '20px 28px 0 28px', overflowY: 'auto', flex: 1 }}>
          {/* Sort Tasks */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Sort Tasks
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sortRules.map((rule, index) => (
                <div
                  key={index}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  style={{
                    background:
                      dragState.dragIndex === index ? '#f3f4f6' : dragState.dragOverIndex === index ? '#e5e7eb' : 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '10px',
                    transition: 'all 0.2s ease',
                    boxShadow: dragState.dragIndex === index ? '0 4px 8px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'move',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ cursor: 'grab', color: '#9ca3af', fontSize: 18, userSelect: 'none' }}>≡</span>
                  <select
                    value={rule.field}
                    onChange={(e) => handleSortChange(index, 'field', e.target.value)}
                    style={{ flex: '1 1 0', minWidth: 0, maxWidth: 120, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white', outline: 'none' }}
                  >
                    <option value="">Select field</option>
                    {FIELD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={rule.order}
                    onChange={(e) => handleSortChange(index, 'order', e.target.value)}
                    style={{ flex: '1 1 0', minWidth: 0, maxWidth: 120, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white', outline: 'none' }}
                  >
                    {rule.field === 'contractId' ? (
                      <>
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                      </>
                    ) : isNumericField(rule.field) ? (
                      <>
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                      </>
                    ) : (
                      <>
                        <option value="asc">A to Z</option>
                        <option value="desc">Z to A</option>
                      </>
                    )}
                  </select>
                  <div style={{ flex: '0 0 36px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleRemoveSort(index)}
                      disabled={sortRules.length === 1}
                      style={{ width: 36, height: 36, padding: 0, border: 'none', borderRadius: '50%', backgroundColor: 'transparent', color: '#6b7280', cursor: sortRules.length === 1 ? 'not-allowed' : 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Remove sort"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={handleAddSort}
                style={{
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginTop: 4,
                }}
              >
                + Add Sort
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <button
                onClick={() => setSortRules([{ field: '', order: 'asc' }])}
                style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
              >
                Clear All
              </button>
            <button
                onClick={onApply}
                style={{ background: '#2563eb', color: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 16px', fontWeight: 500, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.08)' }}
            >
                Apply Sort
            </button>
            </div>
          </div>
          {/* Filtering */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Filter Tasks
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filters.map((filter, index) => (
                <React.Fragment key={index}>
                  {index > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', margin: '2px 0 2px 0' }}>
                      <select
                        value={filter.logic || 'AND'}
                        onChange={e => handleFilterChange(index, 'logic', e.target.value)}
                        style={{
                          width: 60,
                          padding: '4px 8px',
                          border: '1.5px solid #d1d5db',
                          borderRadius: 7,
                          fontWeight: 500,
                          fontSize: 14,
                          color: '#222',
                          background: '#fff',
                          outline: 'none',
                          marginBottom: 0,
                          fontFamily: 'inherit',
                        }}
                      >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>
                    </div>
                  )}
                  <div style={{ marginBottom: 4, background: '#fff', borderRadius: 8, boxShadow: 'none', padding: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <select
                        value={filter.field}
                        onChange={e => handleFilterChange(index, 'field', e.target.value)}
                        style={{ flex: 1, padding: '8px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, backgroundColor: 'white', outline: 'none', minWidth: 0 }}
                      >
                        <option value="">Select field</option>
                        {FIELD_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <select
                        value={filter.operator}
                        onChange={e => handleFilterChange(index, 'operator', e.target.value)}
                        style={{ flex: 1, padding: '8px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, backgroundColor: 'white', outline: 'none', minWidth: 0 }}
                      >
                        {getOperatorOptions(filter.field).map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <div style={{ flex: '0 0 20px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleRemoveFilter(index)}
                          disabled={filters.length === 1}
                          style={{ width: 20, height: 20, padding: 0, border: 'none', borderRadius: '50%', backgroundColor: 'transparent', color: filters.length === 1 ? '#9ca3af' : '#6b7280', cursor: filters.length === 1 ? 'not-allowed' : 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Remove filter"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {filter.operator === 'isEmpty' || filter.operator === 'isNotEmpty' ? (
                      <div style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, color: '#6b7280', backgroundColor: '#f9fafb', fontStyle: 'italic', marginBottom: 0 }}>No value needed</div>
                    ) : filter.operator === 'range' && (filter.field === 'taskId' || filter.field === 'triggeredTasks' || filter.field === 'openTasks' || filter.field === 'contractId') ? (
                      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  
                          <input
                            type="number"
                            value={Array.isArray(filter.value) ? filter.value[0] || '' : ''}
                            onChange={e => handleFilterChange(index, 'value', [e.target.value, Array.isArray(filter.value) ? filter.value[1] : ''])}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none' }}
                            min="0"
                            placeholder="From"
                          />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          
                          <input
                            type="number"
                            value={Array.isArray(filter.value) ? filter.value[1] || '' : ''}
                            onChange={e => handleFilterChange(index, 'value', [Array.isArray(filter.value) ? filter.value[0] : '', e.target.value])}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none' }}
                            min="0"
                            placeholder="To"
                          />
                        </div>
                      </div>
                    ) : isNumericField(filter.field) ? (
                      <input
                        type="number"
                        value={filter.value as string}
                        onChange={e => handleFilterChange(index, 'value', e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, outline: 'none', marginBottom: 0 }}
                        min="0"
                        placeholder="Enter value"
                      />
                    ) : (
                      <input
                        type="text"
                        value={filter.value as string}
                        onChange={e => handleFilterChange(index, 'value', e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, outline: 'none', marginBottom: 0 }}
                        placeholder="Enter value"
                      />
                    )}
                  </div>
                </React.Fragment>
              ))}
              <button
                onClick={handleAddFilter}
                style={{ width: '100%', padding: '10px 0', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 500, color: '#374151', marginTop: 0, marginBottom: 0 }}
              >
                + Add Filter
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              <button
                onClick={handleClearFilters}
                style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
              >
                Clear All
              </button>
            <button
                onClick={handleApplyFilters}
                style={{ background: '#2563eb', color: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 16px', fontWeight: 500, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.08)' }}
            >
                Apply Filters
            </button>
            </div>
          </div>
          {/* Row Operations */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Row Operations
            </div>
            <button
              onClick={onExpandAll}
              style={{ width: '100%', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 500, fontSize: 14, marginBottom: 8, cursor: 'pointer' }}
            >
              Expand All
            </button>
            <button
              onClick={onCollapseAll}
              style={{ width: '100%', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 500, fontSize: 14, marginBottom: 0, cursor: 'pointer' }}
            >
              Collapse All
            </button>
          </div>
          {/* View Type */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              View Type
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, cursor: 'pointer', fontWeight: 500 }}>
                <input
                  type="radio"
                  name="viewType"
                  value="grouped"
                  checked={viewType === 'grouped'}
                  onChange={() => onViewTypeChange('grouped')}
                  style={{ accentColor: '#2563eb' }}
                />
                Grouped View
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, cursor: 'pointer', fontWeight: 500 }}>
                <input
                  type="radio"
                  name="viewType"
                  value="flat"
                  checked={viewType === 'flat'}
                  onChange={() => onViewTypeChange('flat')}
                  style={{ accentColor: '#2563eb' }}
                />
                Flat View
              </label>
            </div>
          </div>
          {/* Column Visibility */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Column Visibility
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {columns.filter(col => col.id !== 'expand').map(col => (
                <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, cursor: 'pointer', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={pendingVisibleColumns.has(col.id)}
                    onChange={() => handleToggleColumn(col.id)}
                    style={{ accentColor: '#2563eb', width: 16, height: 16 }}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>
          {/* Transpose Table */}
          <div style={{ marginBottom: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Transpose Table
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 500, cursor: viewType === 'flat' ? 'pointer' : 'not-allowed', opacity: viewType === 'flat' ? 1 : 0.5 }}>
              <span style={{ ...switchTrack, pointerEvents: viewType === 'flat' ? 'auto' : 'none' }} onClick={() => viewType === 'flat' && setIsTransposed(!isTransposed)}>
                <span style={switchThumb} />
              </span>
              Transpose Table
            </label>
          </div>
        </div>
        {/* Footer */}
        <div style={{ borderTop: '1px solid #f1f1f1', padding: '16px 28px', display: 'flex', justifyContent: 'flex-end', gap: 12, background: '#fff' }}>
          <button
            onClick={onReset}
            style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
          >
            Reset
          </button>
          <button
            onClick={onApply}
            style={{ background: '#2563eb', color: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 16px', fontWeight: 500, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.08)' }}
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
};

export default TableSidebar; 