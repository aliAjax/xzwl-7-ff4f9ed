import type { SavedPurchaseSuggestion } from '../types';
import STORAGE_KEYS from './storageKeys';
import { generatePurchaseSuggestionId } from './idGenerator';

export const getPurchaseSuggestions = (): SavedPurchaseSuggestion[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PURCHASE_SUGGESTIONS);
    if (!data) {
      return [];
    }
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const savePurchaseSuggestions = (
  suggestions: SavedPurchaseSuggestion[]
): { success: boolean; error?: string } => {
  try {
    localStorage.setItem(STORAGE_KEYS.PURCHASE_SUGGESTIONS, JSON.stringify(suggestions));
    return { success: true };
  } catch (error) {
    return { success: false, error: '保存采购建议失败' };
  }
};

export const addPurchaseSuggestion = (
  suggestion: Omit<SavedPurchaseSuggestion, 'id' | 'generatedAt'>
): SavedPurchaseSuggestion => {
  const suggestions = getPurchaseSuggestions();
  const now = new Date().toISOString();
  const newSuggestion: SavedPurchaseSuggestion = {
    ...suggestion,
    id: generatePurchaseSuggestionId(),
    generatedAt: now,
  };
  suggestions.unshift(newSuggestion);
  savePurchaseSuggestions(suggestions);
  return newSuggestion;
};

export const deletePurchaseSuggestion = (
  id: string
): { success: boolean; error?: string } => {
  try {
    const suggestions = getPurchaseSuggestions();
    const filtered = suggestions.filter(s => s.id !== id);
    if (filtered.length === suggestions.length) {
      return { success: false, error: '采购建议不存在' };
    }
    savePurchaseSuggestions(filtered);
    return { success: true };
  } catch (error) {
    return { success: false, error: '删除失败' };
  }
};

export const getPurchaseSuggestionById = (
  id: string
): SavedPurchaseSuggestion | undefined => {
  const suggestions = getPurchaseSuggestions();
  return suggestions.find(s => s.id === id);
};

export const updatePurchaseSuggestionNote = (
  id: string,
  note: string
): { success: boolean; error?: string; suggestion?: SavedPurchaseSuggestion } => {
  try {
    const suggestions = getPurchaseSuggestions();
    const index = suggestions.findIndex(s => s.id === id);
    if (index === -1) {
      return { success: false, error: '采购建议不存在' };
    }
    suggestions[index] = {
      ...suggestions[index],
      note,
    };
    savePurchaseSuggestions(suggestions);
    return { success: true, suggestion: suggestions[index] };
  } catch (error) {
    return { success: false, error: '更新失败' };
  }
};

export const markSuggestionAsConverted = (
  suggestionId: string,
  materialName: string,
  materialUnit: string,
  stockInRecordId: string
): { success: boolean; error?: string } => {
  try {
    const suggestions = getPurchaseSuggestions();
    const suggestionIndex = suggestions.findIndex(s => s.id === suggestionId);
    if (suggestionIndex === -1) {
      return { success: false, error: '采购建议不存在' };
    }

    const suggestion = suggestions[suggestionIndex];
    const itemIndex = suggestion.suggestions.findIndex(
      s => s.name === materialName && s.unit === materialUnit
    );
    if (itemIndex === -1) {
      return { success: false, error: '采购建议中未找到该材料' };
    }

    suggestion.suggestions[itemIndex] = {
      ...suggestion.suggestions[itemIndex],
      convertedToStockIn: true,
      convertedAt: new Date().toISOString(),
      stockInRecordId,
    };

    savePurchaseSuggestions(suggestions);
    return { success: true };
  } catch (error) {
    return { success: false, error: '更新采购建议状态失败' };
  }
};

export const batchMarkSuggestionsAsConverted = (
  suggestionId: string,
  items: Array<{ name: string; unit: string; stockInRecordId: string }>
): { success: boolean; error?: string } => {
  try {
    const suggestions = getPurchaseSuggestions();
    const suggestionIndex = suggestions.findIndex(s => s.id === suggestionId);
    if (suggestionIndex === -1) {
      return { success: false, error: '采购建议不存在' };
    }

    const suggestion = suggestions[suggestionIndex];
    const now = new Date().toISOString();

    items.forEach(item => {
      const itemIndex = suggestion.suggestions.findIndex(
        s => s.name === item.name && s.unit === item.unit
      );
      if (itemIndex !== -1) {
        suggestion.suggestions[itemIndex] = {
          ...suggestion.suggestions[itemIndex],
          convertedToStockIn: true,
          convertedAt: now,
          stockInRecordId: item.stockInRecordId,
        };
      }
    });

    savePurchaseSuggestions(suggestions);
    return { success: true };
  } catch (error) {
    return { success: false, error: '批量更新采购建议状态失败' };
  }
};

export const batchMarkSuggestionsAsConvertedInAllHistory = (
  items: Array<{ name: string; unit: string; stockInRecordId: string }>
): { success: boolean; error?: string; updatedCount: number } => {
  try {
    const suggestions = getPurchaseSuggestions();
    const now = new Date().toISOString();
    let updatedCount = 0;

    items.forEach(item => {
      suggestions.forEach(savedSuggestion => {
        const itemIndex = savedSuggestion.suggestions.findIndex(
          s => s.name === item.name && s.unit === item.unit && !s.convertedToStockIn
        );
        if (itemIndex !== -1) {
          savedSuggestion.suggestions[itemIndex] = {
            ...savedSuggestion.suggestions[itemIndex],
            convertedToStockIn: true,
            convertedAt: now,
            stockInRecordId: item.stockInRecordId,
          };
          updatedCount++;
        }
      });
    });

    savePurchaseSuggestions(suggestions);
    return { success: true, updatedCount };
  } catch (error) {
    return { success: false, error: '批量更新所有历史建议状态失败', updatedCount: 0 };
  }
};
