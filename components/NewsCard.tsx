import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NewsArticle } from '../types';
import { Clock, Share2, Volume2, PauseCircle, Check, Loader2, ArrowUpRight } from 'lucide-react';
import { generateSpeech } from '../services/geminiService';

interface NewsCardProps {
  article: NewsArticle;
}

const categoryStyles: Record<string, string> = {
  Politics: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-900/30',
  Technology: 'bg-cyan-50 text-cyan-600 border-cyan-100 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-900/30',
  Sports: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/30',
  Economy: 'bg-violet-50 text-violet-600 border-violet-100 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-900/30',
  Health: 'bg-teal-50 text-teal-600 border-teal-100 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-900/30',
  Entertainment: 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100 dark:bg-fuchsia-900/20 dark:text-fuchsia-300 dark:border-fuchsia-900/30',
  Science: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-900/30',
  World: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30',
  General: 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const getCategoryStyle = (cat: string) => {
  if (!cat) return categoryStyles['General'];
  const normalized = Object.keys(categoryStyles).find(k => k.toLowerCase() === cat.toLowerCase()) || 'General';
  return categoryStyles[normalized];
};

const getCategoryLabel = (cat: string) => {
  if (!cat) return 'כללי';
  const map: Record<string, string> = {
    Politics: 'פוליטיקה',
    Technology: 'טכנולוגיה',
    Sports: 'ספורט',
    Economy: 'כלכלה',
    Health: 'בריאות',
    Entertainment: 'בידור',
    Science: 'מדע',
    World: 'העולם',
    General: 'כללי'
  };
  const normalized = Object.keys(map).find(k => k.toLowerCase() === cat.toLowerCase()) || 'General';
  return map[normalized];
};

const getPriorityColor = (priority?: string) => {
    switch (priority) {
        case 'High': return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse';
        case 'Medium': return 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]';
        case 'Low': return 'bg-blue-400';
        default: return 'bg-gray-300 dark:bg-gray-600';
    }
};

export const NewsCard: React.FC<NewsCardProps> = ({ article }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    return () => stopAudio();
  }, []);

  const stopAudio = () => {
    if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch (e) {}
        sourceNodeRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleSpeak = async () => {
    if (isPlaying) { stopAudio(); return; }
    setIsLoadingAudio(true);
    try {
        const audioBufferData = await generateSpeech(article.summary || article.title);
        if (audioBufferData) {
             if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                 audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
             }
             const ctx = audioContextRef.current;
             const audioBuffer = await ctx.decodeAudioData(audioBufferData);
             const source = ctx.createBufferSource();
             source.buffer = audioBuffer;
             source.connect(ctx.destination);
             source.onended = () => { setIsPlaying(false); sourceNodeRef.current = null; };
             source.start(0);
             sourceNodeRef.current = source;
             setIsPlaying(true);
        }
    } catch (e) {
        console.error("Failed to play audio", e);
    } finally {
        setIsLoadingAudio(false);
    }
  };

  const handleShare = () => {
    if (article.sourceUrl) {
      navigator.clipboard.writeText(article.sourceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const { hostname, safeUrl } = useMemo(() => {
      if (!article.sourceUrl) return { hostname: null, safeUrl: null };
      try {
          const u = new URL(article.sourceUrl);
          return { hostname: u.hostname.replace('www.', ''), safeUrl: article.sourceUrl };
      } catch {
          return { hostname: null, safeUrl: null };
      }
  }, [article.sourceUrl]);

  return (
    <div 
        className={`glass-card rounded-2xl border transition-all duration-500 flex flex-col h-full group relative overflow-hidden 
        ${isHovered 
            ? 'border-blue-300/60 dark:border-blue-500/50 shadow-[0_0_25px_rgba(59,130,246,0.25)] dark:shadow-[0_0_25px_rgba(30,58,138,0.4)]' 
            : 'border-gray-100 dark:border-slate-800 shadow-sm'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
            transform: isHovered ? 'scale(1.02) translateY(-4px)' : 'scale(1) translateY(0)'
        }}
    >
      
      {/* Glow Overlay Effect */}
      <div 
        className={`absolute inset-0 bg-gradient-to-br from-blue-400/5 to-purple-400/5 dark:from-blue-600/10 dark:to-purple-600/10 transition-opacity duration-500 pointer-events-none 
        ${isHovered ? 'opacity-100' : 'opacity-0'}`} 
      />

      {/* Decorative gradient line at top */}
      <div className={`h-1 w-full bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 transition-opacity duration-500 ${isHovered ? 'opacity-100' : 'opacity-0'}`}></div>
      
      <div className="p-6 flex-1 flex flex-col relative z-10">
        {/* Header: Date & Category */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${getCategoryStyle(article.category)}`}>
                {getCategoryLabel(article.category)}
              </span>
              {/* Priority Indicator */}
              {article.priority && (
                  <span className={`h-2.5 w-2.5 rounded-full ${getPriorityColor(article.priority)}`} title={`Priority: ${article.priority}`}></span>
              )}
          </div>
          <div className="flex items-center text-gray-400 dark:text-gray-500 text-xs font-medium">
            <Clock size={12} className="ml-1.5" />
            {article.publishedAt}
          </div>
        </div>
        
        {/* Content */}
        <h3 className={`text-lg md:text-xl font-bold text-gray-900 dark:text-gray-50 mb-3 leading-tight transition-colors duration-300 ${isHovered ? 'text-blue-600 dark:text-blue-400' : ''}`}>
          {article.title}
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed flex-grow">
          {article.summary}
        </p>
      </div>
      
      {/* Footer Actions */}
      <div className="px-5 py-3 border-t border-gray-50 dark:border-slate-800/50 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50 relative z-10 backdrop-blur-sm">
        <div className="flex gap-1">
          <button 
            onClick={handleSpeak}
            disabled={isLoadingAudio}
            className={`p-2 rounded-full transition-all ${
                isPlaying 
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' 
                    : 'text-gray-400 hover:bg-white hover:text-blue-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-blue-400 hover:shadow-sm'
            }`}
            title="Read Aloud"
          >
            {isLoadingAudio ? <Loader2 size={16} className="animate-spin" /> : isPlaying ? <PauseCircle size={16} /> : <Volume2 size={16} />}
          </button>
          
          <button 
            onClick={handleShare}
            disabled={!article.sourceUrl}
            className="p-2 text-gray-400 hover:text-green-600 hover:bg-white dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-green-400 rounded-full transition-all hover:shadow-sm"
            title="Share URL"
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Share2 size={16} />}
          </button>
        </div>

        {safeUrl && (
            <a 
                href={safeUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 group/link pl-2 pr-1 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors max-w-[60%]"
            >
                <div className="flex flex-col items-end overflow-hidden">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate w-full text-left dir-ltr">
                        {article.sourceName || hostname}
                    </span>
                    <span className="text-[10px] text-gray-400 truncate w-full text-left dir-ltr group-hover/link:text-blue-500 transition-colors">
                        {hostname}
                    </span>
                </div>
                <ArrowUpRight size={14} className="text-gray-300 group-hover/link:text-blue-500 transition-colors" />
            </a>
        )}
      </div>
    </div>
  );
};