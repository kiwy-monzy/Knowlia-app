// src/lib/utils/messageParser.ts
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";

// Define the structure for each part of the message
export type MessagePart =
  | { type: "markdown"; content: string }
  | { type: "text"; content: string }
  | { type: "code"; content: string }
  | { type: "tool_call"; content: string }
  | { type: "thinking"; content: string; isComplete: boolean };

// We'll reuse the 'marked' setup for markdown rendering
const marked = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  }),
);
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Helper function to check if we're currently in a thinking block
export function isCurrentlyThinking(text: string): boolean {
  // Count opening and closing think tags
  const openTags = (text.match(/<think>/g) || []).length;
  const closeTags = (text.match(/<\/think>/g) || []).length;

  // If we have more opening tags than closing tags, we're thinking
  return openTags > closeTags;
}

// The main parsing function
export function parseMessage(text: string): MessagePart[] {
  if (!text) return [];

  // This regex splits the text by <think> and </think> tags, keeping the tags
  const splitRegex = /(<think>|<\/think>)/g;
  const tokens = text.split(splitRegex).filter(Boolean);

  const parts: MessagePart[] = [];
  let currentContent = "";
  let inThinkingBlock = false;
  let currentThinkingContent = "";

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === "<think>") {
      // If we have accumulated markdown content, add it as a part
      if (currentContent.trim()) {
        parts.push({ type: "markdown", content: currentContent });
        currentContent = "";
      }

      inThinkingBlock = true;
      currentThinkingContent = "";
    } else if (token === "</think>") {
      if (inThinkingBlock) {
        // Add the completed thinking block
        parts.push({
          type: "thinking",
          content: currentThinkingContent.trim(),
          isComplete: true,
        });
        currentThinkingContent = "";
        inThinkingBlock = false;
      }
    } else {
      // Regular content
      if (inThinkingBlock) {
        currentThinkingContent += token;
      } else {
        currentContent += token;
      }
    }
  }

  // Handle any remaining content
  if (currentContent.trim()) {
    parts.push({ type: "markdown", content: currentContent });
  }

  // If we're still in a thinking block, add an incomplete thinking part
  if (inThinkingBlock && currentThinkingContent) {
    parts.push({
      type: "thinking",
      content: currentThinkingContent.trim(),
      isComplete: false,
    });
  }

  return parts;
}

export function renderMarkdown(markdownContent: string): string {
  return marked.parse(markdownContent) as string;
}

export function createDemoMessage(): string {
  return `## Welcome to TableTop AI! 👋🐦

I'm ready to assist you and provide valuable insights!

- Click my avatar to hide or show \`this\` message.
- Visit the project's GitHub repository [here](https://github.com/Vokturz/loyca-ai).
`;
}

// export function createDemoMessage(): string {
//   return `# Welcome! 👋

// Click my avatar to hide or show \`this\` message.

// <think>
// Here's a breakdown of the plan:
// 1. Greet the user.
// 2. Explain how to use the interface.
// 3. Provide a code example.
// 4. Show off the new "thinking" feature.
// </think>

// You can find a link [here](https://tauri.app).

// \`\`\`python
// def fibonacci(n):
//   if n <= 1:
//       return n
//   else:
//       return fibonacci(n-1) + fibonacci(n-2)

// def factorial(n):
//   if n == 0:
//       return 1
//   else:
//       return n * factorial(n-1)

// def gcd(a, b):
//   if b == 0:
//       return a
//   else:
//       return gcd(b, a % b)

// def lcm(a, b):
//   return abs(a*b) // gcd(a, b)

// def quick_sort(arr):
//   if len(arr) <= 1:
//       return arr
//   pivot = arr[len(arr) // 2]
//   left = [x for x in arr if x < pivot]
//   middle = [x for x in arr if x == pivot]
//   right = [x for x in arr if x > pivot]
//   return quick_sort(left) + middle + quick_sort(right)

// \`\`\`

// - List item 1
// - List item 2

// 1. Number 1
// 2. Number 2
// `;
// }
