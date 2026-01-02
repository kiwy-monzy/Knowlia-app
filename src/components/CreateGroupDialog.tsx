"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface CreateGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateGroup: (groupName: string) => void
}

export default function CreateGroupDialog({ open, onOpenChange, onCreateGroup }: CreateGroupDialogProps) {
  const [groupName, setGroupName] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!groupName.trim()) return
    
    setIsLoading(true)
    
    try {
      await onCreateGroup(groupName.trim())
      setGroupName("")
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to create group:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setGroupName("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 border-blue-700 text-white p-0 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/50 via-transparent to-indigo-900/50 pointer-events-none" />
        
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full bg-white/10 hover:bg-white/20 transition-colors p-2 z-10"
          disabled={isLoading}
        >
          <X className="h-4 w-4 text-white" />
        </button>

        <DialogHeader className="p-8 pb-6 text-center">
          <DialogTitle className="text-2xl font-bold text-white mb-2">
            Create New Group
          </DialogTitle>
          <DialogDescription className="text-blue-100 text-sm">
            Enter a name for your new group chat.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-8 pb-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name" className="text-white text-xs font-bold uppercase tracking-wider">
                Group Name *
              </Label>
              <Input
                id="group-name"
                type="text"
                placeholder="Enter group name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="bg-blue-800/50 border-blue-600 text-white placeholder-blue-200 focus:border-blue-400 focus:ring-blue-400"
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full mt-6 bg-white text-blue-900 hover:bg-blue-50 font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
            disabled={isLoading || !groupName.trim()}
          >
            {isLoading ? "Creating..." : "Create Group"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
