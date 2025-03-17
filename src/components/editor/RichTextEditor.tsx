
import React, { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import History from '@tiptap/extension-history';
import Placeholder from '@tiptap/extension-placeholder';
import { Annotation } from './AnnotationExtension';

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
  const { content, onChange, onSelectionChange, onAnnotationClick, placeholder, className } = props;
  const [currentSelection, setCurrentSelection] = useState<{ from: number; to: number; text: string } | null>(null);

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
        onSelectionChange && onSelectionChange(null);
        return;
      }
      
      const text = editor.state.doc.textBetween(from, to);
      
      if (text.trim() === '') {
        setCurrentSelection(null);
        onSelectionChange && onSelectionChange(null);
        return;
      }
      
      const selection = { from, to, text };
      setCurrentSelection(selection);
      onSelectionChange && onSelectionChange(selection);
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // Only update if content has changed to avoid cursor jumping
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  useImperativeHandle(ref, () => ({
    addAnnotation: (annotationContent: string) => {
      if (!editor || !currentSelection) return;
      
      editor.chain().focus()
        .setAnnotation({ content: annotationContent })
        .run();
    },
    removeAnnotation: (id: string) => {
      if (!editor) return;
      
      // Find all occurrences of the annotation with the given ID
      const annotations: {from: number; to: number}[] = [];
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
      
      // Remove each found annotation
      for (const {from, to} of annotations.reverse()) { // Process in reverse to maintain position integrity
        editor.chain()
          .focus()
          .removeTextStyle({from, to})
          .unsetMark('annotation', {from, to})
          .run();
      }
      
      editor.chain().focus().run();
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
    <div className={`prose-editor ${className || ''}`}>
      <EditorContent editor={editor} />
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;
