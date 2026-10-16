import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { wikiLinks } from '../lib/domain';

export function Markdown({
  content,
  onWikiLink,
}: {
  content: string;
  onWikiLink?: (title: string) => void;
}) {
  const processed = onWikiLink
    ? content.replace(
        /\[\[([^\]\n]+)\]\]/g,
        (_, title: string) => `[${title.trim()}](#wiki:${encodeURIComponent(title.trim())})`,
      )
    : content;
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) =>
            href?.startsWith('#wiki:') ? (
              <button
                className="wiki-inline-link"
                onClick={() => onWikiLink?.(decodeURIComponent(href.slice(6)))}
              >
                {children}
              </button>
            ) : (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
          table: ({ children }) => (
            <div className="table-scroll">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
export { wikiLinks };
