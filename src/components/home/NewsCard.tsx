import React from 'react';
import { cn } from '@/lib/utils';
import { decodeHtmlEntities } from '@/lib/htmlDecode';
import { ExternalLink, Calendar, Tag } from 'lucide-react';

export interface NewsArticle {
  title: string;
  url: string;
  image: string;
  date: string;
  category: string;
  summary: string;
}

interface NewsCardProps {
  article: NewsArticle;
  onReadMore: (url: string) => void;
  loading?: boolean;
  status?: "success" | "warning" | "danger" | "info" | "neutral";
}

const NewsCard: React.FC<NewsCardProps> = ({
  article,
  onReadMore,
  loading = false,
  status = 'info'
}) => {
  const statusClasses = {
    success: "bg-status-operational/10 text-status-operational border-status-operational/30",
    warning: "bg-status-maintenance/10 text-status-maintenance border-status-maintenance/30",
    danger: "bg-status-warning/10 text-status-warning border-status-warning/30",
    info: "bg-primary/10 text-primary border-primary/30",
    neutral: "bg-muted text-muted-foreground border-muted-foreground/30"
  };

  const iconClasses = {
    success: "bg-status-operational text-white",
    warning: "bg-status-maintenance text-white",
    danger: "bg-status-warning text-white",
    info: "bg-primary text-white",
    neutral: "bg-muted-foreground text-white"
  };

  return (
    <div className={cn(
      "glass-card glass-card-hover rounded-xl overflow-hidden relative transition-all duration-300 ",
      status && statusClasses[status]
    )}>
      {/* Article Image */}
      <div className="aspect-video overflow-hidden">
        <img 
          src={article.image} 
          alt={article.title}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          onError={(e) => {
            e.currentTarget.src = 'https://via.placeholder.com/400x225/2f3136/ffffff?text=No+Image';
          }}
        />
      </div>

      {/* Article Content */}
      <div className="p-4 space-y-3">
        {/* Meta Information */}
        <div className="flex items-center justify-between text-xs text-discord-text-muted">
          <div className="flex items-center space-x-2">
            <Tag className="w-3 h-3" />
            <span className="bg-discord-accent px-2 py-1 rounded">
              {article.category}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="w-3 h-3" />
            <span>{article.date}</span>
          </div>
        </div>

        {/* Article Title */}
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-2 leading-tight">
          {decodeHtmlEntities(article.title)}
        </h3>

        {/* Article Summary */}
        <p className="text-gray-600 dark:text-gray-400 text-xs line-clamp-3 leading-relaxed">
          {decodeHtmlEntities(article.summary)}
        </p>

        {/* Read More Button */}
        <button 
          onClick={() => onReadMore(article.url)}
          disabled={loading}
          className={cn(
            "inline-flex items-center space-x-1 text-xs font-medium transition-colors duration-200",
            "text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <span>{loading ? 'Loading...' : 'Read more'}</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-current opacity-10"></div>
      <div className="absolute right-8 -bottom-6 w-10 h-10 rounded-full bg-current opacity-5"></div>
    </div>
  );
};

export default NewsCard; 