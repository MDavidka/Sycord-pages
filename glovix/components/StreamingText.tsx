'use client'
import { useState, useEffect, memo } from 'react';

interface StreamingTextProps {
    text: string;
    className?: string;
    speed?: number; // ms per character
}

export const StreamingText = memo(function StreamingText({ text, className = '', speed = 30 }: StreamingTextProps) {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        setDisplayedText('');
        setCurrentIndex(0);
    }, [text]);

    useEffect(() => {
        if (currentIndex < text.length) {
            const timeout = setTimeout(() => {
                setDisplayedText(text.slice(0, currentIndex + 1));
                setCurrentIndex(currentIndex + 1);
            }, speed);
            return () => clearTimeout(timeout);
        }
    }, [currentIndex, text, speed]);

    return (
        <span className={className}>
            {displayedText}
            {currentIndex < text.length && (
                <span className="animate-pulse">|</span>
            )}
        </span>
    );
});