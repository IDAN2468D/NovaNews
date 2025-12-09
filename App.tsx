import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchNewsFromAgent, analyzeImage, fetchDeepResearch } from './services/geminiService';
import { NewsArticle, AgentState, Category, RefreshMode } from './types';
import { NewsCard } from './components/NewsCard';
import { AgentPanel } from './components/AgentPanel';
import { Newspaper, Info, Moon, Sun, Eye, EyeOff, ArrowUp } from 'lucide-react';

// Configuration
const REFRESH_INTERVALS: Record<RefreshMode, number> = {
    manual: 0,
    rapid: 120000, // 2 minutes
    hourly: 3600000, // 1 hour
    daily: 86400000 // 24 hours
};

const App: React.FC = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<NewsArticle[]>([]);
  const [agentState, setAgentState] = useState<AgentState>({
    isScanning: false,
    lastUpdated: null,
    statusMessage: "מאתחל מערכת...",
  });
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [focusMode, setFocusMode] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  
  // Agent Autonomy Settings
  const [refreshMode, setRefreshMode] = useState<RefreshMode>('daily');
  const [currentTopic, setCurrentTopic] = useState("חדשות חמות בישראל");
  const [nextRefreshTime, setNextRefreshTime] = useState<number>(0);
  
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load preferences
  useEffect(() => {
    try {
        const savedHistory = localStorage.getItem('novaNewsHistory');
        if (savedHistory) setSearchHistory(JSON.parse(savedHistory));
        
        const savedFocus = localStorage.getItem('novaFocusMode');
        if (savedFocus === 'true') setFocusMode(true);

        const savedMode = localStorage.getItem('novaRefreshMode');
        if (savedMode) setRefreshMode(savedMode as RefreshMode);
    } catch(e) { console.warn("Storage access limited"); }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
    
    // Initial fetch trigger
    updateNews("חדשות חמות בישראל", false);

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
      const totalScroll = document.documentElement.scrollTop;
      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (windowHeight > 0) setScrollProgress(totalScroll / windowHeight);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Autonomous Agent Loop
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    
    if (refreshMode !== 'manual') {
        const interval = REFRESH_INTERVALS[refreshMode];
        setNextRefreshTime(Date.now() + interval);
        
        refreshTimerRef.current = setInterval(() => {
            if (!agentState.isScanning) {
                console.log(`Autonomous Agent (${refreshMode}): Triggering refresh...`);
                updateNews(currentTopic, false);
                setNextRefreshTime(Date.now() + interval);
            }
        }, interval);
    } else {
        setNextRefreshTime(0);
    }

    return () => {
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [refreshMode, currentTopic, agentState.isScanning]);

  const toggleFocusMode = () => {
      setFocusMode(prev => {
          try { localStorage.setItem('novaFocusMode', String(!prev)); } catch(e){}
          return !prev;
      });
  };

  const handleModeChange = (mode: RefreshMode) => {
      setRefreshMode(mode);
      try { localStorage.setItem('novaRefreshMode', mode); } catch(e){}
  };

  useEffect(() => {
    if (focusMode) {
      setFilteredArticles(articles.filter(a => a.category === 'General'));
    } else {
      if (selectedCategory === 'All') setFilteredArticles(articles);
      else setFilteredArticles(articles.filter(a => a.category.toLowerCase() === selectedCategory.toLowerCase()));
    }
  }, [selectedCategory, articles, focusMode]);

  const updateNews = useCallback(async (topic: string, isDeepSearch: boolean = false) => {
    setCurrentTopic(topic);
    setAgentState(prev => ({
      ...prev,
      isScanning: true,
      statusMessage: isDeepSearch ? `מנתח לעומק: ${topic}...` : `מחפש חדשות: ${topic}...`
    }));
    setError(null);
    if (!focusMode) setSelectedCategory('All');

    if (topic && !topic.startsWith("Image Analysis")) {
        setSearchHistory(prev => {
            const newH = [topic, ...prev.filter(t => t !== topic)].slice(0, 10);
            try { localStorage.setItem('novaNewsHistory', JSON.stringify(newH)); } catch(e){}
            return newH;
        });
    }

    try {
      const newArticles = isDeepSearch 
        ? await fetchDeepResearch(topic) 
        : await fetchNewsFromAgent(topic);
      
      setArticles(newArticles);
      setAgentState({ isScanning: false, lastUpdated: new Date(), statusMessage: "עודכן בהצלחה" });
    } catch (err) {
      console.error(err);
      setError("שגיאה בטעינת הנתונים");
      setAgentState(prev => ({ ...prev, isScanning: false, statusMessage: "שגיאה" }));
    }
  }, [focusMode]);

  const handleImageUpload = async (file: File) => {
    setAgentState(prev => ({ ...prev, isScanning: true, statusMessage: "מפענח תמונה..." }));
    try {
        const reader = new FileReader();
        reader.onloadend = async () => {
            if (typeof reader.result === 'string') {
                const base64Data = reader.result.split(',')[1];
                const article = await analyzeImage(base64Data, file.type);
                setArticles(prev => [article, ...prev]);
                setAgentState({ isScanning: false, lastUpdated: new Date(), statusMessage: "הושלם" });
            }
        };
        reader.readAsDataURL(file);
    } catch (e) {
        setError("שגיאה בהעלאת התמונה");
        setAgentState(prev => ({ ...prev, isScanning: false }));
    }
  };

  const categories: (Category | 'All')[] = ['All', 'Politics', 'Technology', 'Economy', 'Sports', 'Health', 'Entertainment', 'Science', 'World', 'General'];
  const categoryLabels: Record<string, string> = { 'All': 'הכל', 'Politics': 'פוליטיקה', 'Technology': 'טכנולוגיה', 'Economy': 'כלכלה', 'Sports': 'ספורט', 'Health': 'בריאות', 'Entertainment': 'בידור', 'Science': 'מדע', 'World': 'עולם', 'General': 'כללי' };

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-1 z-[60] pointer-events-none">
        <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-100 ease-out" style={{ width: `${scrollProgress * 100}%`, opacity: scrollProgress > 0.01 ? 1 : 0 }}></div>
      </div>

      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-[100px]"></div>
      </div>

      <header className="sticky top-0 z-50 glass border-b border-gray-200/50 dark:border-slate-800/50">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => updateNews("חדשות")}>
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-xl text-white shadow-lg">
              <Newspaper size={24} />
            </div>
            <div>
                <h1 className="text-2xl font-black text-gray-800 dark:text-white leading-none">
                Nova<span className="text-blue-600">News</span>
                </h1>
                <span className="text-[10px] font-bold text-gray-400 uppercase">AI AGENT</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button onClick={toggleFocusMode} className="p-2.5 rounded-xl transition-all hover:bg-gray-100 dark:hover:bg-slate-800">
                {focusMode ? <Eye size={20} className="text-purple-500" /> : <EyeOff size={20} className="text-gray-500" />}
             </button>
             <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800">
               {darkMode ? <Sun size={20} className="text-gray-400" /> : <Moon size={20} className="text-gray-500" />}
             </button>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-8 max-w-7xl relative z-10">
        {!focusMode && (
          <AgentPanel 
              agentState={agentState} 
              onUpdate={updateNews} 
              onImageUpload={handleImageUpload}
              searchHistory={searchHistory} 
              refreshMode={refreshMode}
              onModeChange={handleModeChange}
              currentArticles={articles}
              onClearHistory={() => setSearchHistory([])}
              nextRefreshTime={nextRefreshTime}
            />
        )}

        <div className="flex flex-col lg:flex-row justify-between gap-6 mb-8 mt-4">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{focusMode ? 'כותרות' : 'עדכונים'}</h2>
            {!focusMode && (
                <div className="flex items-center gap-1 overflow-x-auto pb-2 no-scrollbar">
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                                selectedCategory === cat ? 'bg-gray-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white/50 text-gray-600'
                            }`}>
                            {categoryLabels[cat]}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 flex items-center gap-2 border border-red-100">
            <Info size={18} /> {error}
          </div>
        )}

        {agentState.isScanning && articles.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="h-80 bg-gray-100/50 dark:bg-slate-800/50 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
            {filteredArticles.map((article, index) => (
                <div key={index} className="animate-slide-up" style={{animationDelay: `${index * 50}ms`}}>
                    <NewsCard article={article} />
                </div>
            ))}
          </div>
        )}
      </main>

      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="fixed bottom-8 right-8 p-4 bg-blue-600 text-white rounded-full shadow-lg z-40 hover:scale-110 transition-transform">
            <ArrowUp size={24} />
        </button>
      )}
    </div>
  );
};

export default App;