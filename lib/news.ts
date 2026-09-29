// lib/news.ts — última entrada de NEWS.md para el botón News de la sidebar
import { readFile } from 'fs/promises';
import path from 'path';

export type NewsEntry = { date: string; items: string[] };

// Toma el primer "## fecha" y sus viñetas "- ". Sin archivo o sin entradas devuelve null.
export async function getLatestNews(): Promise<NewsEntry | null> {
  let text: string;
  try {
    text = await readFile(path.join(process.cwd(), 'NEWS.md'), 'utf8');
  } catch {
    return null;
  }
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(l => l.startsWith('## '));
  if (start === -1) return null;
  const items: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    if (line.startsWith('- ')) items.push(line.slice(2).trim());
  }
  return { date: lines[start].slice(3).trim(), items };
}
