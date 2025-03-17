
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface Tag {
  id: string;
  name: string;
}

interface JournalEntryFormProps {
  onSubmit: (entry: {
    title: string;
    content: string;
    tags: string[];
  }) => void;
  onCancel: () => void;
  tags: Tag[];
  initialValues?: {
    title: string;
    content: string;
    tags: string[];
  };
}

const JournalEntryForm: React.FC<JournalEntryFormProps> = ({
  onSubmit,
  onCancel,
  tags,
  initialValues = { title: '', content: '', tags: [] }
}) => {
  const [title, setTitle] = useState(initialValues.title);
  const [content, setContent] = useState(initialValues.content);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialValues.tags);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      content,
      tags: selectedTags
    });
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Entry title"
          required
        />
      </div>
      
      <div>
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your thoughts..."
          rows={5}
          className="min-h-[150px]"
        />
      </div>
      
      {tags.length > 0 && (
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="grid grid-cols-2 gap-2">
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`tag-${tag.id}`}
                  checked={selectedTags.includes(tag.id)}
                  onCheckedChange={() => handleTagToggle(tag.id)}
                />
                <Label htmlFor={`tag-${tag.id}`} className="cursor-pointer">
                  {tag.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex justify-end space-x-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit">Save Entry</Button>
      </div>
    </form>
  );
};

export default JournalEntryForm;
