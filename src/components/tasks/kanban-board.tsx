"use client"

import { useState, useEffect, useCallback } from "react"
import { DragDropContext, DropResult } from "@hello-pangea/dnd"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import TaskDetailSidebar from "@/components/tasks/task-detail-sidebar"
import AutomationRules from "@/components/tasks/automation-rules"
import Column from "@/components/tasks/column"
import type { Task, Column as ColumnType, Rule } from "@/types/kanban"
import { generateId } from "@/lib/utils"
import { useTaskStore } from "@/hooks/use-task-store"

/* ---------------- MOCK DATA ---------------- */


/* ---------------- COMPONENT ---------------- */

export default function KanbanBoard() {
  const { toast } = useToast()
  
  const {
    columns,
    isLoading,
    createTask: addTaskToStore,
    updateTask: updateTaskInStore,
    deleteTask: deleteTaskFromStore,
    moveTask,
    loadTasks,
    setColumns
  } = useTaskStore()
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [newColumnTitle, setNewColumnTitle] = useState("")
  const [isAddingColumn, setIsAddingColumn] = useState(false)
  const [rules, setRules] = useState<Rule[]>([])
  const [activeTab, setActiveTab] = useState("board")

  /* ---------- INIT ---------- */

  useEffect(() => {
    // Load tasks from the backend
    loadTasks()

    // Set up the columns with empty tasks initially
    // The actual tasks will be populated from the backend via loadTasks
    const initialColumns = [
      {
        id: "column-1",
        title: "To Do",
        tasks: [],
        color: "bg-blue-50 dark:bg-blue-900/30",
      },
      {
        id: "column-2",
        title: "In Progress",
        tasks: [],
        color: "bg-yellow-50 dark:bg-yellow-900/30",
      },
      {
        id: "column-3",
        title: "Blocked",
        tasks: [],
        color: "bg-red-50 dark:bg-red-900/30",
      },
      {
        id: "column-4",
        title: "Completed",
        tasks: [],
        color: "bg-green-50 dark:bg-green-900/30",
      },
    ]

    /* DEFAULT AUTOMATION RULES */
    setRules([
      {
        id: `rule-${generateId()}`,
        name: "Move overdue tasks to Blocked",
        condition: {
          type: "due-date",
          operator: "is-overdue",
        },
        action: {
          type: "move-to-column",
          targetColumnId: "column-3",
        },
        enabled: true,
      },
      {
        id: `rule-${generateId()}`,
        name: "Move completed tasks when all subtasks done",
        condition: {
          type: "subtasks-completed",
          operator: "all-completed",
        },
        action: {
          type: "move-to-column",
          targetColumnId: "column-4",
        },
        enabled: true,
      },
    ])
  }, [])

  /* ---------- AUTOMATION ENGINE ---------- */

  useEffect(() => {
    if (!rules.length) return

    const enabled = rules.filter(r => r.enabled)
    if (!enabled.length) return

    const processAutomation = async () => {
      for (const col of columns) {
        for (const task of col.tasks) {
          for (const rule of enabled) {
            let match = false

            if (
              rule.condition.type === "due-date" &&
              rule.condition.operator === "is-overdue"
            ) {
              match =
                !!task.dueDate &&
                new Date(task.dueDate) < new Date() &&
                task.status !== "Completed"
            }

            if (
              rule.condition.type === "subtasks-completed" &&
              rule.condition.operator === "all-completed"
            ) {
              match =
                task.subtasks.length > 0 &&
                task.subtasks.every(s => s.completed)
            }

            if (match && rule.action.type === "move-to-column") {
              const targetColumn = columns.find(c => c.id === rule.action.targetColumnId)
              if (targetColumn && task.status !== targetColumn.title) {
                try {
                  await moveTask(task.id, col.id, targetColumn.id, 0)
                  
                  toast({
                    title: "Task moved automatically",
                    description: `"${task.title}" moved to ${targetColumn.title}`,
                  })
                } catch (error) {
                  console.error('Failed to apply automation rule:', error)
                }
              }
            }
          }
        }
      }
    }

    processAutomation()
  }, [rules, columns, toast, moveTask])

  /* ---------- DRAG & DROP ---------- */

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    // Dropped outside the list
    if (!destination) return

    // Dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    const sourceCol = columns.find(col => col.id === source.droppableId)
    const destCol = columns.find(col => col.id === destination.droppableId)

    if (!sourceCol || !destCol) return

    try {
      // Use the moveTask function from useTaskStore which handles the backend update
      await moveTask(
        draggableId,
        source.droppableId,
        destination.droppableId,
        destination.index
      )
      
      // The task list will be automatically refreshed via the useTaskStore
    } catch (error) {
      console.error('Failed to move task:', error)
      toast({
        title: 'Error',
        description: 'Failed to move task',
        variant: 'destructive',
      })
    }
  }

  const handleDragEnd = onDragEnd

  /* ---------- TASK CRUD ---------- */

  const addTask = async (columnId: string, task: Omit<Task, 'id' | 'createdAt'>) => {
    try {
      const column = columns.find(c => c.id === columnId)
      if (!column) {
        throw new Error('Column not found')
      }
      
      const newTask = await addTaskToStore({
        ...task,
        status: column.title,
      })

      // Update selected task if needed
      if (selectedTask?.id === newTask.id) {
        setSelectedTask(newTask)
      }
      
      return newTask
    } catch (error) {
      console.error('Failed to add task:', error)
      toast({
        title: 'Error',
        description: 'Failed to add task',
        variant: 'destructive',
      })
      throw error
    }
  }

  const updateTask = async (task: Task) => {
    try {
      await updateTaskInStore(task)
      setSelectedTask(task)
    } catch (error) {
      console.error('Failed to update task:', error)
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive',
      })
      throw error
    }
  }

  const deleteTask = async (taskId: string) => {
    try {
      await deleteTaskFromStore(taskId)
      if (selectedTask?.id === taskId) {
        setSelectedTask(null)
      }
    } catch (error) {
      console.error('Failed to delete task:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive',
      })
      throw error
    }
  }

  const duplicateTask = async (task: Task, columnId?: string) => {
    try {
      const targetColumnId = columnId || columns.find(c => c.tasks.some(t => t.id === task.id))?.id
      if (!targetColumnId) {
        throw new Error('Target column not found')
      }

      const { id, ...taskWithoutId } = task
      await addTask(targetColumnId, {
        ...taskWithoutId,
        title: `${task.title} (Copy)`,
      })
    } catch (error) {
      console.error('Failed to duplicate task:', error)
      toast({
        title: 'Error',
        description: 'Failed to duplicate task',
        variant: 'destructive',
      })
      throw error
    }
  }

  /* ---------- COLUMN CRUD ---------- */

  const addColumn = useCallback(() => {
    if (!newColumnTitle.trim()) return

    const newColumn: ColumnType = {
      id: `column-${generateId()}`,
      title: newColumnTitle.trim(),
      tasks: [],
      color: "bg-gray-50 dark:bg-gray-800",
    }

    setColumns((prevColumns: ColumnType[]) => [...prevColumns, newColumn])
  }, [newColumnTitle, setColumns])

  const updateColumn = useCallback((id: string, updates: Partial<ColumnType>) => {
    setColumns((prevColumns: ColumnType[]) => {
      // If we're updating the title of a column that affects task statuses
      if (updates.title) {
        const oldColumn = prevColumns.find(c => c.id === id)
        if (!oldColumn) return prevColumns

        // Update all tasks in this column with the new status
        const updatedTasks = oldColumn.tasks.map(task => ({
          ...task,
          status: updates.title!,
        }))

        // Update tasks in the database
        Promise.all(
          updatedTasks.map(task =>
            updateTaskInStore({
              ...task,
              status: updates.title!,
            })
          )
        )
          .then(() => {
            // Update the column title and tasks
            setColumns(prevColumns =>
              prevColumns.map(c =>
                c.id === id
                  ? {
                      ...c,
                      ...updates,
                      tasks: updatedTasks,
                    }
                  : c
              )
            )
          })
          .catch(error => {
            console.error('Failed to update column tasks:', error)
            toast({
              title: 'Error',
              description: 'Failed to update column tasks',
              variant: 'destructive',
            })
          })

        // Update the column title and tasks optimistically
        return prevColumns.map(c =>
          c.id === id
            ? {
                ...c,
                ...updates,
                tasks: updatedTasks,
              }
            : c
        )
      } else {
        // Just update the column without changing task statuses
        return prevColumns.map(c => c.id === id ? { ...c, ...updates } : c)
      }
    })
  }, [updateTaskInStore, toast, setColumns])

