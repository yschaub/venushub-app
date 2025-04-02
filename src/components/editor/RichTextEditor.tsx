import React, { useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import History from '@tiptap/extension-history';
import Placeholder from '@tiptap/extension-placeholder';
import { Annotation } from './AnnotationExtension';
import AnnotationPopover from '../AnnotationPopover';

export interface AnnotationMark {
  id: string;
  content: string;
  text: string;
  from: number;
  to: number;
}

export interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSelectionChange?: (selection: { from: number; to: number; text: string } | null) => void;
  onAnnotationClick?: (id: string) => void;
  onAnnotationCreate?: (annotation: AnnotationMark) => void;
  placeholder?: string;
  className?: string;
}

export interface RichTextEditorRef {
  addAnnotation: (content: string) => void;
  removeAnnotation: (id: string) => void;
  getAnnotations: () => AnnotationMark[];
  getHTML: () => string;
  getJSON: () => any;
  scrollToAnnotation: (id: string) => void;
}

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>((props, ref) => {
  const { content, onChange, onSelectionChange, onAnnotationClick, onAnnotationCreate, placeholder, className } = props;
  const [currentSelection, setCurrentSelection] = useState<{ from: number; to: number; text: string } | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [annotationContent, setAnnotationContent] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionTimeout, setSelectionTimeout] = useState<NodeJS.Timeout | null>(null);

  const updatePopoverPosition = useCallback(() => {
    const domSelection = window.getSelection();
    if (!domSelection || !domSelection.rangeCount) return;

    const range = domSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setPopoverPosition({
      x: rect.left + (rect.width / 2) - 150,
      y: rect.top - 10,
    });
  }, []);

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      History,
      Annotation,
      Placeholder.configure({
        placeholder: placeholder || 'Write your thoughts...',
      }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;

      if (from === to) {
        setCurrentSelection(null);
        setPopoverPosition(null);
        onSelectionChange && onSelectionChange(null);
        return;
      }

      const text = editor.state.doc.textBetween(from, to);

      if (text.trim() === '') {
        setCurrentSelection(null);
        setPopoverPosition(null);
        onSelectionChange && onSelectionChange(null);
        return;
      }

      const selection = { from, to, text };
      setCurrentSelection(selection);
      onSelectionChange && onSelectionChange(selection);
    },
  });

  useEffect(() => {
    if (!editor) return;

    const handleMouseDown = () => {
      setIsSelecting(true);
      setPopoverPosition(null);
      if (selectionTimeout) {
        clearTimeout(selectionTimeout);
        setSelectionTimeout(null);
      }
    };

    const handleMouseUp = () => {
      setIsSelecting(false);

      // Clear any existing timeout
      if (selectionTimeout) {
        clearTimeout(selectionTimeout);
      }

      // Set a new timeout to show the popover
      const timeout = setTimeout(() => {
        const { from, to } = editor.state.selection;
        if (from === to) return;

        const text = editor.state.doc.textBetween(from, to);
        if (!text.trim()) return;

        updatePopoverPosition();
      }, 400);

      setSelectionTimeout(timeout);
    };

    // Handle selection changes from keyboard (e.g., Shift+Arrow keys)
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End')) {
        if (selectionTimeout) {
          clearTimeout(selectionTimeout);
        }

        const timeout = setTimeout(() => {
          const { from, to } = editor.state.selection;
          if (from === to) return;

          const text = editor.state.doc.textBetween(from, to);
          if (!text.trim()) return;

          updatePopoverPosition();
        }, 400);

        setSelectionTimeout(timeout);
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener('mousedown', handleMouseDown);
    editorElement.addEventListener('mouseup', handleMouseUp);
    editorElement.addEventListener('keyup', handleKeyUp);

    return () => {
      if (selectionTimeout) {
        clearTimeout(selectionTimeout);
      }
      editorElement.removeEventListener('mousedown', handleMouseDown);
      editorElement.removeEventListener('mouseup', handleMouseUp);
      editorElement.removeEventListener('keyup', handleKeyUp);
    };
  }, [editor, selectionTimeout, updatePopoverPosition]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  const handleAddAnnotation = () => {
    if (!editor || !currentSelection) return;

    editor.chain().focus()
      .setAnnotation({ content: annotationContent })
      .run();

    // Get the newly created annotation
    const annotations = editor.state.doc.descendants((node, pos) => {
      const marks = node.marks.filter(mark => mark.type.name === 'annotation');
      if (marks.length > 0 && node.isText) {
        marks.forEach(mark => {
          if (mark.attrs.content === annotationContent) {
            const annotation: AnnotationMark = {
              id: mark.attrs.id,
              content: mark.attrs.content,
              text: node.text || '',
              from: pos,
              to: pos + node.nodeSize,
            };
            onAnnotationCreate?.(annotation);
          }
        });
      }
      return true;
    });

    setAnnotationContent('');
    setCurrentSelection(null);
    setPopoverPosition(null);
  };

  const handleCancelAnnotation = () => {
    setAnnotationContent('');
    setCurrentSelection(null);
    setPopoverPosition(null);
    editor?.commands.focus();
  };

  useImperativeHandle(ref, () => ({
    addAnnotation: (annotationContent: string) => {
      if (!editor || !currentSelection) return;

      editor.chain().focus()
        .setAnnotation({ content: annotationContent })
        .run();
    },
    removeAnnotation: (id: string) => {
      if (!editor) return;

      const annotations: { from: number; to: number }[] = [];
      editor.state.doc.descendants((node, pos) => {
        const marks = node.marks.filter(mark =>
          mark.type.name === 'annotation' &&
          mark.attrs.id === id
        );

        if (marks.length > 0 && node.isText) {
          annotations.push({
            from: pos,
            to: pos + node.nodeSize
          });
        }

        return true;
      });

      for (const { from, to } of annotations.reverse()) {
        editor.commands.setTextSelection({ from, to });
        editor.commands.unsetMark('annotation');
      }

      editor.commands.focus();
    },
    getAnnotations: () => {
      if (!editor) return [];

      const annotations: AnnotationMark[] = [];

      editor.state.doc.descendants((node, pos) => {
        const marks = node.marks.filter(mark => mark.type.name === 'annotation');

        if (marks.length > 0 && node.isText) {
          marks.forEach(mark => {
            annotations.push({
              id: mark.attrs.id,
              content: mark.attrs.content,
              text: node.text || '',
              from: pos,
              to: pos + node.nodeSize,
            });
          });
        }

        return true;
      });

      return annotations;
    },
    getHTML: () => {
      return editor ? editor.getHTML() : '';
    },
    getJSON: () => {
      return editor ? editor.getJSON() : {};
    },
    scrollToAnnotation: (id: string) => {
      if (!editor) return;

      editor.state.doc.descendants((node, pos) => {
        const marks = node.marks.filter(mark => mark.type.name === 'annotation' && mark.attrs.id === id);

        if (marks.length > 0) {
          editor.commands.setTextSelection({ from: pos, to: pos + node.nodeSize });
          editor.commands.scrollIntoView();
          return false;
        }

        return true;
      });
    }
  }));

  return (
    <div className={`prose-editor relative ${className || ''}`}>
      <EditorContent editor={editor} />
      <AnnotationPopover
        selectedText={currentSelection?.text || ''}
        annotationContent={annotationContent}
        onAnnotationChange={setAnnotationContent}
        onSubmit={handleAddAnnotation}
        onCancel={handleCancelAnnotation}
        position={popoverPosition}
      />
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;
