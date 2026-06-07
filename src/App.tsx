import { useState, useEffect } from 'react';
import type { RestorationProject, ProjectStatus } from './types';
import { getProjects, saveProjects, generateId } from './utils/storage';
import KanbanBoard from './components/KanbanBoard';
import ProjectList from './components/ProjectList';
import ProjectDetail from './components/ProjectDetail';
import ProjectForm from './components/ProjectForm';
import BatchImport from './components/BatchImport';

type ViewMode = 'kanban' | 'list';

function App() {
  const [projects, setProjects] = useState<RestorationProject[]>(() => getProjects());
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedProject, setSelectedProject] = useState<RestorationProject | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [editingProject, setEditingProject] = useState<RestorationProject | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      saveProjects(projects);
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

  const handleNewProject = () => {
    setEditingProject(null);
    setShowForm(true);
  };

  const handleBatchImport = () => {
    setShowBatchImport(true);
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
          </div>

          <div className="header-actions">
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
        {viewMode === 'kanban' ? (
          <KanbanBoard
            projects={projects}
            onStatusChange={handleStatusChange}
            onSelectProject={setSelectedProject}
          />
        ) : (
          <ProjectList
            projects={projects}
            onSelectProject={setSelectedProject}
            onStatusChange={handleStatusChange}
          />
        )}
      </main>

      {selectedProject && !showForm && (
        <ProjectDetail
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onEdit={handleEditProject}
          onDelete={handleDeleteProject}
          onStepToggle={handleStepToggle}
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
    </div>
  );
}

export default App;
