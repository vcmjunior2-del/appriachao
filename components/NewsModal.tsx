import React from 'react';
import { NewsItem } from '../types';

interface NewsModalProps {
  news: NewsItem | null;
  onClose: () => void;
}

const NewsModal: React.FC<NewsModalProps> = ({ news, onClose }) => {
  if (!news) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-card-dark w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
        <div className="relative h-64 w-full bg-cover bg-center">
          {news.videoUrl ? (
            <video src={news.videoUrl} controls className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url("${news.imageUrl}")` }} />
          )}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/50 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{news.title}</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{news.description}</p>
        </div>
      </div>
    </div>
  );
};

export default NewsModal;
