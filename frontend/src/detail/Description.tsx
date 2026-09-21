import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { Marker } from '../types';

export default function Description({ text, format }: { text: string | null; format: Marker['description_format'] }) {
  const html = useMemo(() => {
    if (!text || format === 'text') return '';
    const rendered = format === 'markdown' ? marked.parse(text, { async: false }) : text;
    return DOMPurify.sanitize(rendered, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'h3', 'h4', 'hr'],
      ALLOWED_ATTR: ['href', 'title'],
      ALLOW_DATA_ATTR: false,
    });
  }, [text, format]);
  if (format === 'text') return <p className="description">{text}</p>;
  return <div className="description" dangerouslySetInnerHTML={{ __html: html }} />;
}
