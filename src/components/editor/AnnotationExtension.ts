import { Mark, mergeAttributes } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    annotation: {
      setAnnotation: (attributes: { content: string }) => ReturnType;
      unsetAnnotation: () => ReturnType;
    };
  }
}

export const Annotation = Mark.create({
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
        parseHTML: element => element.getAttribute('data-id'),
        renderHTML: attributes => ({
          'data-id': attributes.id,
        }),
      },
      content: {
        default: null,
        parseHTML: element => element.getAttribute('data-content'),
        renderHTML: attributes => ({
          'data-content': attributes.content,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'mark[data-type="annotation"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(
      this.options.HTMLAttributes,
      HTMLAttributes,
      { 'data-type': 'annotation' }
    ), 0];
  },

  addCommands() {
    return {
      setAnnotation:
        attributes =>
          ({ commands, state }) => {
            const { selection } = state;
            const id = uuidv4();

            // Don't apply annotation if there's no text selected
            if (selection.empty) {
              return false;
            }

            return commands.setMark(this.name, {
              ...attributes,
              id,
            });
          },
      unsetAnnotation:
        () =>
          ({ commands }) => {
            return commands.unsetMark(this.name);
          },
    };
  },

  // Allow other marks to be applied alongside annotations
  inclusive: false,
});
