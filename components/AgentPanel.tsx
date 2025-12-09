import React, { useState, useRef } from 'react';
import { Bot, RefreshCw, Sparkles, Search, History, TrendingUp, Clock, Power, Share2, Download, Play, Trash2, Check, Brain, Camera } from 'lucide-react';
import { AgentState, NewsArticle } from '../types';

interface AgentPanelProps {
  agentState: AgentState;
  onUpdate: (topic: string, isDeepSearch: boolean) => void;
  onImageUpload: (file: File) => void;
  searchHistory: string[];
  isAutoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  currentArticles: NewsArticle[];
  onClearHistory: () => void;
}

const TRENDING_TOPICS = [
  "מלחמת חרבות ברזל",
  "בינה מלאכותית",
  "נדל״ן בישראל",
  "טכנולוגיה",
  "אפל וגוגל"
];

export const AgentPanel: React.FC<AgentPanelProps> = ({ 
  agentState, 
  onUpdate,
  onImageUpload,
  searchHistory,
  isAutoRefresh,
  onToggleAutoRefresh,
  currentArticles,
  onClearHistory
}) => {
  const [customTopic, setCustomTopic] = useState('');
  const [confirmHistoryTopic, setConfirmHistoryTopic] = useState<string | null>(null);
  const [isReadingAll, setIsReadingAll] = useState(false);
  const [isDeepSearch, setIsDeepSearch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const topic = customTopic.trim() || "חדשות חמות בישראל ובעולם";
    onUpdate(topic, isDeepSearch);
    setCustomTopic('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        onImageUpload(e.target.files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleShareAll = () => {
    if (currentArticles.length === 0) return;
    const text = currentArticles
        .map(a => `🔹 ${a.title}\n${a.sourceUrl || ''}`)
        .join('\n\n');
    navigator.clipboard.writeText(`NovaNews Updates:\n\n${text}`);
    alert("כל הקישורים הועתקו ללוח!");
  };

  const handleExport = () => {
    if (currentArticles.length === 0) return;
    const text = JSON.stringify(currentArticles, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novanews-export-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReadAll = () => {
    if (isReadingAll) {
        window.speechSynthesis.cancel();
        setIsReadingAll(false);
        return;
    }
    if (currentArticles.length === 0) return;
    setIsReadingAll(true);
    const fullText = currentArticles.map(a => a.title).join('. ');
    const utterance = new SpeechSynthesisUtterance("הנה הכותרות להיום. " + fullText);
    utterance.lang = 'he-IL';
    utterance.onend = () => setIsReadingAll(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleHistoryClick = (topic: string) => {
    if (confirmHistoryTopic === topic) {
        onUpdate(topic, isDeepSearch);
        setConfirmHistoryTopic(null);
    } else {
        setConfirmHistoryTopic(topic);
        setTimeout(() => setConfirmHistoryTopic(prev => prev === topic ? null : prev), 4000);
    }
  };

  return (
    <div className={`relative rounded-3xl overflow-hidden transition-all duration-500 mb-8 border border-white/40 dark:border-slate-700/50 shadow-2xl shadow-blue-500/5 dark:shadow-black/20 ${agentState.isScanning ? 'ring-2 ring-blue-500/30' : ''}`}>
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl z-0"></div>
      
      {/* Animated Loading Shimmer - Ensured Visibility */}
      {agentState.isScanning && (
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-blue-400/10 to-transparent skew-x-12 animate-[shimmer_2s_infinite]"></div>
      )}

      <div className="relative z-10 p-6 md:p-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl transition-all duration-500 ${agentState.isScanning ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/40 scale-110' : 'bg-white dark:bg-slate-700 shadow-md border border-gray-100 dark:border-slate-600'}`}>
                    <Bot className={`w-8 h-8 ${agentState.isScanning ? 'text-white animate-pulse' : 'text-blue-600 dark:text-blue-400'}`} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        סוכן החדשות החכם
                    </h2>
                    <div className="text-sm font-medium">
                        {agentState.isScanning ? (
                            <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                </span>
                                {isDeepSearch ? 'מבצע ניתוח עומק...' : 'סורק את הרשת...'}
                            </span>
                        ) : (
                            <span className="text-gray-500 dark:text-gray-400">
                                {agentState.lastUpdated ? `עודכן: ${agentState.lastUpdated.toLocaleTimeString()}` : 'מוכן לחיפוש חדש'}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Buttons - Refactored for consistency */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl">
                 <button 
                    onClick={handleReadAll} 
                    disabled={currentArticles.length === 0} 
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        isReadingAll 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-slate-700/50 dark:hover:bg-slate-700 dark:text-slate-300 disabled:opacity-50'
                    }`}
                    title="הקרא הכל"
                 >
                    {isReadingAll ? <div className="animate-pulse"><Power size={14} /></div> : <Play size={14} />}
                    <span className="hidden sm:inline">הקרא הכל</span>
                </button>

                <button 
                    onClick={handleShareAll} 
                    disabled={currentArticles.length === 0} 
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-slate-700/50 dark:hover:bg-slate-700 dark:text-slate-300 disabled:opacity-50"
                    title="שתף הכל"
                >
                    <Share2 size={14} />
                    <span className="hidden sm:inline">שתף</span>
                </button>

                <button 
                    onClick={handleExport} 
                    disabled={currentArticles.length === 0} 
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-slate-700/50 dark:hover:bg-slate-700 dark:text-slate-300 disabled:opacity-50"
                    title="יצוא"
                >
                    <Download size={14} />
                    <span className="hidden sm:inline">יצוא</span>
                </button>

                <div className="w-px h-6 bg-gray-300 dark:bg-slate-600 mx-1"></div>

                <button
                    onClick={onToggleAutoRefresh}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        isAutoRefresh 
                        ? 'bg-green-100/80 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                        : 'bg-gray-100 text-gray-500 dark:bg-slate-700/50 dark:text-slate-400'
                    }`}
                >
                    <Clock size={14} className={isAutoRefresh ? "animate-spin-slow" : ""} />
                    {isAutoRefresh ? 'Auto ON' : 'Auto OFF'}
                </button>
            </div>
        </div>

        {/* Search & Input Area */}
        <div className="mb-6">
            <div className="relative group shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700">
                <form onSubmit={handleSubmit} className="flex flex-col md:flex-row">
                    <div className="flex-1 relative">
                        <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                        <input
                            type="text"
                            value={customTopic}
                            onChange={(e) => setCustomTopic(e.target.value)}
                            placeholder="מה מעניין אותך היום? (למשל: ספורט, פוליטיקה, טכנולוגיה...)"
                            className="w-full pl-4 pr-12 py-5 bg-transparent border-none rounded-t-2xl md:rounded-l-none md:rounded-r-2xl focus:ring-0 text-lg text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                            disabled={agentState.isScanning}
                        />
                    </div>
                    
                    {/* Controls embedded in bar */}
                    <div className="flex items-center gap-2 px-2 pb-2 md:pb-0 md:py-2 bg-transparent md:border-r border-t md:border-t-0 border-gray-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-800 rounded-xl p-1">
                             <button
                                type="button" 
                                onClick={() => setIsDeepSearch(!isDeepSearch)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    isDeepSearch 
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 shadow-sm' 
                                    : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700'
                                }`}
                                title="מודל חשיבה (Gemini Pro)"
                             >
                                <Brain size={16} />
                                <span className="hidden sm:inline">חשיבה עמוקה</span>
                             </button>

                             <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                                title="העלאת תמונה לניתוח"
                             >
                                <Camera size={16} />
                                <span className="hidden sm:inline">תמונה</span>
                             </button>
                        </div>
                        
                        <button
                            type="submit"
                            disabled={agentState.isScanning}
                            className={`px-6 py-2.5 rounded-xl font-bold text-white transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2
                                ${agentState.isScanning 
                                    ? 'bg-gray-400 cursor-not-allowed' 
                                    : isDeepSearch 
                                        ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:shadow-lg hover:shadow-purple-500/20'
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:shadow-blue-500/20'
                                }`}
                        >
                            {agentState.isScanning ? <RefreshCw className="animate-spin" size={20} /> : <Sparkles size={20} />}
                            <span className="hidden md:inline">{isDeepSearch ? 'נתח עכשיו' : 'חפש'}</span>
                        </button>
                    </div>
                </form>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        </div>

        {/* Footer Links (Trending & History) */}
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-gray-400 dark:text-slate-500 ml-1 flex items-center gap-1">
                    <TrendingUp size={12} /> חם ברשת:
                </span>
                {TRENDING_TOPICS.map((topic) => (
                    <button
                        key={topic}
                        onClick={() => onUpdate(topic, false)}
                        disabled={agentState.isScanning}
                        className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 transition-colors"
                    >
                        {topic}
                    </button>
                ))}
            </div>

            {searchHistory.length > 0 && (
                <div className="pt-3 border-t border-gray-100/50 dark:border-slate-700/50">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-gray-400 dark:text-slate-500 flex items-center gap-1">
                            <History size={12} /> לאחרונה:
                        </span>
                        <button onClick={onClearHistory} className="text-[10px] text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1">
                            <Trash2 size={10} /> נקה
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {searchHistory.slice(0, 6).map((item, idx) => (
                             <button
                                key={idx}
                                onClick={() => handleHistoryClick(item)}
                                className={`text-xs px-2.5 py-1 rounded-md transition-all duration-200 flex items-center gap-1.5
                                    ${confirmHistoryTopic === item 
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                                        : 'bg-gray-50/50 dark:bg-slate-800/50 text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400'
                                    }`}
                            >
                                {item}
                                {confirmHistoryTopic === item && <Check size={10} />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};