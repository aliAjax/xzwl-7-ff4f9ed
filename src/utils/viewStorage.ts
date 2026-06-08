import type { SavedView } from '../types';
import STORAGE_KEYS from './storageKeys';
import { generateSavedViewId } from './idGenerator';

export const getSavedViews = (): SavedView[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SAVED_VIEWS);
    if (!data) {
      return [];
    }
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveSavedViews = (views: SavedView[]): { success: boolean; error?: string } => {
  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_VIEWS, JSON.stringify(views));
    return { success: true };
  } catch (error) {
    return { success: false, error: '保存视图失败' };
  }
};

export const addSavedView = (
  data: Omit<SavedView, 'id' | 'createdAt' | 'updatedAt'>
): { success: boolean; error?: string; view?: SavedView } => {
  try {
    const views = getSavedViews();
    const now = new Date().toISOString();
    const newView: SavedView = {
      ...data,
      id: generateSavedViewId(),
      createdAt: now,
      updatedAt: now,
    };
    views.push(newView);
    saveSavedViews(views);
    return { success: true, view: newView };
  } catch (error) {
    return { success: false, error: '添加视图失败' };
  }
};

export const updateSavedView = (
  id: string,
  updates: Partial<Omit<SavedView, 'id' | 'createdAt'>>
): { success: boolean; error?: string; view?: SavedView } => {
  try {
    const views = getSavedViews();
    const index = views.findIndex(v => v.id === id);
    if (index === -1) {
      return { success: false, error: '视图不存在' };
    }
    views[index] = {
      ...views[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveSavedViews(views);
    return { success: true, view: views[index] };
  } catch (error) {
    return { success: false, error: '更新视图失败' };
  }
};

export const deleteSavedView = (id: string): { success: boolean; error?: string } => {
  try {
    const views = getSavedViews();
    const filtered = views.filter(v => v.id !== id);
    if (filtered.length === views.length) {
      return { success: false, error: '视图不存在' };
    }
    saveSavedViews(filtered);
    return { success: true };
  } catch (error) {
    return { success: false, error: '删除视图失败' };
  }
};

export const getSavedViewById = (id: string): SavedView | undefined => {
  const views = getSavedViews();
  return views.find(v => v.id === id);
};
