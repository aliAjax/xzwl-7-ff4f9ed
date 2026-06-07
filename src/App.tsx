import { useState, useEffect } from 'react';
import type { RestorationProject, ProjectStatus, ImageRecord, RestorationAssessment } from './types';
import { getProjects, saveProjects, generateId, getTemplates } from './utils/storage';
import KanbanBoard from './components/KanbanBoard';
import ProjectList from './components/ProjectList';
import ProjectDetail from './components/ProjectDetail';
import ProjectForm from './components/ProjectForm';
import BatchImport from './components/BatchImport';
import MaterialInventory from './components/MaterialInventory';
import TemplateManager from './components/TemplateManager';
import DeliveryCalendar from './components/DeliveryCalendar';
import RestorationAssessmentComponent from './components/RestorationAssessment';
import RestorationSchedule from './components/RestorationSchedule';

type ViewMode = 'kanban' | 'list' | 'inventory' | 'calendar' | 'schedule';

function App() {
  const [projects, setProjects] = useState<RestorationProject[]>(() => getProjects());
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedProject, setSelectedProject] = useState<RestorationProject | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [editingProject, setEditingProject] = useState<RestorationProject | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      const result = saveProjects(projects);
      if (!result.success) {
        console.error('Auto-save failed:', result.error);
      }
    }
  }, [projects, isInitialized]);

  const handleStatusChange = (projectId: string, newStatus: ProjectStatus) => {
    const now = new Date().toISOString().split('T')[0];
    setProjects(prevProjects =>
      prevProjects.map(p =>
        p.id === projectId
          ? { ...p, status: newStatus, updatedAt: now }
          : p
      )
    );
  };

  const handleSaveProject = (projectData: Omit<RestorationProject, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString().split('T')[0];

    if (editingProject) {
      setProjects(prevProjects => {
        const updatedProjects = prevProjects.map(p =>
          p.id === editingProject.id
            ? { ...p, ...projectData, updatedAt: now }
            : p
        );

        if (selectedProject && selectedProject.id === editingProject.id) {
          const updated = updatedProjects.find(p => p.id === editingProject.id);
          if (updated) {
            queueMicrotask(() => setSelectedProject(updated));
          }
        }

        return updatedProjects;
      });
    } else {
      const newProject: RestorationProject = {
        ...projectData,
        id: generateId(),
        imageRecords: [],
        createdAt: now,
        updatedAt: now,
      };
      setProjects(prevProjects => [...prevProjects, newProject]);
    }

    setShowForm(false);
    setEditingProject(null);
  };

  const handleDeleteProject = () => {
    if (!selectedProject) return;

    if (window.confirm(`确定要删除《${selectedProject.bookTitle}》吗？此操作不可撤销。`)) {
      setProjects(prevProjects => prevProjects.filter(p => p.id !== selectedProject.id));
      setSelectedProject(null);
    }
  };

  const handleStepToggle = (stepIndex: number) => {
    if (!selectedProject) return;

    const now = new Date().toISOString().split('T')[0];
    const updatedSteps = [...selectedProject.restorationSteps];
    const step = updatedSteps[stepIndex];
    const wasCompleted = step.completed;

    updatedSteps[stepIndex] = {
      ...step,
      completed: !wasCompleted,
      date: !wasCompleted ? now : undefined,
    };

    const completedCount = updatedSteps.filter(s => s.completed).length;
    const newProgress = Math.round((completedCount / updatedSteps.length) * 100);

    const updatedProject: RestorationProject = {
      ...selectedProject,
      restorationSteps: updatedSteps,
      currentProgress: newProgress,
      updatedAt: now,
    };

    setProjects(prevProjects =>
      prevProjects.map(p =>
        p.id === selectedProject.id ? updatedProject : p
      )
    );
    setSelectedProject(updatedProject);
  };

  const handleUpdateImageRecords = (records: ImageRecord[]): { success: boolean; error?: string } => {
    if (!selectedProject) return { success: false, error: '未选择项目' };

    const now = new Date().toISOString().split('T')[0];
    const updatedProject: RestorationProject = {
      ...selectedProject,
      imageRecords: records,
      updatedAt: now,
    };

    const updatedProjects = projects.map(p =>
      p.id === selectedProject.id ? updatedProject : p
    );

    const saveResult = saveProjects(updatedProjects);
    if (!saveResult.success) {
      return saveResult;
    }

    setProjects(updatedProjects);
    setSelectedProject(updatedProject);
    return { success: true };
  };

  const handleNewProject = () => {
    setEditingProject(null);
    setShowForm(true);
  };

  const handleBatchImport = () => {
    setShowBatchImport(true);
  };

  const handleManageTemplates = () => {
    setShowTemplateManager(true);
  };

  const handleBatchSave = (newProjects: Omit<RestorationProject, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    const now = new Date().toISOString().split('T')[0];
    const projectsToAdd: RestorationProject[] = newProjects.map(p => ({
      ...p,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }));
    setProjects(prevProjects => [...prevProjects, ...projectsToAdd]);
    setShowBatchImport(false);
  };

  const handleEditProject = () => {
    if (selectedProject) {
      setEditingProject(selectedProject);
      setShowForm(true);
    }
  };

  const handleStartAssessment = () => {
    setShowAssessment(true);
  };

  const handleSaveAssessment = (assessment: RestorationAssessment, advanceStatus: boolean): { success: boolean; error?: string } => {
    if (!selectedProject) return { success: false, error: '未选择项目' };

    const now = new Date().toISOString().split('T')[0];
    const allTemplates = getTemplates();

    let restorationSteps = selectedProject.restorationSteps;
    if (assessment.recommendedTemplateId) {
      const recommendedTemplate = allTemplates.find(t => t.id === assessment.recommendedTemplateId);
      if (recommendedTemplate) {
        restorationSteps = recommendedTemplate.steps.map(step => ({
          name: step,
          completed: false,
        }));
      }
    }

    const materialsUsed = assessment.materialEstimates.map(m => ({
      ...m,
      quantity: m.quantity,
    }));

    const updatedProject: RestorationProject = {
      ...selectedProject,
      assessment,
      restorationSteps,
      materialsUsed,
      currentProgress: advanceStatus ? 0 : selectedProject.currentProgress,
      status: advanceStatus ? 'in-restoration' : selectedProject.status,
      updatedAt: now,
    };

    const updatedProjects = projects.map(p =>
      p.id === selectedProject.id ? updatedProject : p
    );

    const saveResult = saveProjects(updatedProjects);
    if (!saveResult.success) {
      return saveResult;
    }

    setProjects(updatedProjects);
    setSelectedProject(updatedProject);
    setShowAssessment(false);
    return { success: true };
  };

  const getStats = () => {
    const total = projects.length;
    const inProgress = projects.filter(p => p.status !== 'delivered' && p.status !== 'pending-evaluation').length;
    const delivered = projects.filter(p => p.status === 'delivered').length;
    const overdue = projects.filter(p => {
      if (p.status === 'delivered') return false;
      const today = new Date();
      const delivery = new Date(p.deliveryDate);
      return delivery < today;
    }).length;

    return { total, inProgress, delivered, overdue };
  };

  const stats = getStats();

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <h1 className="app-title">古籍修复工作台</h1>
            <p className="app-subtitle">传承文化遗产守护者 · 修复千年典籍</p>
          </div>

          <div className="stats-bar">
            <div className="stat-item">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">总项目</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.inProgress}</span>
              <span className="stat-label">进行中</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.delivered}</span>
              <span className="stat-label">已交付</span>
            </div>
            {stats.overdue > 0 && (
              <div className="stat-item urgent">
                <span className="stat-value">{stats.overdue}</span>
                <span className="stat-label">已逾期</span>
              </div>
            )}
          </div>
        </div>

        <nav className="app-nav">
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
            >
              看板视图
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              列表视图
            </button>
            <button
              className={`view-btn ${viewMode === 'inventory' ? 'active' : ''}`}
              onClick={() => setViewMode('inventory')}
            >
              库存与补货计划
            </button>
            <button
              className={`view-btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              交付日历
            </button>
            <button
              className={`view-btn ${viewMode === 'schedule' ? 'active' : ''}`}
              onClick={() => setViewMode('schedule')}
            >
              修复排班
            </button>
          </div>

          <div className="header-actions">
            <button className="btn btn-secondary btn-import" onClick={handleManageTemplates}>
              ☰ 模板管理
            </button>
            <button className="btn btn-secondary btn-import" onClick={handleBatchImport}>
              ↑ 批量导入
            </button>
            <button className="btn btn-primary btn-new" onClick={handleNewProject}>
              + 新建项目
            </button>
          </div>
        </nav>
      </header>

      <main className="app-main">
        {viewMode === 'kanban' && (
          <KanbanBoard
            projects={projects}
            onStatusChange={handleStatusChange}
            onSelectProject={setSelectedProject}
          />
        )}
        {viewMode === 'list' && (
          <ProjectList
            projects={projects}
            onSelectProject={setSelectedProject}
            onStatusChange={handleStatusChange}
          />
        )}
        {viewMode === 'inventory' && (
          <MaterialInventory
            projects={projects}
            onSelectProject={setSelectedProject}
          />
        )}
        {viewMode === 'calendar' && (
          <DeliveryCalendar
            projects={projects}
            onSelectProject={setSelectedProject}
          />
        )}
        {viewMode === 'schedule' && (
          <RestorationSchedule
            projects={projects}
            onSelectProject={setSelectedProject}
          />
        )}
      </main>

      {selectedProject && !showForm && !showAssessment && (
        <ProjectDetail
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onEdit={handleEditProject}
          onDelete={handleDeleteProject}
          onStepToggle={handleStepToggle}
          onUpdateImageRecords={handleUpdateImageRecords}
          onStartAssessment={handleStartAssessment}
        />
      )}

      {selectedProject && showAssessment && (
        <RestorationAssessmentComponent
          project={selectedProject}
          onClose={() => setShowAssessment(false)}
          onSaveAssessment={handleSaveAssessment}
        />
      )}

      {showForm && (
        <ProjectForm
          project={editingProject || undefined}
          onClose={() => {
            setShowForm(false);
            setEditingProject(null);
          }}
          onSave={handleSaveProject}
        />
      )}

      {showBatchImport && (
        <BatchImport
          onClose={() => setShowBatchImport(false)}
          onSave={handleBatchSave}
        />
      )}

      {showTemplateManager && (
        <TemplateManager
          onClose={() => setShowTemplateManager(false)}
        />
      )}
    </div>
  );
}

export default App;
