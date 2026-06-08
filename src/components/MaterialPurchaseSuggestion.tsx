import { useState, useMemo, useEffect } from 'react';
import type {
  RestorationProject,
  PurchaseSuggestion,
  SavedPurchaseSuggestion,
  PurchaseStatus,
  StockInDraft,
  StockInTemplate,
} from '../types';
import { PURCHASE_STATUS_LABELS } from '../types';
import {
  generatePurchaseSuggestions,
  filterAndSortSuggestions,
  generateSavedSuggestion,
} from '../utils/purchaseSuggestion';
import {
  getPurchaseSuggestions,
  addPurchaseSuggestion,
  deletePurchaseSuggestion,
  getStockInTemplates,
  addStockInRecord,
  batchMarkSuggestionsAsConverted,
} from '../utils/storage';

interface MaterialPurchaseSuggestionProps {
  projects: RestorationProject[];
  onSelectProject: (project: RestorationProject) => void;
}

type SortField = 'status' | 'name' | 'currentStock' | 'shortageDate' | 'suggestedQuantity';
type SortOrder = 'asc' | 'desc';
type FilterType = 'all' | PurchaseStatus;
type ViewMode = 'current' | 'history';

const DEFAULT_PERIOD_DAYS = 30;
const DEFAULT_RECENT_DAYS = 60;
const DEFAULT_SAFETY_BUFFER = 1.2;

