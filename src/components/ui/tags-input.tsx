
import * as React from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Tag = {
  id: string
  name: string
}

type TagsInputProps = {
  availableTags: Tag[]
  selectedTags: string[]
  onTagsChange: (selectedTags: string[]) => void
  placeholder?: string
}

export function TagsInput({
  availableTags,
  selectedTags,
  onTagsChange,
  placeholder = "Select tags...",
}: TagsInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = React.useState("")
  const [open, setOpen] = React.useState(false)

  const handleUnselect = (tagId: string) => {
    onTagsChange(selectedTags.filter((id) => id !== tagId))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const input = inputRef.current
    if (e.key === "Delete" || e.key === "Backspace") {
      if (input?.value === "") {
        onTagsChange(selectedTags.slice(0, -1))
      }
    }
    // Close the popover when pressing escape
    if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const selectableOptions = availableTags.filter(
    (tag) => 
      !selectedTags.includes(tag.id) && 
      (inputValue === "" || tag.name.toLowerCase().includes(inputValue.toLowerCase()))
  )

  return (
    <div className="flex flex-col gap-2">
      <div 
        className="group border border-input px-3 py-2 rounded-md flex items-center flex-wrap gap-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background"
        onKeyDown={handleKeyDown}
      >
        {selectedTags.map((tagId) => {
          const tag = availableTags.find((t) => t.id === tagId)
          if (!tag) return null
          
          return (
            <Badge key={tagId} variant="secondary" className="rounded-sm">
              {tag.name}
              <button
                className="ml-1 rounded-full outline-none"
                type="button"
                onClick={() => handleUnselect(tagId)}
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Remove {tag.name}</span>
              </button>
            </Badge>
          )
        })}
        
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setTimeout(() => setOpen(false), 200)
          }}
          placeholder={selectedTags.length === 0 ? placeholder : ""}
          className="ml-1 bg-transparent outline-none placeholder:text-muted-foreground flex-1 min-w-[120px] h-7"
        />
      </div>
      
      {open && selectableOptions.length > 0 && (
        <div className="relative">
          <div className="absolute top-0 z-10 w-full bg-popover text-popover-foreground rounded-md border border-border shadow-md animate-in">
            <div className="overflow-auto max-h-[300px] p-1">
              {selectableOptions.map((tag) => (
                <div
                  key={tag.id}
                  onClick={() => {
                    onTagsChange([...selectedTags, tag.id])
                    setInputValue("")
                  }}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                  )}
                >
                  {tag.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
