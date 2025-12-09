import React, { useState, useEffect, useCallback } from 'react';
import { fetchNewsFromAgent, analyzeImage, fetchDeepResearch } from './services/geminiService';
import { NewsArticle, AgentState, Category } from './types';
import { NewsCard } from './components/NewsCard';
import { AgentPanel } from './components/AgentPanel';
import { Newspaper, Info, Moon, Sun, Sparkles, Eye, EyeOff, ArrowUp } from 'lucide-react';

const App: React.FC = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<NewsArticle[]>([]);
  const [agentState, setAgentState] = useState<AgentState>({
    isScanning: false,
    lastUpdated: null,
    statusMessage: "הסוכן ממתין לפקודה.",
  });
  const [error, setError] = useState<string | null>(null);
  
  const [darkMode, setDarkMode] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [focusMode, setFocusMode] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [currentTopic, setCurrentTopic] = useState("החדשות הכי חשובות בישראל ובעולם מהשעות האחרונות");

  useEffect(() => {
    const savedHistory = localStorage.getItem('novaNewsHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) setSearchHistory(parsed);
      } catch (e) {
        setSearchHistory([]);
      }
    }

    const savedFocus = localStorage.getItem('novaFocusMode');
    if (savedFocus === 'true') setFocusMode(true);
    
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
    
    updateNews(currentTopic, false);
    
    const handleScroll = () => {
      // Show/Hide Scroll to top
      setShowScrollTop(window.scrollY > 400);

      // Scroll Progress
      const totalScroll = document.documentElement.scrollTop;
      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (windowHeight > 0) {
        setScrollProgress(totalScroll / windowHeight);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const toggleFocusMode = () => {
      const newValue = !focusMode;
      setFocusMode(newValue);
      localStorage.setItem('novaFocusMode', String(newValue));
  };

  useEffect(() => {
    if (focusMode) {
      setFilteredArticles(articles.filter(a => a.category === 'General'));
    } else {
      if (selectedCategory === 'All') {
        setFilteredArticles(articles);
      } else {
        setFilteredArticles(articles.filter(a => 
          a.category.toLowerCase() === selectedCategory.toLowerCase()
        ));
      }
    }
  }, [selectedCategory, articles, focusMode]);

  const updateNews = useCallback(async (topic: string, isDeepSearch: boolean = false) => {
    setCurrentTopic(topic);
    setAgentState(prev => ({
      ...prev,
      isScanning: true,
      statusMessage: isDeepSearch 
        ? `מבצע ניתוח עומק על הנושא: ${topic}...`
        : `סורק את הרשת אחר חדשות בנושא: ${topic}...`
    }));
    setError(null);
    if (!focusMode) setSelectedCategory('All');

    if (topic && !topic.startsWith("Image Analysis")) {
        setSearchHistory(prev => {
            const newHistory = [topic, ...prev].slice(0, 50); 
            localStorage.setItem('novaNewsHistory', JSON.stringify(newHistory));
            return newHistory;
        });
    }

    try {
      const newArticles = isDeepSearch 
        ? await fetchDeepResearch(topic) 
        : await fetchNewsFromAgent(topic);
      
      setArticles(newArticles);
      setAgentState({
        isScanning: false,
        lastUpdated: new Date(),
        statusMessage: "העדכון הושלם בהצלחה."
      });
    } catch (err) {
      console.error(err);
      setError("אירעה שגיאה. אנא נסה שוב.");
      setAgentState(prev => ({ ...prev, isScanning: false }));
    }
  }, [focusMode]);

  const handleImageUpload = async (file: File) => {
    setAgentState(prev => ({ ...prev, isScanning: true, statusMessage: "מנתח תמונה..." }));
    try {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            const article = await analyzeImage(base64Data, file.type);
            setArticles(prev => [article, ...prev]);
            setAgentState({ isScanning: false, lastUpdated: new Date(), statusMessage: "הושלם." });
        };
        reader.readAsDataURL(file);
    } catch (e) {
        setError("שגיאה בניתוח התמונה.");
        setAgentState(prev => ({ ...prev, isScanning: false }));
    }
  };

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (isAutoRefresh) {
      intervalId = setInterval(() => {
        if (!agentState.isScanning && !currentTopic.startsWith("Image Analysis")) {
           updateNews(currentTopic, false);
        }
      }, 3600000); 
    }
    return () => clearInterval(intervalId);
  }, [isAutoRefresh, currentTopic, updateNews, agentState.isScanning]);

  const toggleDarkMode = () => setDarkMode(!darkMode);
  const toggleAutoRefresh = () => setIsAutoRefresh(!isAutoRefresh);
  const clearHistory = () => { setSearchHistory([]); localStorage.removeItem('novaNewsHistory'); };
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const categories: (Category | 'All')[] = ['All', 'Politics', 'Technology', 'Economy', 'Sports', 'Health', 'Entertainment', 'Science', 'World', 'General'];
  const categoryLabels: Record<string, string> = { 'All': 'כל הכתבות', 'Politics': 'פוליטיקה', 'Technology': 'טכנולוגיה', 'Economy': 'כלכלה', 'Sports': 'ספורט', 'Health': 'בריאות', 'Entertainment': 'בידור', 'Science': 'מדע', 'World': 'העולם', 'General': 'כללי' };

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-x-hidden">
      
      {/* Scroll Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 z-[60] pointer-events-none">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-100 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
          style={{ width: `${scrollProgress * 100}%`, opacity: scrollProgress > 0.01 ? 1 : 0 }}
        ></div>
      </div>

      {/* Ambient Background Blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-[120px] animate-blob"></div>
          <div className="absolute top-[20%] right-[-10%] w-[35%] h-[35%] bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] bg-teal-400/20 dark:bg-teal-600/10 rounded-full blur-[100px] animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-gray-200/50 dark:border-slate-800/50 transition-colors">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => updateNews(currentTopic)}>
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-500/20 transform group-hover:rotate-6 transition-transform">
              <Newspaper size={24} />
            </div>
            <div className="flex flex-col">
                <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight leading-none">
                Nova<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">News</span>
                </h1>
                <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">AI Intelligence</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button
                onClick={toggleFocusMode}
                className={`p-2.5 rounded-xl transition-all ${
                  focusMode 
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                    : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800'
                }`}
                title={focusMode ? 'בטל מיקוד' : 'מצב מיקוד'}
             >
                {focusMode ? <Eye size={20} /> : <EyeOff size={20} />}
             </button>

             <button 
               onClick={toggleDarkMode}
               className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800 transition-colors"
             >
               {darkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8 md:py-12 max-w-7xl relative z-10">
        
        {!focusMode && (
          <div className="animate-slide-up">
             <AgentPanel 
              agentState={agentState} 
              onUpdate={updateNews} 
              onImageUpload={handleImageUpload}
              searchHistory={[...new Set(searchHistory)]} 
              isAutoRefresh={isAutoRefresh}
              onToggleAutoRefresh={toggleAutoRefresh}
              currentArticles={articles}
              onClearHistory={clearHistory}
            />
          </div>
        )}

        {/* Filters & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 mt-4">
            <div className="flex items-baseline gap-4">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {focusMode ? 'כותרות ראשיות' : 'פיד חדשות'}
                </h2>
                {!agentState.isScanning && (
                    <span className="text-sm font-medium text-gray-500 animate-fade-in">
                        {filteredArticles.length} כתבות נמצאו
                    </span>
                )}
            </div>

            {!focusMode && (
                <div className="flex items-center gap-1 overflow-x-auto pb-4 lg:pb-0 no-scrollbar mask-gradient-r">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 transform hover:scale-105 ${
                                selectedCategory === cat 
                                ? 'bg-gray-900 text-white dark:bg-white dark:text-slate-900 shadow-lg shadow-gray-500/20' 
                                : 'bg-white/50 dark:bg-slate-800/50 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-700 border border-gray-200/50 dark:border-slate-700'
                            }`}
                        >
                            {categoryLabels[cat]}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50/50 dark:bg-red-900/20 backdrop-blur border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-6 py-4 rounded-2xl mb-8 flex items-center gap-4 animate-fade-in shadow-sm">
            <div className="bg-red-100 dark:bg-red-900/50 p-2 rounded-full">
                <Info className="w-5 h-5" />
            </div>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Loading Skeletons */}
        {agentState.isScanning && articles.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass-card rounded-2xl p-6 h-80 flex flex-col border border-gray-100 dark:border-slate-700 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-slate-700/40 to-transparent animate-[shimmer_1.5s_infinite] -skew-x-12"></div>
                <div className="flex justify-between mb-6">
                    <div className="h-6 bg-gray-200/70 dark:bg-slate-700/70 rounded-md w-1/3"></div>
                </div>
                <div className="h-8 bg-gray-200/70 dark:bg-slate-700/70 rounded-lg w-3/4 mb-3"></div>
                <div className="h-8 bg-gray-200/70 dark:bg-slate-700/70 rounded-lg w-1/2 mb-8"></div>
                <div className="flex-1 space-y-3">
                   <div className="h-4 bg-gray-200/70 dark:bg-slate-700/70 rounded w-full"></div>
                   <div className="h-4 bg-gray-200/70 dark:bg-slate-700/70 rounded w-full"></div>
                   <div className="h-4 bg-gray-200/70 dark:bg-slate-700/70 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* News Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 pb-20">
            {filteredArticles.length > 0 ? (
                filteredArticles.map((article, index) => (
                <div key={index} className="animate-slide-up" style={{animationDelay: `${index * 100}ms`}}>
                    <NewsCard article={article} />
                </div>
                ))
            ) : (
                !agentState.isScanning && (
                    <div className="col-span-full py-20 text-center flex flex-col items-center justify-center animate-fade-in">
                        <div className="p-8 rounded-full bg-gray-100/50 dark:bg-slate-800/50 mb-6 backdrop-blur-sm">
                            <Newspaper size={64} className="text-gray-300 dark:text-slate-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">לא נמצאו כתבות</h3>
                        <p className="text-gray-500 dark:text-gray-400">
                            {focusMode ? 'במצב מיקוד מוצגות רק כתבות כלליות.' : 'נסה לשנות את הקטגוריה או חפש נושא חדש.'}
                        </p>
                    </div>
                )
            )}
          </div>
        )}
      </main>

      {showScrollTop && (
        <button 
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 p-4 bg-blue-600/90 hover:bg-blue-600 text-white rounded-full shadow-2xl shadow-blue-500/30 backdrop-blur transition-all transform hover:scale-110 active:scale-95 z-40"
        >
            <ArrowUp size={24} />
        </button>
      )}

      {/* Footer */}
      <footer className="glass border-t border-gray-200/50 dark:border-slate-800/50 mt-auto py-8 relative z-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-sm gap-4">
          <div className="text-center md:text-right">
            <p className="font-bold text-gray-700 dark:text-gray-200">NovaNews AI</p>
            <p className="text-gray-500 dark:text-gray-500 mt-0.5">פלטפורמת חדשות מבוססת בינה מלאכותית</p>
          </div>
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/50 dark:bg-slate-800/50 rounded-full border border-gray-100 dark:border-slate-700">
                <Sparkles size={14} className="text-purple-500" />
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Powered by Gemini 2.5 & 3 Pro</span>
             </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;