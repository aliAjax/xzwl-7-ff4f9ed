import { useState, useMemo, useEffect } from 'react';
import type { RestorationProject, InventorySummary, StockStatus, MaterialStock, StockInTemplate } from '../types';
import { STATUS_LABELS, STOCK_STATUS_LABELS } from '../types';
import {
  getMaterialStocks,
  updateStockSettings,
  addStockInRecord,
  deleteStockInRecord,
  getStockInTemplates,
  addStockInTemplate,
  updateStockInTemplate,
  deleteStockInTemplate,
} from '../utils/storage';

interface MaterialInventoryProps {
  projects: RestorationProject[];
  onSelectProject: (project: RestorationProject) => void;
}

type SortField = 'name' | 'currentStock' | 'estimatedConsumption' | 'estimatedDaysLeft' | 'projectCount' | 'lastUsedDate' | 'status';
type SortOrder = 'asc' | 'desc';
type FilterType = 'all' | 'critical' | 'low' | 'stale' | 'normal';

const STALE_DAYS_THRESHOLD = 60;
const LOW_STOCK_DAYS_THRESHOLD = 14;
const ESTIMATION_PERIOD_DAYS = 30;

export default function MaterialInventory({ projects, onSelectProject }: MaterialInventoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedMaterial, setSelectedMaterial] = useState<InventorySummary | null>(null);
  const [materialStocks, setMaterialStocks] = useState<MaterialStock[]>([]);
  const [showStockInForm, setShowStockInForm] = useState(false);
  const [showSettingsForm, setShowSettingsForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stockInTemplates, setStockInTemplates] = useState<StockInTemplate[]>([]);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<StockInTemplate | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isTemplateFromStockIn, setIsTemplateFromStockIn] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    supplier: '',
    unit: '',
    defaultUnitPrice: '',
    note: '',
  });

  const [stockInForm, setStockInForm] = useState({
    date: new Date().toISOString().split('T')[0],
    quantity: '',
    unitPrice: '',
    supplier: '',
    note: '',
  });

  const [settingsForm, setSettingsForm] = useState({
    openingStock: '',
    minimumStock: '',
  });

  useEffect(() => {
    setMaterialStocks(getMaterialStocks());
    setStockInTemplates(getStockInTemplates());
  }, []);

  const refreshTemplates = () => {
    setStockInTemplates(getStockInTemplates());
  };


  const refreshStockData = () => {
    setMaterialStocks(getMaterialStocks());
  };

  const getDaysSince = (dateStr: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - date.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const calculateEstimatedConsumption = (materialName: string, unit: string): number => {
    let totalEstimate = 0;

    projects.forEach(project => {
      if (project.status === 'delivered') return;

      const materialInProject = project.materialsUsed.find(
        m => m.name === materialName && m.unit === unit
      );
      if (!materialInProject) return;

      const totalSteps = project.restorationSteps.length;
      const completedSteps = project.restorationSteps.filter(s => s.completed).length;
      const remainingSteps = totalSteps - completedSteps;

      if (totalSteps > 0 && remainingSteps > 0) {
        const totalQuantity = parseFloat(materialInProject.quantity) || 0;
        const estimatedRemaining = totalQuantity * (remainingSteps / totalSteps);
        totalEstimate += estimatedRemaining;
      }
    });

    return Math.round(totalEstimate * 100) / 100;
  };

  const calculateStockStatus = (
    currentStock: number,
    minimumStock: number,
    estimatedConsumption: number,
    daysSinceLastUse: number
  ): StockStatus => {
    if (daysSinceLastUse > STALE_DAYS_THRESHOLD && currentStock > 0) {
      return 'stale';
    }

    if (currentStock <= minimumStock) {
      return 'critical';
    }

    if (estimatedConsumption > 0) {
      const dailyConsumption = estimatedConsumption / ESTIMATION_PERIOD_DAYS;
      const daysLeft = currentStock / dailyConsumption;
      if (daysLeft < LOW_STOCK_DAYS_THRESHOLD) {
        return 'low';
      }
    }

    return 'normal';
  };

  const inventorySummaries = useMemo(() => {
    const materialMap = new Map<string, InventorySummary>();

    projects.forEach(project => {
      project.materialsUsed.forEach(material => {
        const key = `${material.name}-${material.unit}`;
        const quantity = parseFloat(material.quantity) || 0;
        const useDate = project.updatedAt || project.createdAt;

        if (materialMap.has(key)) {
          const existing = materialMap.get(key)!;
          existing.totalUsed += quantity;

          const projectAlreadyExists = existing.relatedProjects.some(p => p.id === project.id);
          if (!projectAlreadyExists) {
            existing.projectCount += 1;
            existing.relatedProjects.push(project);
          }

          if (new Date(useDate) > new Date(existing.lastUsedDate)) {
            existing.lastUsedDate = useDate;
          }
        } else {
          materialMap.set(key, {
            name: material.name,
            unit: material.unit,
            openingStock: 0,
            totalStockIn: 0,
            totalUsed: quantity,
            currentStock: 0,
            minimumStock: 0,
            estimatedConsumption: 0,
            estimatedDaysLeft: 0,
            status: 'normal',
            lastUsedDate: useDate,
            daysSinceLastUse: 0,
            projectCount: 1,
            relatedProjects: [project],
            stockInRecords: [],
          });
        }
      });
    });

    materialStocks.forEach(stock => {
      const key = `${stock.name}-${stock.unit}`;
      const totalStockIn = stock.stockInRecords.reduce((sum, r) => sum + r.quantity, 0);

      if (materialMap.has(key)) {
        const existing = materialMap.get(key)!;
        existing.openingStock = stock.openingStock;
        existing.totalStockIn = totalStockIn;
        existing.minimumStock = stock.minimumStock;
        existing.currentStock = Math.max(0, stock.openingStock + totalStockIn - existing.totalUsed);
        existing.stockInRecords = stock.stockInRecords;
      } else {
        materialMap.set(key, {
          name: stock.name,
          unit: stock.unit,
          openingStock: stock.openingStock,
          totalStockIn,
          totalUsed: 0,
          currentStock: Math.max(0, stock.openingStock + totalStockIn),
          minimumStock: stock.minimumStock,
          estimatedConsumption: 0,
          estimatedDaysLeft: 0,
          status: 'normal',
          lastUsedDate: stock.updatedAt,
          daysSinceLastUse: 0,
          projectCount: 0,
          relatedProjects: [],
          stockInRecords: stock.stockInRecords,
        });
      }
    });

    const summaries = Array.from(materialMap.values()).map(summary => {
      const estimatedConsumption = calculateEstimatedConsumption(summary.name, summary.unit);
      const daysSinceLastUse = getDaysSince(summary.lastUsedDate);
      
      let estimatedDaysLeft: number;
      if (estimatedConsumption > 0) {
        const dailyConsumption = estimatedConsumption / ESTIMATION_PERIOD_DAYS;
        estimatedDaysLeft = dailyConsumption > 0 
          ? Math.round((summary.currentStock / dailyConsumption) * 10) / 10 
          : 999;
      } else {
        estimatedDaysLeft = summary.currentStock > 0 ? 999 : 0;
      }

      const status = calculateStockStatus(
        summary.currentStock,
        summary.minimumStock,
        estimatedConsumption,
        daysSinceLastUse
      );

      return {
        ...summary,
        estimatedConsumption,
        estimatedDaysLeft,
        daysSinceLastUse,
        status,
      };
    });

    return summaries;
  }, [projects, materialStocks]);

  useEffect(() => {
    if (selectedMaterial) {
      const updated = inventorySummaries.find(
        m => m.name === selectedMaterial.name && m.unit === selectedMaterial.unit
      );
      if (updated) {
        setSelectedMaterial(updated);
      }
    }
  }, [inventorySummaries]);
  const filteredAndSortedMaterials = useMemo(() => {
    let result = [...inventorySummaries];

    if (filterType !== 'all') {
      result = result.filter(m => m.status === filterType);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(m =>
        m.name.toLowerCase().includes(term) ||
        m.unit.toLowerCase().includes(term)
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'zh-CN');
          break;
        case 'currentStock':
          comparison = a.currentStock - b.currentStock;
          break;
        case 'estimatedConsumption':
          comparison = a.estimatedConsumption - b.estimatedConsumption;
          break;
        case 'estimatedDaysLeft':
          comparison = a.estimatedDaysLeft - b.estimatedDaysLeft;
          break;
        case 'projectCount':
          comparison = a.projectCount - b.projectCount;
          break;
        case 'lastUsedDate':
          comparison = new Date(a.lastUsedDate).getTime() - new Date(b.lastUsedDate).getTime();
          break;
        case 'status':
          const statusOrder: Record<StockStatus, number> = {
            'critical': 0,
            'low': 1,
            'stale': 2,
            'normal': 3,
          };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [inventorySummaries, searchTerm, sortField, sortOrder, filterType]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleAddStockIn = () => {
    if (!selectedMaterial) return;

    const quantity = parseFloat(stockInForm.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      setMessage({ type: 'error', text: '请输入有效的入库数量' });
      return;
    }

    const result = addStockInRecord(selectedMaterial.name, selectedMaterial.unit, {
      date: stockInForm.date,
      quantity,
      unitPrice: stockInForm.unitPrice ? parseFloat(stockInForm.unitPrice) : undefined,
      supplier: stockInForm.supplier || undefined,
      note: stockInForm.note || undefined,
    });

    if (result.success) {
      setMessage({ type: 'success', text: '入库记录添加成功' });
      setShowStockInForm(false);
      setStockInForm({
        date: new Date().toISOString().split('T')[0],
        quantity: '',
        unitPrice: '',
        supplier: '',
        note: '',
      });
      refreshStockData();
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: result.error || '添加失败' });
    }
  };

  const handleSaveSettings = () => {
    if (!selectedMaterial) return;

    const openingStock = parseFloat(settingsForm.openingStock) || 0;
    const minimumStock = parseFloat(settingsForm.minimumStock) || 0;

    if (openingStock < 0) {
      setMessage({ type: 'error', text: '期初库存不能为负数' });
      return;
    }

    if (minimumStock < 0) {
      setMessage({ type: 'error', text: '最低库存线不能为负数' });
      return;
    }

    const result = updateStockSettings(selectedMaterial.name, selectedMaterial.unit, {
      openingStock,
      minimumStock,
    });

    if (result.success) {
      setMessage({ type: 'success', text: '库存设置保存成功' });
      setShowSettingsForm(false);
      refreshStockData();
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: result.error || '保存失败' });
    }
  };

  const handleDeleteStockIn = (recordId: string) => {
    if (!selectedMaterial) return;
    if (!window.confirm('确定要删除这条入库记录吗？')) return;

    const result = deleteStockInRecord(selectedMaterial.name, selectedMaterial.unit, recordId);
    if (result.success) {
      setMessage({ type: 'success', text: '入库记录已删除' });
      refreshStockData();
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: result.error || '删除失败' });
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const template = stockInTemplates.find(t => t.id === templateId);
    if (template) {
      if (selectedMaterial && template.unit !== selectedMaterial.unit) {
        setMessage({
          type: 'error',
          text: `模板单位「${template.unit}」与当前材料单位「${selectedMaterial.unit}」不匹配，无法使用此模板`
        });
        setSelectedTemplateId('');
        setTimeout(() => setMessage(null), 3000);
        return;
      }

      setStockInForm({
        ...stockInForm,
        supplier: template.supplier,
        unitPrice: template.defaultUnitPrice ? template.defaultUnitPrice.toString() : '',
        note: template.note || '',
      });

      setMessage({
        type: 'success',
        text: `已应用模板「${template.name}」，单位：${template.unit}`
      });
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const matchingTemplates = useMemo(() => {
    if (!selectedMaterial) return [];
    return stockInTemplates.filter(t => t.unit === selectedMaterial.unit);
  }, [stockInTemplates, selectedMaterial]);

  const openAddTemplateForm = (fromStockIn = false) => {
    setEditingTemplate(null);
    setIsTemplateFromStockIn(fromStockIn);
    setTemplateForm({
      name: selectedMaterial?.name || '',
      supplier: fromStockIn ? stockInForm.supplier : '',
      unit: selectedMaterial?.unit || '',
      defaultUnitPrice: fromStockIn ? stockInForm.unitPrice : '',
      note: fromStockIn ? stockInForm.note : '',
    });
    setShowTemplateForm(true);
  };

  const openEditTemplateForm = (template: StockInTemplate) => {
    setEditingTemplate(template);
    setIsTemplateFromStockIn(false);
    setTemplateForm({
      name: template.name,
      supplier: template.supplier,
      unit: template.unit,
      defaultUnitPrice: template.defaultUnitPrice ? template.defaultUnitPrice.toString() : '',
      note: template.note || '',
    });
    setShowTemplateForm(true);
  };

  const handleSaveTemplate = () => {
    if (!templateForm.name.trim()) {
      setMessage({ type: 'error', text: '请输入材料名称' });
      return;
    }
    if (!templateForm.supplier.trim()) {
      setMessage({ type: 'error', text: '请输入供应商' });
      return;
    }
    if (!templateForm.unit.trim()) {
      setMessage({ type: 'error', text: '请输入单位' });
      return;
    }

    const templateData = {
      name: templateForm.name.trim(),
      supplier: templateForm.supplier.trim(),
      unit: templateForm.unit.trim(),
      defaultUnitPrice: templateForm.defaultUnitPrice ? parseFloat(templateForm.defaultUnitPrice) : undefined,
      note: templateForm.note.trim() || undefined,
    };

    let result;
    if (editingTemplate) {
      result = updateStockInTemplate(editingTemplate.id, templateData);
    } else {
      result = addStockInTemplate(templateData);
    }

    if (result.success) {
      setMessage({ type: 'success', text: editingTemplate ? '模板更新成功' : '模板创建成功' });
      setShowTemplateForm(false);
      setEditingTemplate(null);
      refreshTemplates();
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: result.error || '保存失败' });
    }
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (!window.confirm('确定要删除这个入库模板吗？\n删除模板不会影响已生成的入库记录。')) return;

    const result = deleteStockInTemplate(templateId);
    if (result.success) {
      setMessage({ type: 'success', text: '模板已删除' });
      refreshTemplates();
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId('');
      }
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: result.error || '删除失败' });
    }
  };

  const openMaterialDetail = (material: InventorySummary) => {
    setSelectedMaterial(material);
    setSettingsForm({
      openingStock: material.openingStock.toString(),
      minimumStock: material.minimumStock.toString(),
    });
    setShowStockInForm(false);
    setShowSettingsForm(false);
    setMessage(null);
    setSelectedTemplateId('');
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon active">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const formatQuantity = (num: number): string => {
    if (Number.isInteger(num)) {
      return num.toString();
    }
    return num.toFixed(2).replace(/\.?0+$/, '');
  };

  const getStatusBadgeClass = (status: StockStatus): string => {
    switch (status) {
      case 'critical': return 'stock-status critical';
      case 'low': return 'stock-status low';
      case 'stale': return 'stock-status stale';
      default: return 'stock-status normal';
    }
  };

  const stats = useMemo(() => {
    const totalTypes = inventorySummaries.length;
    const criticalCount = inventorySummaries.filter(m => m.status === 'critical').length;
    const lowCount = inventorySummaries.filter(m => m.status === 'low').length;
    const staleCount = inventorySummaries.filter(m => m.status === 'stale').length;
    const totalStockValue = inventorySummaries.reduce((sum, m) => {
      const lastRecord = m.stockInRecords[m.stockInRecords.length - 1];
      const unitPrice = lastRecord?.unitPrice || 0;
      return sum + m.currentStock * unitPrice;
    }, 0);
    return { totalTypes, criticalCount, lowCount, staleCount, totalStockValue };
  }, [inventorySummaries]);

  const renderDaysLeft = (days: number) => {
    if (days >= 999) {
      return <span className="days-left unlimited">充足</span>;
    }
    if (days <= 0) {
      return <span className="days-left critical">耗尽</span>;
    }
    return (
      <span className={`days-left ${days < LOW_STOCK_DAYS_THRESHOLD ? 'warning' : ''}`}>
        ~{days}天
      </span>
    );
  };

  const renderDaysSince = (days: number) => {
    if (days === 0) {
      return <span className="days-since">今天</span>;
    }
    return (
      <span className={`days-since ${days > 30 ? 'stale' : ''}`}>
        {days}天前
      </span>
    );
  };

  return (
    <>
      <div className="inventory-container project-list-container">
        <div className="inventory-header list-toolbar">
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
              <option value="critical">库存不足</option>
              <option value="low">即将不足</option>
              <option value="stale">长期未用</option>
              <option value="normal">库存正常</option>
            </select>
          </div>

          <div className="inventory-stats">
            <div className="inventory-stat">
              <span className="stat-value">{stats.totalTypes}</span>
              <span className="stat-label">材料种类</span>
            </div>
            {stats.criticalCount > 0 && (
              <div className="inventory-stat critical">
                <span className="stat-value">{stats.criticalCount}</span>
                <span className="stat-label">库存不足</span>
              </div>
            )}
            {stats.lowCount > 0 && (
              <div className="inventory-stat low">
                <span className="stat-value">{stats.lowCount}</span>
                <span className="stat-label">即将不足</span>
              </div>
            )}
            {stats.staleCount > 0 && (
              <div className="inventory-stat stale">
                <span className="stat-value">{stats.staleCount}</span>
                <span className="stat-label">长期未用</span>
              </div>
            )}
            {stats.totalStockValue > 0 && (
              <div className="inventory-stat">
                <span className="stat-value">¥{stats.totalStockValue.toFixed(2)}</span>
                <span className="stat-label">库存总值</span>
              </div>
            )}
          </div>

          <div className="result-count">
            共 {filteredAndSortedMaterials.length} 条记录
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => setShowTemplateManager(true)}
          >
            📋 快速入库模板
          </button>
        </div>

        <div className="table-container">
          <table className="project-table inventory-table">
            <thead>
              <tr>
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
                <th onClick={() => handleSort('estimatedConsumption')} className="sortable">
                  预计还需 <SortIcon field="estimatedConsumption" />
                </th>
                <th onClick={() => handleSort('estimatedDaysLeft')} className="sortable">
                  预计可用 <SortIcon field="estimatedDaysLeft" />
                </th>
                <th onClick={() => handleSort('projectCount')} className="sortable">
                  关联项目 <SortIcon field="projectCount" />
                </th>
                <th onClick={() => handleSort('lastUsedDate')} className="sortable">
                  最近使用 <SortIcon field="lastUsedDate" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedMaterials.map(material => (
                <tr
                  key={`${material.name}-${material.unit}`}
                  className={`project-row material-row status-${material.status}`}
                  onClick={() => openMaterialDetail(material)}
                >
                  <td>
                    <span className={getStatusBadgeClass(material.status)}>
                      {STOCK_STATUS_LABELS[material.status]}
                    </span>
                  </td>
                  <td className="title-cell">
                    <span className="book-title">{material.name}</span>
                  </td>
                  <td>{material.unit}</td>
                  <td>
                    <span className={`quantity-value ${material.status === 'critical' ? 'critical' : ''}`}>
                      {formatQuantity(material.currentStock)}
                    </span>
                  </td>
                  <td>
                    <span className="minimum-stock">{formatQuantity(material.minimumStock)}</span>
                  </td>
                  <td>
                    <span className="estimated-consumption">
                      {material.estimatedConsumption > 0 ? formatQuantity(material.estimatedConsumption) : '-'}
                    </span>
                  </td>
                  <td>{renderDaysLeft(material.estimatedDaysLeft)}</td>
                  <td>
                    <span className="project-count-badge">{material.projectCount}</span>
                  </td>
                  <td>{renderDaysSince(material.daysSinceLastUse)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredAndSortedMaterials.length === 0 && (
            <div className="empty-list">
              <p>没有找到匹配的材料记录</p>
            </div>
          )}
        </div>
      </div>

      {selectedMaterial && (
        <div className="modal-overlay" onClick={() => setSelectedMaterial(null)}>
          <div className="modal-content detail-modal large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-left">
                <h2>{selectedMaterial.name}</h2>
                <span className={getStatusBadgeClass(selectedMaterial.status)}>
                  {STOCK_STATUS_LABELS[selectedMaterial.status]}
                </span>
              </div>
              <div className="header-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowSettingsForm(!showSettingsForm);
                    setShowStockInForm(false);
                  }}
                >
                  ⚙ 库存设置
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowStockInForm(!showStockInForm);
                    setShowSettingsForm(false);
                  }}
                >
                  + 材料入库
                </button>
                <button className="btn btn-close" onClick={() => setSelectedMaterial(null)}>×</button>
              </div>
            </div>

            <div className="modal-body">
              {message && (
                <div className={`message-banner ${message.type}`}>
                  {message.text}
                </div>
              )}

              {showSettingsForm && (
                <div className="form-section">
                  <h3>库存设置</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>期初库存 ({selectedMaterial.unit})</label>
                      <input
                        type="number"
                        value={settingsForm.openingStock}
                        onChange={(e) => setSettingsForm({ ...settingsForm, openingStock: e.target.value })}
                        placeholder="输入期初库存数量"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label>最低库存线 ({selectedMaterial.unit})</label>
                      <input
                        type="number"
                        value={settingsForm.minimumStock}
                        onChange={(e) => setSettingsForm({ ...settingsForm, minimumStock: e.target.value })}
                        placeholder="输入最低库存预警线"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="form-actions-inline">
                    <button className="btn btn-primary" onClick={handleSaveSettings}>保存设置</button>
                    <button className="btn btn-secondary" onClick={() => setShowSettingsForm(false)}>取消</button>
                  </div>
                </div>
              )}

              {showStockInForm && (
                <div className="form-section">
                  <div className="form-section-header">
                    <h3>材料入库</h3>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openAddTemplateForm(true)}
                    >
                      + 保存为模板
                    </button>
                  </div>
                  <div className="form-group">
                    <label>选择快速入库模板 (当前单位：{selectedMaterial.unit})</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => handleTemplateSelect(e.target.value)}
                    >
                      <option value="">-- 不使用模板 --</option>
                      {matchingTemplates.length > 0 ? (
                        matchingTemplates.map(template => (
                          <option key={template.id} value={template.id}>
                            {template.name} ({template.unit}) - {template.supplier}
                            {template.defaultUnitPrice ? ` - ¥${template.defaultUnitPrice.toFixed(2)}` : ''}
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>
                          暂无「{selectedMaterial.unit}」单位的模板，可点击右上角「保存为模板」创建
                        </option>
                      )}
                    </select>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>入库日期</label>
                      <input
                        type="date"
                        value={stockInForm.date}
                        onChange={(e) => setStockInForm({ ...stockInForm, date: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>入库数量 ({selectedMaterial.unit})</label>
                      <input
                        type="number"
                        value={stockInForm.quantity}
                        onChange={(e) => setStockInForm({ ...stockInForm, quantity: e.target.value })}
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
                        value={stockInForm.unitPrice}
                        onChange={(e) => setStockInForm({ ...stockInForm, unitPrice: e.target.value })}
                        placeholder="输入单价"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label>供应商 (可选)</label>
                      <input
                        type="text"
                        value={stockInForm.supplier}
                        onChange={(e) => setStockInForm({ ...stockInForm, supplier: e.target.value })}
                        placeholder="输入供应商名称"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>备注 (可选)</label>
                    <textarea
                      value={stockInForm.note}
                      onChange={(e) => setStockInForm({ ...stockInForm, note: e.target.value })}
                      placeholder="输入备注信息"
                      rows={2}
                    />
                  </div>
                  <div className="form-actions-inline">
                    <button className="btn btn-primary" onClick={handleAddStockIn}>确认入库</button>
                    <button className="btn btn-secondary" onClick={() => setShowStockInForm(false)}>取消</button>
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h3>库存概览</h3>
                <div className="info-grid inventory-info-grid">
                  <div className="info-item">
                    <span className="info-label">期初库存</span>
                    <span className="info-value">
                      <span className="quantity-value">{formatQuantity(selectedMaterial.openingStock)}</span> {selectedMaterial.unit}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">累计入库</span>
                    <span className="info-value">
                      <span className="quantity-value">{formatQuantity(selectedMaterial.totalStockIn)}</span> {selectedMaterial.unit}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">累计使用</span>
                    <span className="info-value">
                      <span className="quantity-value">{formatQuantity(selectedMaterial.totalUsed)}</span> {selectedMaterial.unit}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">当前库存</span>
                    <span className="info-value">
                      <span className={`quantity-value ${selectedMaterial.status === 'critical' ? 'critical' : ''}`}>
                        {formatQuantity(selectedMaterial.currentStock)}
                      </span> {selectedMaterial.unit}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">最低库存线</span>
                    <span className="info-value">
                      <span className="minimum-stock">{formatQuantity(selectedMaterial.minimumStock)}</span> {selectedMaterial.unit}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">预计还需消耗</span>
                    <span className="info-value">
                      <span className="estimated-consumption">
                        {selectedMaterial.estimatedConsumption > 0 ? formatQuantity(selectedMaterial.estimatedConsumption) : '-'}
                      </span> {selectedMaterial.estimatedConsumption > 0 ? selectedMaterial.unit : ''}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">预计可用</span>
                    <span className="info-value">
                      {selectedMaterial.estimatedDaysLeft >= 999 ? (
                        <span className="days-left unlimited">库存充足</span>
                      ) : selectedMaterial.estimatedDaysLeft <= 0 ? (
                        <span className="days-left critical">已耗尽</span>
                      ) : (
                        <span className={`days-left ${selectedMaterial.estimatedDaysLeft < LOW_STOCK_DAYS_THRESHOLD ? 'warning' : ''}`}>
                          约 {selectedMaterial.estimatedDaysLeft} 天
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">最近使用</span>
                    <span className="info-value">
                      {selectedMaterial.daysSinceLastUse === 0
                        ? '今天'
                        : `${selectedMaterial.daysSinceLastUse} 天前`}
                    </span>
                  </div>
                </div>
              </div>

              {selectedMaterial.stockInRecords.length > 0 && (
                <div className="detail-section">
                  <h3>入库记录</h3>
                  <table className="materials-table compact">
                    <thead>
                      <tr>
                        <th>日期</th>
                        <th>数量</th>
                        <th>单价</th>
                        <th>供应商</th>
                        <th>备注</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...selectedMaterial.stockInRecords]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map(record => (
                          <tr key={record.id}>
                            <td>{record.date}</td>
                            <td>{formatQuantity(record.quantity)} {selectedMaterial.unit}</td>
                            <td>{record.unitPrice ? `¥${record.unitPrice.toFixed(2)}` : '-'}</td>
                            <td>{record.supplier || '-'}</td>
                            <td>{record.note || '-'}</td>
                            <td>
                              <button
                                className="btn-icon btn-danger"
                                onClick={() => handleDeleteStockIn(record.id)}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="detail-section">
                <h3>关联修复项目 ({selectedMaterial.projectCount} 个)</h3>
                {selectedMaterial.relatedProjects.length > 0 ? (
                  <div className="related-projects-list">
                    {selectedMaterial.relatedProjects.map(project => {
                      const materialUsage = project.materialsUsed.find(
                        m => m.name === selectedMaterial.name && m.unit === selectedMaterial.unit
                      );
                      const daysSince = getDaysSince(project.updatedAt || project.createdAt);

                      const totalSteps = project.restorationSteps.length;
                      const completedSteps = project.restorationSteps.filter(s => s.completed).length;
                      const remainingSteps = totalSteps - completedSteps;
                      const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

                      const estimatedRemaining = materialUsage && totalSteps > 0 && remainingSteps > 0 && project.status !== 'delivered'
                        ? Math.round((parseFloat(materialUsage.quantity) * remainingSteps / totalSteps) * 100) / 100
                        : 0;

                      return (
                        <div
                          key={project.id}
                          className="related-project-item"
                          onClick={() => {
                            setSelectedMaterial(null);
                            onSelectProject(project);
                          }}
                        >
                          <div className="project-info-left">
                            <span className="related-project-title">{project.bookTitle}</span>
                            <span className={`status-badge status-${project.status}`}>
                              {STATUS_LABELS[project.status]}
                            </span>
                          </div>
                          <div className="project-info-right">
                            <div className="project-usage-info">
                              <span className="usage-amount">
                                已用: {materialUsage?.quantity || 0} {selectedMaterial.unit}
                              </span>
                              {estimatedRemaining > 0 && (
                                <span className="estimated-remaining">
                                  预计还需: {formatQuantity(estimatedRemaining)} {selectedMaterial.unit}
                                </span>
                              )}
                            </div>
                            <div className="project-meta">
                              <span className="project-progress">进度: {progress}%</span>
                              <span className="project-date">
                                {daysSince === 0 ? '今天更新' : `${daysSince}天前更新`}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="empty-text">暂无关联项目</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showTemplateManager && (
        <div className="modal-overlay" onClick={() => setShowTemplateManager(false)}>
          <div className="modal-content detail-modal large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>快速入库模板管理</h2>
              <div className="header-actions">
                <button className="btn btn-primary" onClick={() => openAddTemplateForm(false)}>
                  + 新建模板
                </button>
                <button className="btn btn-close" onClick={() => setShowTemplateManager(false)}>×</button>
              </div>
            </div>
            <div className="modal-body">
              {message && (
                <div className={`message-banner ${message.type}`}>
                  {message.text}
                </div>
              )}
              {stockInTemplates.length > 0 ? (
                <table className="materials-table">
                  <thead>
                    <tr>
                      <th>材料名称</th>
                      <th>单位</th>
                      <th>供应商</th>
                      <th>默认单价</th>
                      <th>备注</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockInTemplates.map(template => (
                      <tr key={template.id}>
                        <td>{template.name}</td>
                        <td>{template.unit}</td>
                        <td>{template.supplier}</td>
                        <td>{template.defaultUnitPrice ? `¥${template.defaultUnitPrice.toFixed(2)}` : '-'}</td>
                        <td>{template.note || '-'}</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn-icon btn-secondary"
                              onClick={() => openEditTemplateForm(template)}
                              title="编辑"
                            >
                              ✎
                            </button>
                            <button
                              className="btn-icon btn-danger"
                              onClick={() => handleDeleteTemplate(template.id)}
                              title="删除"
                            >
                              ×
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-list">
                  <p>暂无入库模板，点击上方按钮创建</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTemplateForm && (
        <div className="modal-overlay" onClick={() => setShowTemplateForm(false)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTemplate ? '编辑入库模板' : '新建入库模板'}</h2>
              <button className="btn btn-close" onClick={() => setShowTemplateForm(false)}>×</button>
            </div>
            <div className="modal-body">
              {message && (
                <div className={`message-banner ${message.type}`}>
                  {message.text}
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>材料名称 *</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="输入材料名称"
                  />
                </div>
                <div className="form-group">
                  <label>单位 *</label>
                  <input
                    type="text"
                    value={templateForm.unit}
                    onChange={(e) => setTemplateForm({ ...templateForm, unit: e.target.value })}
                    placeholder="如：张、克、毫升"
                    readOnly={isTemplateFromStockIn || !!editingTemplate}
                    style={{
                      backgroundColor: isTemplateFromStockIn || editingTemplate ? '#f3f4f6' : undefined,
                      cursor: isTemplateFromStockIn || editingTemplate ? 'not-allowed' : undefined,
                    }}
                  />
                  {(isTemplateFromStockIn || editingTemplate) && (
                    <span className="form-hint">
                      {isTemplateFromStockIn ? '单位与当前材料一致，不可修改' : '编辑模板时不可修改单位'}
                    </span>
                  )}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>供应商 *</label>
                  <input
                    type="text"
                    value={templateForm.supplier}
                    onChange={(e) => setTemplateForm({ ...templateForm, supplier: e.target.value })}
                    placeholder="输入供应商名称"
                  />
                </div>
                <div className="form-group">
                  <label>默认单价 (元，可选)</label>
                  <input
                    type="number"
                    value={templateForm.defaultUnitPrice}
                    onChange={(e) => setTemplateForm({ ...templateForm, defaultUnitPrice: e.target.value })}
                    placeholder="输入默认单价"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>备注 (可选)</label>
                <textarea
                  value={templateForm.note}
                  onChange={(e) => setTemplateForm({ ...templateForm, note: e.target.value })}
                  placeholder="输入备注信息"
                  rows={3}
                />
              </div>
              <div className="form-actions-inline">
                <button className="btn btn-primary" onClick={handleSaveTemplate}>
                  {editingTemplate ? '保存修改' : '创建模板'}
                </button>
                <button className="btn btn-secondary" onClick={() => setShowTemplateForm(false)}>
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
