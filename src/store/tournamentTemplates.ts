import type { TournamentStructure } from '@/domain/types';
import { v4 as uuid } from 'uuid';

const KEY = 'logger-tournament-templates';

export interface TemplateEntry {
  id: string;
  name: string;
  structure: TournamentStructure;
}

export function getTemplates(): TemplateEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TemplateEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveTemplate(name: string, structure: TournamentStructure): TemplateEntry {
  const templates = getTemplates();
  const entry: TemplateEntry = { id: uuid(), name, structure };
  templates.push(entry);
  localStorage.setItem(KEY, JSON.stringify(templates));
  return entry;
}

export function deleteTemplate(id: string): void {
  const templates = getTemplates().filter((t) => t.id !== id);
  localStorage.setItem(KEY, JSON.stringify(templates));
}
