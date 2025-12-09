export type Category = 'General' | 'Politics' | 'Technology' | 'Sports' | 'Economy' | 'Health' | 'Entertainment' | 'Science' | 'World';

export interface NewsArticle {
  title: string;
  summary: string;
  category: string; // We map string from AI to strict Category locally if needed, but keeping string for flexibility
  publishedAt: string;
  sourceName?: string;
  sourceUrl?: string;
  priority?: 'High' | 'Medium' | 'Low';
}

export interface AgentState {
  isScanning: boolean;
  lastUpdated: Date | null;
  statusMessage: string;
}