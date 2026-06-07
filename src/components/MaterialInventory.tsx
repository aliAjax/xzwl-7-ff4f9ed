import { useState, useMemo } from 'react';
import type { RestorationProject } from '../types';
import { STATUS_LABELS } from '../types';

interface MaterialInventoryProps {
  projects: RestorationProject[];
  onSelectProject: (project: RestorationProject) => void;
}

interface MaterialSummary {
  name: string;
  unit: string;
  totalQuantity: number;
  projectCount: number;
  lastUsedDate: string;
  relatedProjects: RestorationProject[];
}

type SortField = 'name' | 'totalQuantity' | 'projectCount' | 'lastUsedDate';
type SortOrder = 'asc' | 'desc';

export default function MaterialInventory({ projects, onSelectProject }: MaterialInventoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialSummary | null>(null);

  const materialSummaries = useMemo(() => {
    const materialMap = new Map<string, MaterialSummary>();

    projects.forEach(project => {
      project.materialsUsed.forEach(material => {
        const key = `${material.name}-${material.unit}`;
        const quantity = parseFloat(material.quantity) || 0;
        const useDate = project.updatedAt || project.createdAt;

        if (materialMap.has(key)) {
          const existing = materialMap.get(key)!;
          existing.totalQuantity += quantity;
          
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
            totalQuantity: quantity,
            projectCount: 1,
            lastUsedDate: useDate,
            relatedProjects: [project],
          });
        }
      });
    });

    return Array.from(materialMap.values());
  }, [projects]);

  const filteredAndSortedMaterials = useMemo(() => {
    let result = [...materialSummaries];

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
        case 'totalQuantity':
          comparison = a.totalQuantity - b.totalQuantity;
          break;
        case 'projectCount':
          comparison = a.projectCount - b.projectCount;
          break;
        case 'lastUsedDate':
          comparison = new Date(a.lastUsedDate).getTime() - new Date(b.lastUsedDate).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [materialSummaries, searchTerm, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon active">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const getDaysSinceLastUse = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - date.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatQuantity = (num: number) => {
    if (Number.isInteger(num)) {
      return num.toString();
    }
    return num.toFixed(2).replace(/\.?0+$/, '');
  };

  const stats = useMemo(() => {
    const totalTypes = materialSummaries.length;
    const totalQuantity = materialSummaries.reduce((sum, m) => sum + m.totalQuantity, 0);
    const materialsWithProjects = materialSummaries.filter(m => m.projectCount > 0).length;
    return { totalTypes, totalQuantity, materialsWithProjects };
  }, [materialSummaries]);

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

          <div className="inventory-stats">
            <div className="inventory-stat">
              <span className="stat-value">{stats.totalTypes}</span>
              <span className="stat-label">材料种类</span>
            </div>
            <div className="inventory-stat">
              <span className="stat-value">{stats.materialsWithProjects}</span>
              <span className="stat-label">关联项目</span>
            </div>
          </div>

          <div className="result-count">
            共 {filteredAndSortedMaterials.length} 条记录
          </div>
        </div>

        <div className="table-container">
          <table className="project-table inventory-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} className="sortable">
                  材料名称 <SortIcon field="name" />
                </th>
                <th onClick={() => handleSort('totalQuantity')} className="sortable">
                  总用量 <SortIcon field="totalQuantity" />
                </th>
                <th>单位</th>
                <th onClick={() => handleSort('projectCount')} className="sortable">
                  关联项目数 <SortIcon field="projectCount" />
                </th>
                <th onClick={() => handleSort('lastUsedDate')} className="sortable">
                  最近使用日期 <SortIcon field="lastUsedDate" />
                </th>
                <th>距今天数</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedMaterials.map(material => {
                const daysSince = getDaysSinceLastUse(material.lastUsedDate);
                
                return (
                  <tr
                    key={`${material.name}-${material.unit}`}
                    className="project-row material-row"
                    onClick={() => setSelectedMaterial(material)}
                  >
                    <td className="title-cell">
                      <span className="book-title">{material.name}</span>
                    </td>
                    <td>
                      <span className="quantity-value">{formatQuantity(material.totalQuantity)}</span>
                    </td>
                    <td>{material.unit}</td>
                    <td>
                      <span className="project-count-badge">{material.projectCount}</span>
                    </td>
                    <td>{material.lastUsedDate}</td>
                    <td>
                      <span className={`days-since ${daysSince > 30 ? 'stale' : ''}`}>
                        {daysSince === 0 ? '今天' : `${daysSince}天前`}
                      </span>
                    </td>
                  </tr>
                );
              })}
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
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-left">
                <h2>{selectedMaterial.name}</h2>
                <span className="status-badge status-in-restoration">
                  关联 {selectedMaterial.projectCount} 个项目
                </span>
              </div>
              <div className="header-actions">
                <button className="btn btn-close" onClick={() => setSelectedMaterial(null)}>×</button>
              </div>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h3>材料汇总信息</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">材料名称</span>
                    <span className="info-value">{selectedMaterial.name}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">累计总用量</span>
                    <span className="info-value">
                      <span className="quantity-value">{formatQuantity(selectedMaterial.totalQuantity)}</span> {selectedMaterial.unit}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">关联项目数</span>
                    <span className="info-value">{selectedMaterial.projectCount} 个</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">最近使用日期</span>
                    <span className="info-value">{selectedMaterial.lastUsedDate}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>关联修复项目</h3>
                {selectedMaterial.relatedProjects.length > 0 ? (
                  <div className="related-projects-list">
                    {selectedMaterial.relatedProjects.map(project => {
                      const materialUsage = project.materialsUsed.find(
                        m => m.name === selectedMaterial.name && m.unit === selectedMaterial.unit
                      );
                      const daysSince = getDaysSinceLastUse(project.updatedAt || project.createdAt);
                      
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
                            <span className="usage-amount">
                              用量: {materialUsage?.quantity || 0} {selectedMaterial.unit}
                            </span>
                            <span className="project-date">
                              {daysSince === 0 ? '今天更新' : `${daysSince}天前更新`}
                            </span>
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
    </>
  );
}
