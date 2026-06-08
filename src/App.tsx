import { useState, useEffect, useMemo, useCallback } from 'react';
import type { RestorationProject, ProjectStatus, RestorationAssessment, Priority } from './types';
import {
  getProjects,
  addProject,
  updateProject,
  deleteProject,
  updateProjectStatus,
  updateProjectProgress,
  saveAssessmentAndAdvance,
  updateProjectImageRecords,
} from './utils/storage';
import ProjectList from './components/ProjectList';
import ProjectDetail from './components/ProjectDetail';
import ProgressBoard from './components/ProgressBoard';
import ProjectForm from './components/ProjectForm';
import MaterialInventory from './components/MaterialInventory';
import RestorationAssessmentView from './components/RestorationAssessment';
import RestorationSchedule from './components/RestorationSchedule';
import DeliveryCalendar from './components/DeliveryCalendar';
import ImageRecordsManager from './components/ImageRecordsManager';
import TemplateManager from './components/TemplateManager';
import BatchImport from './components/BatchImport';
import ProjectHandover from './components/ProjectHandover';
import RepairReport from './components/RepairReport';
import MaterialPurchaseSuggestion from './components/MaterialPurchaseSuggestion';

type ViewType = 'list' | 'board' | 'inventory' | 'purchase' | 'schedule' | 'calendar' | 'images' | 'templates' | 'import';

