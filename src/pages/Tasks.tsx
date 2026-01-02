import { useState } from "react";
import KanbanBoard from "@/components/tasks/kanban-board";
import TaskSidebar from "@/components/tasks/TaskSidebar";
import type { Task, Column as ColumnType } from "@/types/kanban";
import { generateId } from "@/lib/utils";

const Tasks = () => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [columns, setColumns] = useState<ColumnType[]>([]);

  // Initialize with mock data (this would normally come from a context or API)
  const initializeColumns = () => {
    // This is a simplified version - in reality, this would be handled by the KanbanBoard component
    // For now, we'll create a minimal structure
    const mockColumns: ColumnType[] = [
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
    ];
    setColumns(mockColumns);
  };

  // Handle creating a new task
  const handleCreateTask = (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: `task-${generateId()}`,
      createdAt: new Date().toISOString(),
    };

    // Add task to the first column (or the column matching the task status)
    const targetColumn = columns.find(col => col.title === taskData.status) || columns[0];
    if (targetColumn) {
      const updatedColumns = columns.map(col => 
        col.id === targetColumn.id 
          ? { ...col, tasks: [...col.tasks, newTask] }
          : col
      );
      setColumns(updatedColumns);
    }
  };

  // Initialize columns on mount
  if (columns.length === 0) {
    initializeColumns();
  }

  return (
    <div className="flex h-full">
      {/* Task Sidebar */}
      <TaskSidebar
        columns={columns}
        selectedTask={selectedTask}
        onTaskSelect={setSelectedTask}
        onCreateTask={handleCreateTask}
      />

      {/* Kanban Board */}
      <div className="flex-1">
        <KanbanBoard />
      </div>
    </div>
  );
};

export default Tasks;