const deleteColumn = useCallback((id: string) => {
  setColumns((prevColumns: ColumnType[]) => {
    const col = prevColumns.find(c => c.id === id)
    if (!col) return prevColumns
      if (col.tasks.length > 0) {
        toast({
          title: 'Cannot delete column',
          description: 'Please move or delete all tasks in this column first',
          variant: 'destructive',
        })
        return prevColumns
      }
      
      return prevColumns.filter(c => c.id !== id)
    })
  }, [toast])

  /* ---------- RENDER ---------- */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] dark:bg-gray-900">
      <header className="shrink-0 border-b dark:border-gray-800 p-4 bg-white dark:bg-gray-900">
        <h1 className="text-2xl font-bold mb-4 dark:text-white">Board</h1>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid max-w-md grid-cols-2 bg-gray-100 dark:bg-gray-800">
            <TabsTrigger 
              value="board" 
              className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white"
            >
              Board
            </TabsTrigger>
            <TabsTrigger 
              value="automation"
              className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white"
            >
              Automation
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {activeTab === "board" && (
        <main className="flex-1 px-4 pt-4 overflow-x-auto">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 min-w-max min-h-[calc(100vh-160px)] pb-10">
              {columns.map(column => (
                <Column
                  key={column.id}
                  column={column}
                  onAddTask={addTask}
                  onTaskClick={setSelectedTask}
                  onDeleteColumn={() => deleteColumn(column.id)}
                  onUpdateColumn={updateColumn}
                  onDuplicateTask={duplicateTask}
                />
              ))}

              <div className="w-72 shrink-0">
                {isAddingColumn ? (
                  <div className="bg-white p-3 rounded border">
                    <Label>Column title</Label>
                    <Input
                      value={newColumnTitle}
                      onChange={e => setNewColumnTitle(e.target.value)}
                      className="mb-2"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addColumn}>
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsAddingColumn(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="border-dashed w-full h-12"
                    onClick={() => setIsAddingColumn(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Column
                  </Button>
                )}
              </div>
            </div>
          </DragDropContext>
        </main>
      )}

      {activeTab === "automation" && (
        <main className="flex-1 px-4 pt-4 overflow-y-auto">
          <AutomationRules
            rules={rules}
            columns={columns}
            onAddRule={r => setRules([...rules, r])}
            onUpdateRule={(id, u) =>
              setRules(rules.map(r => (r.id === id ? { ...r, ...u } : r)))
            }
            onDeleteRule={id => setRules(rules.filter(r => r.id !== id))}
          />
        </main>
      )}

      {selectedTask && (
        <TaskDetailSidebar
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onDuplicate={duplicateTask}
          columns={columns}
        />
      )}
    </div>
  )
}