export default function App() {
  const [projects, setProjects] = useState<RestorationProject[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('list');
  const [selectedProject, setSelectedProject] = useState<RestorationProject | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<RestorationProject | null>(null);
  const [showAssessment, setShowAssessment] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedImageProject, setSelectedImageProject] = useState<RestorationProject | null>(null);
  const [showHandover, setShowHandover] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    setProjects(getProjects());
  }, []);

  const refreshProjects = useCallback(() => {
    setProjects(getProjects());
  }, []);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const urgentCount = projects.filter(p => {
      if (p.status === 'delivered') return false;
      const delivery = new Date(p.deliveryDate);
      delivery.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    }).length;

    return {
      total: projects.length,
      pending: projects.filter(p => p.status === 'pending').length,
      restoring: projects.filter(p => p.status === 'restoring').length,
      drying: projects.filter(p => p.status === 'drying').length,
      binding: projects.filter(p => p.status === 'binding').length,
      delivered: projects.filter(p => p.status === 'delivered').length,
      urgent: urgentCount,
    };
  }, [projects]);

  const handleSelectProject = (project: RestorationProject) => {
    setSelectedProject(project);
    setShowForm(false);
    setEditingProject(null);
  };

  const handleCloseDetail = () => {
    setSelectedProject(null);
    setShowHandover(false);
    setShowReport(false);
  };

  const handleNewProject = () => {
    setEditingProject(null);
    setShowForm(true);
    setSelectedProject(null);
  };

  const handleEditProject = (project: RestorationProject) => {
    setEditingProject(project);
    setShowForm(true);
    setSelectedProject(null);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProject(null);
  };

  const handleSaveProject = (projectData: Omit<RestorationProject, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingProject) {
        const result = updateProject(editingProject.id, projectData);
        if (!result.success) {
          throw new Error(result.error);
        }
        setMessage({ type: 'success', text: '项目更新成功' });
      } else {
        addProject(projectData);
        setMessage({ type: 'success', text: '项目创建成功' });
      }
      refreshProjects();
      setShowForm(false);
      setEditingProject(null);
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '保存失败' });
    }
  };

  const handleDeleteProject = (id: string) => {
    if (!window.confirm('确定要删除这个项目吗？')) return;
    const result = deleteProject(id);
    if (result.success) {
      refreshProjects();
      if (selectedProject?.id === id) {
        setSelectedProject(null);
      }
      setMessage({ type: 'success', text: '项目删除成功' });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: result.error || '删除失败' });
    }
  };

  const handleStatusChange = (id: string, status: ProjectStatus) => {
    const result = updateProjectStatus(id, status);
    if (result.success) {
      refreshProjects();
      if (selectedProject?.id === id) {
        const updated = getProjects().find(p => p.id === id);
        if (updated) setSelectedProject(updated);
      }
    } else {
      setMessage({ type: 'error', text: result.error || '状态更新失败' });
    }
  };

  const handleStepToggle = (projectId: string, stepId: string, notes?: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedSteps = project.restorationSteps.map(step =>
      step.id === stepId
        ? { 
            ...step, 
            completed: !step.completed, 
            completedAt: !step.completed ? new Date().toISOString().split('T')[0] : undefined,
            notes: !step.completed ? (notes || step.notes) : step.notes
          }
        : step
    );

    const result = updateProject(projectId, { restorationSteps: updatedSteps });
    if (result.success) {
      updateProjectProgress(projectId);
      refreshProjects();
      if (selectedProject?.id === projectId) {
        const updated = getProjects().find(p => p.id === projectId);
        if (updated) setSelectedProject(updated);
      }
    }
  };

  const handleSaveAssessment = (assessment: RestorationAssessment, advanceStatus: boolean) => {
    const result = saveAssessmentAndAdvance(selectedProject!.id, assessment, advanceStatus);
    if (result.success) {
      refreshProjects();
      setShowAssessment(false);
      const updated = getProjects().find(p => p.id === selectedProject!.id);
      if (updated) setSelectedProject(updated);
      setMessage({ type: 'success', text: advanceStatus ? '评估已保存，项目进入修复中' : '评估已保存' });
      setTimeout(() => setMessage(null), 3000);
    }
    return result;
  };

  const handlePriorityChange = (id: string, priority: Priority) => {
    const result = updateProject(id, { priority });
    if (result.success) {
      refreshProjects();
      if (selectedProject?.id === id) {
        const updated = getProjects().find(p => p.id === id);
        if (updated) setSelectedProject(updated);
      }
    }
  };

  const getStatusBadgeClass = (status: ProjectStatus): string => {
    return `status-badge status-${status}`;
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <h1 className="app-title">📜 古籍修复工作台</h1>
            <p className="app-subtitle">Ancient Book Restoration Workbench</p>
          </div>
          <div className="header-stats">
            <div className="stat-item">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">总数</span>
            </div>
            <div className="stat-item pending">
              <span className="stat-value">{stats.pending}</span>
              <span className="stat-label">待评估</span>
            </div>
            <div className="stat-item restoring">
              <span className="stat-value">{stats.restoring}</span>
              <span className="stat-label">修复中</span>
            </div>
            <div className="stat-item drying">
              <span className="stat-value">{stats.drying}</span>
              <span className="stat-label">待晾干</span>
            </div>
            <div className="stat-item binding">
              <span className="stat-value">{stats.binding}</span>
              <span className="stat-label">待装订</span>
            </div>
            <div className="stat-item delivered">
              <span className="stat-value">{stats.delivered}</span>
              <span className="stat-label">已交付</span>
            </div>
            {stats.urgent > 0 && (
              <div className="stat-item urgent">
                <span className="stat-value">{stats.urgent}</span>
                <span className="stat-label">7天内交付</span>
              </div>
            )}
          </div>
        </div>
        <nav className="nav-tabs">
          <button
            className={`nav-tab ${currentView === 'list' ? 'active' : ''}`}
            onClick={() => setCurrentView('list')}
          >
            📋 项目列表
          </button>
          <button
            className={`nav-tab ${currentView === 'board' ? 'active' : ''}`}
            onClick={() => setCurrentView('board')}
          >
            🎯 进度看板
          </button>
          <button
            className={`nav-tab ${currentView === 'schedule' ? 'active' : ''}`}
            onClick={() => setCurrentView('schedule')}
          >
            📅 修复排程
          </button>
          <button
            className={`nav-tab ${currentView === 'calendar' ? 'active' : ''}`}
            onClick={() => setCurrentView('calendar')}
          >
            🗓️ 交付日历
          </button>
          <button
            className={`nav-tab ${currentView === 'inventory' ? 'active' : ''}`}
            onClick={() => setCurrentView('inventory')}
          >
            📦 材料库存
          </button>
          <button
            className={`nav-tab ${currentView === 'purchase' ? 'active' : ''}`}
            onClick={() => setCurrentView('purchase')}
          >
            🛒 采购建议
          </button>
          <button
            className={`nav-tab ${currentView === 'images' ? 'active' : ''}`}
            onClick={() => setCurrentView('images')}
          >
            📷 图像档案
          </button>
          <button
            className={`nav-tab ${currentView === 'templates' ? 'active' : ''}`}
            onClick={() => setCurrentView('templates')}
          >
            📑 修复模板
          </button>
          <button
            className={`nav-tab ${currentView === 'import' ? 'active' : ''}`}
            onClick={() => setCurrentView('import')}
          >
            ⬆️ 批量导入
          </button>
          <div className="nav-actions">
            <button className="btn btn-new-project" onClick={handleNewProject}>
              + 新建项目
            </button>
          </div>
        </nav>
      </header>

      {message && (
        <div className={`message-banner ${message.type}`}>
          {message.text}
        </div>
      )}

      <main className="main-content">
        {currentView === 'list' && (
          <ProjectList
            projects={projects}
            onSelectProject={handleSelectProject}
            onEditProject={handleEditProject}
            onDeleteProject={handleDeleteProject}
            onStatusChange={handleStatusChange}
            onNewProject={handleNewProject}
          />
        )}
        {currentView === 'board' && (
          <ProgressBoard
            projects={projects}
            onSelectProject={handleSelectProject}
            onStatusChange={handleStatusChange}
            onEditProject={handleEditProject}
          />
        )}
        {currentView === 'inventory' && (
          <MaterialInventory
            projects={projects}
            onSelectProject={handleSelectProject}
          />
        )}
        {currentView === 'purchase' && (
          <MaterialPurchaseSuggestion
            projects={projects}
            onSelectProject={handleSelectProject}
          />
        )}
        {currentView === 'schedule' && (
          <RestorationSchedule
            projects={projects}
            onSelectProject={handleSelectProject}
          />
        )}
        {currentView === 'calendar' && (
          <DeliveryCalendar
            projects={projects}
            onSelectProject={handleSelectProject}
          />
        )}
        {currentView === 'images' && (
          <div className="images-manager-wrapper">
            {!selectedImageProject ? (
              <div className="image-project-selector">
                <h3>选择项目管理图像档案</h3>
                <div className="project-grid">
                  {projects.map(project => (
                    <div
                      key={project.id}
                      className="project-card-mini"
                      onClick={() => setSelectedImageProject(project)}
                    >
                      <h4>{project.bookTitle}</h4>
                      <span className={`status-badge status-${project.status}`}>
                        {project.status === 'pending' ? '待评估' : project.status === 'restoring' ? '修复中' : project.status === 'drying' ? '待晾干' : project.status === 'binding' ? '待装订' : '已交付'}
                      </span>
                      <p className="project-image-count">
                        {(project.imageRecords || []).length} 张照片
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="image-manager-container">
                <div className="image-manager-header">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setSelectedImageProject(null)}
                  >
                    ← 返回项目列表
                  </button>
                  <h3>{selectedImageProject.bookTitle} - 图像档案</h3>
                </div>
                <ImageRecordsManager
                  project={selectedImageProject}
                  onUpdateRecords={(records) => {
                    const result = updateProjectImageRecords(selectedImageProject.id, records);
                    if (result.success) {
                      refreshProjects();
                      const updated = getProjects().find(p => p.id === selectedImageProject.id);
                      if (updated) setSelectedImageProject(updated);
                    }
                    return result;
                  }}
                />
              </div>
            )}
          </div>
        )}
        {currentView === 'templates' && (
          <TemplateManager />
        )}
        {currentView === 'import' && (
          <BatchImport
            onImportComplete={() => {
              refreshProjects();
              setMessage({ type: 'success', text: '批量导入成功' });
              setTimeout(() => setMessage(null), 3000);
            }}
          />
        )}
      </main>

      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          onClose={handleCloseDetail}
          onEdit={handleEditProject}
          onDelete={handleDeleteProject}
          onStatusChange={handleStatusChange}
          onStepToggle={handleStepToggle}
          onPriorityChange={handlePriorityChange}
          onStartAssessment={() => setShowAssessment(true)}
          onOpenHandover={() => setShowHandover(true)}
          onOpenReport={() => setShowReport(true)}
          getStatusBadgeClass={getStatusBadgeClass}
        />
      )}

      {selectedProject && showHandover && (
        <ProjectHandover
          project={selectedProject}
          onClose={() => setShowHandover(false)}
          getStatusBadgeClass={getStatusBadgeClass}
        />
      )}

      {selectedProject && showReport && (
        <RepairReport
          project={selectedProject}
          onClose={() => setShowReport(false)}
          getStatusBadgeClass={getStatusBadgeClass}
        />
      )}

      {showForm && (
        <ProjectForm
          project={editingProject}
          onSave={handleSaveProject}
          onClose={handleCloseForm}
        />
      )}

      {showAssessment && selectedProject && (
        <RestorationAssessmentView
          project={selectedProject}
          onClose={() => setShowAssessment(false)}
          onSaveAssessment={handleSaveAssessment}
        />
      )}
    </div>
  );
}
