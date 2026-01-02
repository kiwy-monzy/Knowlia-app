export const decodeHtmlEntities = (text: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  return doc.documentElement.textContent || '';
}; 