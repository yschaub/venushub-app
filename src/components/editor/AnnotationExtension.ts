
import { Mark, markPasteRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { v4 as uuidv4 } from 'uuid';

export interface AnnotationOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    annotation: {
      /**
       * Set an annotation mark
       */
      setAnnotation: (attributes?: { id?: string; content?: string }) => ReturnType;
      /**
       * Unset an annotation mark
       */
      unsetAnnotation: () => ReturnType;
    };
  }
}

export const Annotation = Mark.create<AnnotationOptions>({
  name: 'annotation',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-annotation-id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {};
          }

          return {
            'data-annotation-id': attributes.id,
          };
        },
      },
      content: {
        default: null,
        parseHTML: element => element.getAttribute('data-annotation-content'),
        renderHTML: attributes => {
          if (!attributes.content) {
            return {};
          }

          return {
            'data-annotation-content': attributes.content,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-annotation-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...this.options.HTMLAttributes,
        ...HTMLAttributes,
        class: 'annotation-mark bg-yellow-100 dark:bg-yellow-900/30 rounded',
      },
      0,
    ];
  },

  addCommands() {
    return {
      setAnnotation:
        attributes => ({ commands }) => {
          const id = attributes?.id || uuidv4();
          return commands.setMark(this.name, { id, content: attributes?.content || '' });
        },
      unsetAnnotation:
        () => ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-a': () => this.editor.commands.toggleMark(this.name),
    };
  },
});