export default function MaterialPurchaseSuggestion({
  projects,
  onSelectProject,
}: MaterialPurchaseSuggestionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('current');
  const [suggestions, setSuggestions] = useState<PurchaseSuggestion[]>([]);
  const [savedSuggestions, setSavedSuggestions] = useState<SavedPurchaseSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<PurchaseSuggestion | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [periodDays, setPeriodDays] = useState(DEFAULT_PERIOD_DAYS);
  const [recentDays, setRecentDays] = useState(DEFAULT_RECENT_DAYS);
  const [safetyBuffer, setSafetyBuffer] = useState(DEFAULT_SAFETY_BUFFER);
  const [showSettings, setShowSettings] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedSuggestionKeys, setSelectedSuggestionKeys] = useState<Set<string>>(new Set());
  const [showStockInDraft, setShowStockInDraft] = useState(false);
  const [stockInDrafts, setStockInDrafts] = useState<StockInDraft[]>([]);
  const [stockInTemplates, setStockInTemplates] = useState<StockInTemplate[]>([]);
  const [showSelectAllWarning, setShowSelectAllWarning] = useState(false);
  const [fromSavedSuggestionId, setFromSavedSuggestionId] = useState<string | null>(null);

  useEffect(() => {
    refreshSavedSuggestions();
    generateSuggestions();
    setStockInTemplates(getStockInTemplates());
  }, [projects]);

  const refreshSavedSuggestions = () => {
    setSavedSuggestions(getPurchaseSuggestions());
  };

  const getSuggestionKey = (suggestion: PurchaseSuggestion): string => {
    return `${suggestion.name}-${suggestion.unit}`;
  };

  const handleSelectSuggestion = (suggestion: PurchaseSuggestion, checked: boolean) => {
    const key = getSuggestionKey(suggestion);
    setSelectedSuggestionKeys(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const purchasableSuggestions = filteredAndSortedSuggestions.filter(
      s => s.suggestedPurchaseQuantity > 0 && !s.convertedToStockIn
    );
    
    if (purchasableSuggestions.length > 50) {
      setShowSelectAllWarning(true);
      return;
    }

    const allSelected = purchasableSuggestions.every(s => 
      selectedSuggestionKeys.has(getSuggestionKey(s))
    );

    if (allSelected) {
      setSelectedSuggestionKeys(new Set());
    } else {
      const keys = new Set(purchasableSuggestions.map(getSuggestionKey));
      setSelectedSuggestionKeys(keys);
    }
  };

  const confirmSelectAll = () => {
    const purchasableSuggestions = filteredAndSortedSuggestions.filter(
      s => s.suggestedPurchaseQuantity > 0 && !s.convertedToStockIn
    );
    const keys = new Set(purchasableSuggestions.map(getSuggestionKey));
    setSelectedSuggestionKeys(keys);
    setShowSelectAllWarning(false);
  };

  const getSelectedSuggestions = (): PurchaseSuggestion[] => {
    return filteredAndSortedSuggestions.filter(s => 
      selectedSuggestionKeys.has(getSuggestionKey(s)) && !s.convertedToStockIn
    );
  };

  const findMatchingTemplate = (suggestion: PurchaseSuggestion): StockInTemplate | undefined => {
    return stockInTemplates.find(
      t => t.name === suggestion.name && t.unit === suggestion.unit
    );
  };

  const handleGenerateStockInDrafts = () => {
    const selected = getSelectedSuggestions();
    if (selected.length === 0) {
      setMessage({ type: 'error', text: '请先选择要生成入库草稿的材料' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const drafts: StockInDraft[] = selected.map(suggestion => {
      const template = findMatchingTemplate(suggestion);
      return {
        name: suggestion.name,
        unit: suggestion.unit,
        suggestedQuantity: suggestion.suggestedPurchaseQuantity,
        quantity: suggestion.suggestedPurchaseQuantity,
        unitPrice: template?.defaultUnitPrice,
        supplier: template?.supplier,
        note: template?.note,
        templateId: template?.id,
        date: new Date().toISOString().split('T')[0],
        suggestionReference: {
          status: suggestion.status,
          suggestedPurchaseDate: suggestion.suggestedPurchaseDate,
          shortageDate: suggestion.shortageDate,
        },
      };
    });

    setStockInDrafts(drafts);
    setFromSavedSuggestionId(null);
    setShowStockInDraft(true);
  };

  const handleGenerateStockInFromSaved = (saved: SavedPurchaseSuggestion) => {
    const purchasableItems = saved.suggestions.filter(
      s => s.suggestedPurchaseQuantity > 0 && !s.convertedToStockIn
    );

    if (purchasableItems.length === 0) {
      setMessage({ type: 'error', text: '该历史建议中没有可转为入库的条目' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const drafts: StockInDraft[] = purchasableItems.map(suggestion => {
      const template = findMatchingTemplate(suggestion);
      return {
        name: suggestion.name,
        unit: suggestion.unit,
        suggestedQuantity: suggestion.suggestedPurchaseQuantity,
        quantity: suggestion.suggestedPurchaseQuantity,
        unitPrice: template?.defaultUnitPrice,
        supplier: template?.supplier,
        note: template?.note,
        templateId: template?.id,
        date: new Date().toISOString().split('T')[0],
        suggestionReference: {
          status: suggestion.status,
          suggestedPurchaseDate: suggestion.suggestedPurchaseDate,
          shortageDate: suggestion.shortageDate,
        },
      };
    });

    setStockInDrafts(drafts);
    setFromSavedSuggestionId(saved.id);
    setShowStockInDraft(true);
  };

  const updateDraft = (index: number, updates: Partial<StockInDraft>) => {
    setStockInDrafts(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const removeDraft = (index: number) => {
    setStockInDrafts(prev => prev.filter((_, i) => i !== index));
  };

  const handleTemplateSelectForDraft = (draftIndex: number, templateId: string) => {
    if (!templateId) {
      updateDraft(draftIndex, {
        templateId: undefined,
        supplier: undefined,
        unitPrice: undefined,
        note: undefined,
      });
      return;
    }

    const template = stockInTemplates.find(t => t.id === templateId);
    if (template) {
      const draft = stockInDrafts[draftIndex];
      if (template.unit !== draft.unit) {
        setMessage({
          type: 'error',
          text: `模板单位「${template.unit}」与材料单位「${draft.unit}」不匹配`,
        });
        setTimeout(() => setMessage(null), 3000);
        return;
      }

      updateDraft(draftIndex, {
        templateId,
        supplier: template.supplier,
        unitPrice: template.defaultUnitPrice,
        note: template.note || draft.note,
      });
    }
  };

  const handleConfirmStockIn = () => {
    const invalidDrafts = stockInDrafts.filter(d => d.quantity <= 0);
    if (invalidDrafts.length > 0) {
      setMessage({ type: 'error', text: '请确保所有入库数量都大于0' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const results: Array<{ name: string; unit: string; stockInRecordId: string }> = [];
    let hasError = false;

    stockInDrafts.forEach(draft => {
      const result = addStockInRecord(draft.name, draft.unit, {
        date: draft.date,
        quantity: draft.quantity,
        unitPrice: draft.unitPrice,
        supplier: draft.supplier || undefined,
        note: draft.note || undefined,
      });

      if (result.success && result.record) {
        results.push({
          name: draft.name,
          unit: draft.unit,
          stockInRecordId: result.record.id,
        });
      } else {
        hasError = true;
      }
    });

    if (hasError) {
      setMessage({ type: 'error', text: '部分入库记录添加失败，请检查' });
      setTimeout(() => setMessage(null), 3000);
    }

    if (results.length > 0) {
      if (fromSavedSuggestionId) {
        batchMarkSuggestionsAsConverted(fromSavedSuggestionId, results);
      }
      
      setSelectedSuggestionKeys(new Set());
      setShowStockInDraft(false);
      setStockInDrafts([]);
      setFromSavedSuggestionId(null);
      refreshSavedSuggestions();
      generateSuggestions();
      
      setMessage({ 
        type: 'success', 
        text: `成功添加 ${results.length} 条入库记录` 
      });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const generateSuggestions = () => {
    const result = generatePurchaseSuggestions(projects, {
      periodDays,
      recentDays,
      safetyBuffer,
    });
    setSuggestions(result);
    setMessage(null);
  };

  const handleRecalculate = () => {
    generateSuggestions();
    setMessage({ type: 'success', text: '采购建议已重新计算' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSaveSuggestions = () => {
    if (suggestions.length === 0) {
      setMessage({ type: 'error', text: '没有可保存的采购建议' });
      return;
    }
    const saved = generateSavedSuggestion(suggestions, periodDays, noteText || undefined);
    addPurchaseSuggestion(saved);
    refreshSavedSuggestions();
    setShowSaveDialog(false);
    setNoteText('');
    setMessage({ type: 'success', text: '采购建议已保存' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteSaved = (id: string) => {
    if (!window.confirm('确定要删除这条历史建议吗？')) return;
    const result = deletePurchaseSuggestion(id);
    if (result.success) {
      refreshSavedSuggestions();
      setMessage({ type: 'success', text: '历史建议已删除' });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: result.error || '删除失败' });
    }
  };

  const loadSavedSuggestion = (saved: SavedPurchaseSuggestion) => {
    setSuggestions(saved.suggestions);
    setViewMode('current');
    setMessage({ type: 'success', text: `已加载 ${new Date(saved.generatedAt).toLocaleDateString()} 的采购建议` });
    setTimeout(() => setMessage(null), 3000);
  };

  const filteredAndSortedSuggestions = useMemo(() => {
    return filterAndSortSuggestions(
      suggestions,
      { status: filterType, searchTerm },
      { by: sortField, order: sortOrder }
    );
  }, [suggestions, filterType, searchTerm, sortField, sortOrder]);

  const stats = useMemo(() => {
    const totalTypes = suggestions.length;
    const urgentCount = suggestions.filter(s => s.status === 'urgent').length;
    const needPurchaseCount = suggestions.filter(s => s.status === 'need_purchase').length;
    const noDataCount = suggestions.filter(s => s.status === 'no_data').length;
    const excessCount = suggestions.filter(s => s.status === 'excess').length;
    const normalCount = suggestions.filter(s => s.status === 'normal').length;

    const totalSuggestedQuantity = suggestions.reduce((sum, s) => sum + s.suggestedPurchaseQuantity, 0);
    const urgentQuantity = suggestions
      .filter(s => s.status === 'urgent')
      .reduce((sum, s) => sum + s.suggestedPurchaseQuantity, 0);

    return {
      totalTypes,
      urgentCount,
      needPurchaseCount,
      noDataCount,
      excessCount,
      normalCount,
      totalSuggestedQuantity: Math.round(totalSuggestedQuantity * 100) / 100,
      urgentQuantity: Math.round(urgentQuantity * 100) / 100,
    };
  }, [suggestions]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const formatQuantity = (num: number): string => {
    if (num === 0) return '0';
    if (Number.isInteger(num)) return num.toString();
    return num.toFixed(2).replace(/\.?0+$/, '');
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
  };

  const getStatusBadgeClass = (status: PurchaseStatus): string => {
    switch (status) {
      case 'urgent': return 'purchase-status urgent';
      case 'need_purchase': return 'purchase-status need-purchase';
      case 'normal': return 'purchase-status normal';
      case 'excess': return 'purchase-status excess';
      case 'no_data': return 'purchase-status no-data';
      default: return 'purchase-status normal';
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon active">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const renderDaysLeft = (days: number) => {
    if (days >= 999) {
      return <span className="days-left unlimited">充足</span>;
    }
    if (days <= 0) {
      return <span className="days-left critical">已耗尽</span>;
    }
    return (
      <span className={`days-left ${days <= 7 ? 'warning' : ''}`}>
        ~{days}天
      </span>
    );
  };

  return (
    <>
      <div className="purchase-container project-list-container">
        <div className="purchase-header list-toolbar">
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'current' ? 'active' : ''}`}
              onClick={() => setViewMode('current')}
            >
              📊 当前建议
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'history' ? 'active' : ''}`}
              onClick={() => setViewMode('history')}
            >
              📁 历史记录
            </button>
          </div>

          {viewMode === 'current' && (
            <>
              <div className="search-box">
                <input
                  type="text"
                  placeholder="搜索材料名称或单位..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="filter-box">
                <select value={filterType} onChange={(e) => setFilterType(e.target.value as FilterType)}>
                  <option value="all">全部状态</option>
                  <option value="urgent">紧急采购</option>
                  <option value="need_purchase">需要采购</option>
                  <option value="normal">库存充足</option>
                  <option value="excess">库存过剩</option>
                  <option value="no_data">数据不足</option>
                </select>
              </div>

              <div className="action-buttons">
                <button className="btn btn-secondary" onClick={() => setShowSettings(!showSettings)}>
                  ⚙ 计算设置
                </button>
                <button className="btn btn-secondary" onClick={handleRecalculate}>
                  🔄 重新计算
                </button>
                <button className="btn btn-primary" onClick={() => setShowSaveDialog(true)}>
                  💾 保存建议
                </button>
              </div>

              {viewMode === 'current' && filteredAndSortedSuggestions.some(s => s.suggestedPurchaseQuantity > 0 && !s.convertedToStockIn) && (
                <div className="batch-actions">
                  <label className="select-all-container">
                    <input
                      type="checkbox"
                      checked={filteredAndSortedSuggestions.filter(s => s.suggestedPurchaseQuantity > 0 && !s.convertedToStockIn).length > 0 && 
                        filteredAndSortedSuggestions.filter(s => s.suggestedPurchaseQuantity > 0 && !s.convertedToStockIn).every(s => selectedSuggestionKeys.has(getSuggestionKey(s)))}
                      onChange={handleSelectAll}
                    />
                    <span>全选需采购</span>
                  </label>
                  <button
                    className="btn btn-success"
                    onClick={handleGenerateStockInDrafts}
                    disabled={selectedSuggestionKeys.size === 0}
                  >
                    📦 生成入库草稿 ({selectedSuggestionKeys.size})
                  </button>
                </div>
              )}
            </>
          )}

          {viewMode === 'current' && (
            <div className="purchase-stats">
              <div className="purchase-stat">
                <span className="stat-value">{stats.totalTypes}</span>
                <span className="stat-label">材料种类</span>
              </div>
              {stats.urgentCount > 0 && (
                <div className="purchase-stat urgent">
                  <span className="stat-value">{stats.urgentCount}</span>
                  <span className="stat-label">紧急采购</span>
                </div>
              )}
              {stats.needPurchaseCount > 0 && (
                <div className="purchase-stat need-purchase">
                  <span className="stat-value">{stats.needPurchaseCount}</span>
                  <span className="stat-label">需要采购</span>
                </div>
              )}
              {stats.noDataCount > 0 && (
                <div className="purchase-stat no-data">
                  <span className="stat-value">{stats.noDataCount}</span>
                  <span className="stat-label">数据不足</span>
                </div>
              )}
              {stats.excessCount > 0 && (
                <div className="purchase-stat excess">
                  <span className="stat-value">{stats.excessCount}</span>
                  <span className="stat-label">库存过剩</span>
                </div>
              )}
              <div className="purchase-stat normal">
                <span className="stat-value">{stats.normalCount}</span>
                <span className="stat-label">库存充足</span>
              </div>
              {stats.totalSuggestedQuantity > 0 && (
                <div className="purchase-stat">
                  <span className="stat-value">{formatQuantity(stats.totalSuggestedQuantity)}</span>
                  <span className="stat-label">建议采购总量</span>
                </div>
              )}
            </div>
          )}

          <div className="result-count">
            {viewMode === 'current'
              ? `共 ${filteredAndSortedSuggestions.length} 条记录`
              : `共 ${savedSuggestions.length} 条历史记录`}
          </div>
        </div>

        {viewMode === 'current' && showSettings && (
          <div className="settings-panel">
            <h4>计算参数设置</h4>
            <div className="form-row">
              <div className="form-group">
                <label>预测周期 (天)</label>
                <input
                  type="number"
                  value={periodDays}
                  onChange={(e) => setPeriodDays(parseInt(e.target.value) || DEFAULT_PERIOD_DAYS)}
                  min="7"
                  max="180"
                />
              </div>
              <div className="form-group">
                <label>历史消耗统计天数</label>
                <input
                  type="number"
                  value={recentDays}
                  onChange={(e) => setRecentDays(parseInt(e.target.value) || DEFAULT_RECENT_DAYS)}
                  min="7"
                  max="365"
                />
              </div>
              <div className="form-group">
                <label>安全库存系数</label>
                <input
                  type="number"
                  value={safetyBuffer}
                  onChange={(e) => setSafetyBuffer(parseFloat(e.target.value) || DEFAULT_SAFETY_BUFFER)}
                  min="1"
                  max="3"
                  step="0.1"
                />
              </div>
            </div>
            <div className="form-actions-inline">
              <button className="btn btn-primary" onClick={handleRecalculate}>应用并重新计算</button>
              <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>关闭</button>
            </div>
          </div>
        )}

        {message && (
          <div className={`message-banner ${message.type}`}>
            {message.text}
          </div>
        )}

        {viewMode === 'current' && (
          <div className="table-container">
            <table className="project-table purchase-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>
                    选择
                  </th>
                  <th onClick={() => handleSort('status')} className="sortable">
                    状态 <SortIcon field="status" />
                  </th>
                  <th onClick={() => handleSort('name')} className="sortable">
                    材料名称 <SortIcon field="name" />
                  </th>
                  <th>单位</th>
                  <th onClick={() => handleSort('currentStock')} className="sortable">
                    当前库存 <SortIcon field="currentStock" />
                  </th>
                  <th>最低库存</th>
                  <th>日均消耗</th>
                  <th>已排程需求</th>
                  <th>预计可用</th>
                  <th onClick={() => handleSort('shortageDate')} className="sortable">
                    预计缺货 <SortIcon field="shortageDate" />
                  </th>
                  <th onClick={() => handleSort('suggestedQuantity')} className="sortable">
                    建议采购 <SortIcon field="suggestedQuantity" />
                  </th>
                  <th>建议采购日期</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedSuggestions.map(suggestion => {
                  const key = getSuggestionKey(suggestion);
                  const isSelected = selectedSuggestionKeys.has(key);
                  const isPurchasable = suggestion.suggestedPurchaseQuantity > 0 && !suggestion.convertedToStockIn;
                  return (<tr
                    key={key}
                    className={`project-row purchase-row status-${suggestion.status} ${suggestion.convertedToStockIn ? 'converted' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest('input[type="checkbox"]')) {
                        setSelectedSuggestion(suggestion);
                      }
                    }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!isPurchasable}
                        onChange={(e) => handleSelectSuggestion(suggestion, e.target.checked)}
                      />
                    </td>
                    <td>
                      <span className={getStatusBadgeClass(suggestion.status)}>
                        {PURCHASE_STATUS_LABELS[suggestion.status]}
                      </span>
                      {suggestion.convertedToStockIn && (
                        <span className="converted-badge" title={`已于 ${new Date(suggestion.convertedAt!).toLocaleDateString()} 转为入库`}>
                          ✓ 已入库
                        </span>
                      )}
                      {suggestion.warnings.length > 0 && (
                        <span className="warning-indicator" title={suggestion.warnings.join('\n')}>
                          ⚠️
                        </span>
                      )}
                    </td>
                    <td className="title-cell">
                      <span className="material-name">{suggestion.name}</span>
                    </td>
                    <td>{suggestion.unit}</td>
                    <td>
                      <span className={`quantity-value ${suggestion.status === 'urgent' ? 'critical' : ''}`}>
                        {formatQuantity(suggestion.currentStock)}
                      </span>
                    </td>
                    <td>
                      <span className="minimum-stock">{formatQuantity(suggestion.minimumStock)}</span>
                    </td>
                    <td>
                      <span className="consumption-rate">
                        {suggestion.hasHistoryConsumption
                          ? `${formatQuantity(suggestion.recentConsumptionRate)}/天`
                          : <span className="no-history">无历史</span>}
                      </span>
                    </td>
                    <td>
                      <span className="scheduled-usage">
                        {suggestion.totalScheduledUsage > 0
                          ? formatQuantity(suggestion.totalScheduledUsage)
                          : '-'}
                      </span>
                    </td>
                    <td>{renderDaysLeft(suggestion.estimatedDaysLeft)}</td>
                    <td>
                      {suggestion.shortageDate ? (
                        <span className={`shortage-date ${suggestion.status === 'urgent' ? 'critical' : ''}`}>
                          {formatDate(suggestion.shortageDate)}
                        </span>
                      ) : (
                        <span className="no-shortage">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`suggested-quantity ${suggestion.suggestedPurchaseQuantity > 0 ? 'highlight' : ''}`}>
                        {suggestion.suggestedPurchaseQuantity > 0
                          ? formatQuantity(suggestion.suggestedPurchaseQuantity)
                          : '-'}
                      </span>
                    </td>
                    <td>
                      {suggestion.suggestedPurchaseDate ? (
                        <span className="purchase-date">
                          {formatDate(suggestion.suggestedPurchaseDate)}
                        </span>
                      ) : (
                        <span className="no-purchase">-</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredAndSortedSuggestions.length === 0 && (
              <div className="empty-list">
                <p>没有找到匹配的采购建议</p>
              </div>
            )}
          </div>
        )}

        {viewMode === 'history' && (
          <div className="history-list">
            {savedSuggestions.length === 0 ? (
              <div className="empty-list">
                <p>暂无历史采购建议记录</p>
              </div>
            ) : (
              <div className="history-grid">
                {savedSuggestions.map(saved => {
                  const convertedCount = saved.suggestions.filter(s => s.convertedToStockIn).length;
                  const purchasableCount = saved.suggestions.filter(
                    s => s.suggestedPurchaseQuantity > 0 && !s.convertedToStockIn
                  ).length;
                  return (
                  <div key={saved.id} className="history-card">
                    <div className="history-card-header">
                      <h4>{formatDate(saved.generatedAt)}</h4>
                      <span className="history-count">
                        {saved.suggestions.length} 种材料
                      </span>
                    </div>
                    <div className="history-card-body">
                      <p className="history-period">预测周期: {saved.periodDays} 天</p>
                      {saved.note && <p className="history-note">备注: {saved.note}</p>}
                      <div className="history-stats">
                        <span className="urgent-count">
                          紧急: {saved.suggestions.filter(s => s.status === 'urgent').length}
                        </span>
                        <span className="need-count">
                          需采: {saved.suggestions.filter(s => s.status === 'need_purchase').length}
                        </span>
                      </div>
                      <div className="history-conversion-stats">
                        {convertedCount > 0 && (
                          <span className="converted-count">
                            ✓ 已入库: {convertedCount}/{saved.suggestions.length}
                          </span>
                        )}
                        {purchasableCount > 0 && (
                          <span className="pending-count">
                            待入库: {purchasableCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="history-card-actions">
                      <button className="btn btn-secondary" onClick={() => loadSavedSuggestion(saved)}>
                        查看详情
                      </button>
                      {purchasableCount > 0 && (
                        <button
                          className="btn btn-success"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateStockInFromSaved(saved);
                          }}
                        >
                          📦 生成入库
                        </button>
                      )}
                      <button
                        className="btn btn-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSaved(saved.id);
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showSaveDialog && (
        <div className="modal-overlay" onClick={() => setShowSaveDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>保存采购建议</h2>
              <button className="btn btn-close" onClick={() => setShowSaveDialog(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>备注 (可选)</label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="输入备注信息..."
                  rows={3}
                />
              </div>
              <p className="save-info">
                将保存当前 {suggestions.length} 条采购建议，预测周期 {periodDays} 天
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSaveDialog(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSaveSuggestions}>确认保存</button>
            </div>
          </div>
        </div>
      )}

      {selectedSuggestion && (
        <div className="modal-overlay" onClick={() => setSelectedSuggestion(null)}>
          <div className="modal-content detail-modal large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-left">
                <h2>{selectedSuggestion.name}</h2>
                <span className={getStatusBadgeClass(selectedSuggestion.status)}>
                  {PURCHASE_STATUS_LABELS[selectedSuggestion.status]}
                </span>
              </div>
              <button className="btn btn-close" onClick={() => setSelectedSuggestion(null)}>×</button>
            </div>
            <div className="modal-body">
              {selectedSuggestion.warnings.length > 0 && (
                <div className="warnings-section">
                  <h4>⚠️ 注意事项</h4>
                  <ul>
                    {selectedSuggestion.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="detail-section">
                <h3>库存信息</h3>
                <div className="info-grid purchase-info-grid">
                  <div className="info-item">
                    <span className="info-label">当前库存</span>
                    <span className="info-value">
                      <span className={`quantity-value ${selectedSuggestion.status === 'urgent' ? 'critical' : ''}`}>
                        {formatQuantity(selectedSuggestion.currentStock)}
                      </span> {selectedSuggestion.unit}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">最低库存线</span>
                    <span className="info-value">
                      <span className="minimum-stock">{formatQuantity(selectedSuggestion.minimumStock)}</span> {selectedSuggestion.unit}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">安全库存系数</span>
                    <span className="info-value">{selectedSuggestion.stockSafetyBuffer}x</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>消耗分析</h3>
                <div className="info-grid purchase-info-grid">
                  <div className="info-item">
                    <span className="info-label">日均消耗速度</span>
                    <span className="info-value">
                      {selectedSuggestion.hasHistoryConsumption
                        ? `${formatQuantity(selectedSuggestion.recentConsumptionRate)} ${selectedSuggestion.unit}/天`
                        : <span className="no-history">无历史消耗记录</span>}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">历史统计天数</span>
                    <span className="info-value">
                      {selectedSuggestion.recentDays > 0
                        ? `${selectedSuggestion.recentDays} 天`
                        : '无'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">预测周期</span>
                    <span className="info-value">{selectedSuggestion.calculationPeriodDays} 天</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">预计可用天数</span>
                    <span className="info-value">
                      {selectedSuggestion.estimatedDaysLeft >= 999
                        ? '库存充足'
                        : selectedSuggestion.estimatedDaysLeft <= 0
                        ? '已耗尽'
                        : `约 ${selectedSuggestion.estimatedDaysLeft} 天`}
                    </span>
                  </div>
                  {selectedSuggestion.shortageDate && (
                    <div className="info-item">
                      <span className="info-label">预计缺货日期</span>
                      <span className="info-value">
                        <span className={`shortage-date ${selectedSuggestion.status === 'urgent' ? 'critical' : ''}`}>
                          {formatDate(selectedSuggestion.shortageDate)}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3>已排程项目需求 ({selectedSuggestion.scheduledProjectsUsage.length} 个)</h3>
                {selectedSuggestion.scheduledProjectsUsage.length > 0 ? (
                  <div className="related-projects-list">
                    {selectedSuggestion.scheduledProjectsUsage.map(usage => {
                      const project = projects.find(p => p.id === usage.projectId);
                      return (
                        <div
                          key={usage.projectId}
                          className="related-project-item"
                          onClick={() => {
                            if (project) {
                              setSelectedSuggestion(null);
                              onSelectProject(project);
                            }
                          }}
                        >
                          <div className="project-info-left">
                            <span className="related-project-title">{usage.projectTitle}</span>
                            {usage.scheduledDate ? (
                              <span className="scheduled-badge">
                                排期: {formatDate(usage.scheduledDate)}
                              </span>
                            ) : (
                              <span className="unscheduled-badge">未排程</span>
                            )}
                          </div>
                          <div className="project-info-right">
                            <div className="project-usage-info">
                              <span className="usage-amount">
                                预计还需: {formatQuantity(usage.estimatedQuantity)} {selectedSuggestion.unit}
                              </span>
                            </div>
                            <div className="project-meta">
                              <span className="project-progress">进度: {usage.progress}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="empty-text">暂无已排程项目需求</p>
                )}
                {selectedSuggestion.totalScheduledUsage > 0 && (
                  <div className="total-scheduled">
                    <strong>已排程项目总需求: {formatQuantity(selectedSuggestion.totalScheduledUsage)} {selectedSuggestion.unit}</strong>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h3>采购建议</h3>
                <div className="info-grid purchase-info-grid">
                  <div className="info-item important">
                    <span className="info-label">建议采购数量</span>
                    <span className="info-value">
                      <span className={`suggested-quantity ${selectedSuggestion.suggestedPurchaseQuantity > 0 ? 'highlight' : ''}`}>
                        {selectedSuggestion.suggestedPurchaseQuantity > 0
                          ? formatQuantity(selectedSuggestion.suggestedPurchaseQuantity)
                          : '无需采购'}
                      </span> {selectedSuggestion.suggestedPurchaseQuantity > 0 ? selectedSuggestion.unit : ''}
                    </span>
                  </div>
                  {selectedSuggestion.suggestedPurchaseDate && (
                    <div className="info-item">
                      <span className="info-label">建议采购日期</span>
                      <span className="info-value">
                        <span className="purchase-date">
                          {formatDate(selectedSuggestion.suggestedPurchaseDate)}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <p className="calculation-note">
                  计算时间: {formatDate(selectedSuggestion.lastCalculatedAt)} | 
                  预测周期: {selectedSuggestion.calculationPeriodDays} 天 | 
                  安全库存系数: {selectedSuggestion.stockSafetyBuffer}x
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSelectAllWarning && (
        <div className="modal-overlay" onClick={() => setShowSelectAllWarning(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>确认全选</h2>
              <button className="btn btn-close" onClick={() => setShowSelectAllWarning(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>当前有 {filteredAndSortedSuggestions.filter(s => s.suggestedPurchaseQuantity > 0 && !s.convertedToStockIn).length} 条可采购记录，确定要全部选中吗？</p>
              <p className="text-warning">建议仔细核对后再进行批量入库操作。</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSelectAllWarning(false)}>取消</button>
              <button className="btn btn-primary" onClick={confirmSelectAll}>确认全选</button>
            </div>
          </div>
        </div>
      )}

      {showStockInDraft && (
        <div className="modal-overlay" onClick={() => setShowStockInDraft(false)}>
          <div className="modal-content detail-modal large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-left">
                <h2>📦 入库草稿确认</h2>
                <span className="history-count">共 {stockInDrafts.length} 条记录</span>
              </div>
              <div className="header-actions">
                <button className="btn btn-close" onClick={() => setShowStockInDraft(false)}>×</button>
              </div>
            </div>
            <div className="modal-body">
              {message && (
                <div className={`message-banner ${message.type}`}>
                  {message.text}
                </div>
              )}

              {stockInDrafts.length === 0 ? (
                <div className="empty-list">
                  <p>没有入库草稿</p>
                </div>
              ) : (
                <div className="stock-in-drafts-container">
                  {stockInDrafts.map((draft, index) => {
                    const matchingTemplates = stockInTemplates.filter(t => t.unit === draft.unit);
                    return (
                      <div key={index} className="stock-in-draft-card">
                        <div className="draft-card-header">
                          <div className="draft-material-info">
                            <h4>{draft.name}</h4>
                            <span className="draft-unit">单位: {draft.unit}</span>
                            {draft.suggestionReference && (
                              <span className={`purchase-status ${draft.suggestionReference.status}`}>
                                {PURCHASE_STATUS_LABELS[draft.suggestionReference.status]}
                              </span>
                            )}
                          </div>
                          <button
                            className="btn-icon btn-danger"
                            onClick={() => removeDraft(index)}
                            title="移除"
                          >
                            ×
                          </button>
                        </div>

                        <div className="draft-card-body">
                          <div className="draft-suggestion-info">
                            <span className="suggested-label">建议采购量:</span>
                            <span className="suggested-value">{formatQuantity(draft.suggestedQuantity)} {draft.unit}</span>
                            {draft.suggestionReference?.suggestedPurchaseDate && (
                              <span className="suggested-date">
                                建议采购日期: {formatDate(draft.suggestionReference.suggestedPurchaseDate)}
                              </span>
                            )}
                            {draft.suggestionReference?.shortageDate && (
                              <span className={`shortage-date ${draft.suggestionReference.status === 'urgent' ? 'critical' : ''}`}>
                                预计缺货: {formatDate(draft.suggestionReference.shortageDate)}
                              </span>
                            )}
                          </div>

                          <div className="draft-form-section">
                            <div className="form-group">
                              <label>选择入库模板</label>
                              <select
                                value={draft.templateId || ''}
                                onChange={(e) => handleTemplateSelectForDraft(index, e.target.value)}
                              >
                                <option value="">-- 不使用模板 --</option>
                                {matchingTemplates.length > 0 ? (
                                  matchingTemplates.map(template => (
                                    <option key={template.id} value={template.id}>
                                      {template.name} - {template.supplier}
                                      {template.defaultUnitPrice ? ` - ¥${template.defaultUnitPrice.toFixed(2)}` : ''}
                                    </option>
                                  ))
                                ) : (
                                  <option value="" disabled>
                                    暂无「{draft.unit}」单位的模板
                                  </option>
                                )}
                              </select>
                            </div>

                            <div className="form-row">
                              <div className="form-group">
                                <label>入库日期</label>
                                <input
                                  type="date"
                                  value={draft.date}
                                  onChange={(e) => updateDraft(index, { date: e.target.value })}
                                />
                              </div>
                              <div className="form-group">
                                <label>入库数量 ({draft.unit}) *</label>
                                <input
                                  type="number"
                                  value={draft.quantity}
                                  onChange={(e) => updateDraft(index, { quantity: parseFloat(e.target.value) || 0 })}
                                  placeholder="输入入库数量"
                                  step="0.01"
                                  min="0.01"
                                />
                              </div>
                            </div>

                            <div className="form-row">
                              <div className="form-group">
                                <label>单价 (元，可选)</label>
                                <input
                                  type="number"
                                  value={draft.unitPrice ?? ''}
                                  onChange={(e) => updateDraft(index, { 
                                    unitPrice: e.target.value ? parseFloat(e.target.value) : undefined 
                                  })}
                                  placeholder="输入单价"
                                  step="0.01"
                                  min="0"
                                />
                              </div>
                              <div className="form-group">
                                <label>供应商 (可选)</label>
                                <input
                                  type="text"
                                  value={draft.supplier ?? ''}
                                  onChange={(e) => updateDraft(index, { supplier: e.target.value || undefined })}
                                  placeholder="输入供应商名称"
                                />
                              </div>
                            </div>

                            <div className="form-group">
                              <label>备注 (可选)</label>
                              <textarea
                                value={draft.note ?? ''}
                                onChange={(e) => updateDraft(index, { note: e.target.value || undefined })}
                                placeholder="输入备注信息"
                                rows={2}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {stockInDrafts.length > 0 && (
                <div className="draft-summary">
                  <div className="summary-item">
                    <span className="summary-label">材料种类:</span>
                    <span className="summary-value">{stockInDrafts.length} 种</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">总数量:</span>
                    <span className="summary-value">
                      {formatQuantity(stockInDrafts.reduce((sum, d) => sum + d.quantity, 0))}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">预估总金额:</span>
                    <span className="summary-value">
                      ¥{stockInDrafts.reduce((sum, d) => sum + (d.quantity * (d.unitPrice || 0)), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowStockInDraft(false)}>取消</button>
              <button 
                className="btn btn-primary" 
                onClick={handleConfirmStockIn}
                disabled={stockInDrafts.length === 0}
              >
                确认入库 ({stockInDrafts.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
