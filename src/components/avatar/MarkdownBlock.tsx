import { useEffect, useRef } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { renderMarkdown } from '@/utils/messageParser';

interface MarkdownBlockProps {
  content: string;
}

export default function MarkdownBlock({ content = "" }: MarkdownBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleLinks = () => {
    if (!containerRef.current) return;
    const links = containerRef.current.querySelectorAll("a[href]");
    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const href = link.getAttribute("href");
        if (href) {
          openUrl(href);
        }
      });
    });
  };

  useEffect(() => {
    // When content changes, re-run link setup
    handleLinks();
  }, [content]);

  return (
    <div ref={containerRef} className="markdown-content">
      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
    </div>
  );
}
