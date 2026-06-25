'use client'
import { ExternalLink, Image as ImageIcon } from 'lucide-react';

interface SearchResult {
    title: string;
    url: string;
    content: string;
    score?: number;
}

interface SearchData {
    query?: string;
    answer?: string;
    results?: SearchResult[];
    images?: Array<{ url: string; description?: string }>;
}

interface SearchResultsBlockProps {
    data: SearchData;
    isDark: boolean;
}

export function SearchResultsBlock({ data, isDark }: SearchResultsBlockProps) {
    if (!data) return null;
    
    const { query, answer, results = [], images = [] } = data;

    return (
        <div className={`my-4 rounded-xl border overflow-hidden ${isDark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-gray-50 border-gray-200'}`}>
            {/* Header */}
            <div className={`px-4 py-3 border-b flex items-center gap-2 ${isDark ? 'border-[#2a2a2a]' : 'border-gray-200'}`}>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Web Search Results
                </span>
                {query && (
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        "{query}"
                    </span>
                )}
            </div>

            <div className="p-4 space-y-4">
                {/* Answer Summary */}
                {answer && (
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-[#18191B]' : 'bg-white'}`}>
                        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {answer}
                        </p>
                    </div>
                )}

                {/* Search Results */}
                {results.length > 0 && (
                    <div className="space-y-2">
                        {results.map((result, idx) => (
                            <a
                                key={idx}
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`block p-3 rounded-lg transition-colors ${
                                    isDark 
                                        ? 'bg-[#18191B] hover:bg-[#1f1f1f]' 
                                        : 'bg-white hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-start gap-2">
                                    <ExternalLink className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`text-sm font-medium mb-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                            {result.title}
                                        </h4>
                                        <p className={`text-xs line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            {result.content}
                                        </p>
                                        <p className={`text-xs mt-1 truncate ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                            {result.url}
                                        </p>
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                )}

                {/* Images */}
                {images.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <ImageIcon className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                            <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Related Images
                            </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {images.slice(0, 6).map((img, idx) => (
                                <a
                                    key={idx}
                                    href={img.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`relative aspect-video rounded-lg overflow-hidden group ${
                                        isDark ? 'bg-[#18191B]' : 'bg-gray-100'
                                    }`}
                                >
                                    <img
                                        src={img.url}
                                        alt={img.description || 'Search result'}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                        loading="lazy"
                                    />
                                    {img.description && (
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                            <p className="text-xs text-white line-clamp-1">
                                                {img.description}
                                            </p>
                                        </div>
                                    )}
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}