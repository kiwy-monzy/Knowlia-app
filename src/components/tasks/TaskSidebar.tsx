import { useState } from 'react';
import { 
  CheckSquare, 
  Users, 
  Search, 
  Plus, 
  ChevronDown, 
  ChevronRight, 
  Calendar,
  Tag,
  Filter,
  Archive,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import SidebarHeader from '@/components/SidebarHeader';
import FormButton from '@/components/FormButton';
import type { Task, Column } from '@/types/kanban';

interface TaskSidebarProps {
  columns: Column[];
  selectedTask?: Task | null;
  onTaskSelect: (task: Task) => void;
  onCreateTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
}

const TaskSidebar = ({ columns, selectedTask, onTaskSelect, onCreateTask }: TaskSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    tasks: true,
    archived: false,
  });

  const handleCreateTask = async (formData: Record<string, string>) => {
    const taskTitle = formData.taskTitle;
    const taskDescription = formData.taskDescription || '';
    
    if (taskTitle.trim()) {
      try {
        const newTask: Omit<Task, 'id' | 'createdAt'> = {
          title: taskTitle.trim(),
          description: taskDescription.trim(),
          status: columns[0]?.title || 'To Do',
          dueDate: formData.dueDate || null,
          subtasks: [],
          customFields: [],
        };
        
        onCreateTask(newTask);
      } catch (error) {
        console.error('Failed to create task:', error);
      }
    }
  };

  // Get all tasks from all columns
  const allTasks = columns.flatMap(column => 
    column.tasks.map(task => ({ ...task, columnName: column.title }))
  );

  // Filter tasks based on search query
  const filteredTasks = allTasks.filter(task =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSection = (section: 'tasks' | 'archived') => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 8640000);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return 'now';
  };

  const getPriorityColor = (task: Task) => {
    const priorityField = task.customFields.find(field => field.name === 'Priority');
    if (!priorityField) return 'bg-gray-100 dark:bg-gray-800';
    
    switch (priorityField.value.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'low':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800';
    }
  };

  const TaskItem = ({ task }: { task: Task & { columnName?: string } }) => {
    const isActive = selectedTask?.id === task.id;
    const priorityField = task.customFields.find(field => field.name === 'Priority');
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed';

    return (
      <button
        onClick={() => onTaskSelect(task)}
        className={cn(
          'w-full flex items-start gap-2 px-2 py-2 rounded-lg transition-all duration-200 group',
          isActive
            ? 'bg-primary/10 text-primary shadow-sm'
            : 'hover:bg-muted/80 text-foreground'
        )}
      >
        <div className="flex-shrink-0 mt-0.5">
          <div className={cn(
            'h-5 w-5 rounded flex items-center justify-center border-2 transition-colors',
            task.status === 'Completed' 
              ? 'bg-green-500 border-green-500 text-white' 
              : 'border-muted-foreground hover:border-primary'
          )}>
            {task.status === 'Completed' && (
              <CheckSquare className="h-3 w-3" />
            )}
          </div>
        </div>

        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className={cn(
                'font-medium truncate text-xs',
                isActive && 'font-semibold'
              )}>
                {task.title}
              </span>
              {priorityField && (
                <span className={cn(
                  'flex-shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full',
                  getPriorityColor(task)
                )}>
                  {priorityField.value}
                </span>
              )}
              {isOverdue && (
                <span className="flex-shrink-0 text-[9px] font-medium text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded-full">
                  Overdue
                </span>
              )}
            </div>
          </div>
          
          {task.description && (
            <p className="text-[10px] text-muted-foreground truncate mb-1">
              {task.description.length > 40 ? `${task.description.substring(0, 40)}...` : task.description}
            </p>
          )}

          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                {task.columnName || task.status}
              </span>
              {task.subtasks.length > 0 && (
                <span className="text-[9px] text-muted-foreground">
                  {task.subtasks.filter(st => st.completed).length}/{task.subtasks.length}
                </span>
              )}
            </div>
            {task.dueDate && (
              <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatTime(task.dueDate)}
              </span>
            )}
          </div>
        </div>
      </button>
    );
};

  return (
    <div className="w-64 h-screen flex flex-col rounded-l-[2rem] rounded-bl-[2rem] border-r border-sidebar-border">
      {/* Header */}
      <SidebarHeader 
        title="Tasks" 
        Icon={CheckSquare}
        action={
          <FormButton
            title="Create New Task"
            description="Enter details for your new task."
            fields={[
              {
                id: 'taskTitle',
                name: 'taskTitle',
                label: 'TASK TITLE',
                type: 'text',
                placeholder: 'Enter task title...',
                required: true
              },
              {
                id: 'taskDescription',
                name: 'taskDescription',
                label: 'DESCRIPTION',
                type: 'textarea',
                placeholder: 'Enter task description (optional)...',
                required: false
              },
              {
                id: 'dueDate',
                name: 'dueDate',
                label: 'DUE DATE',
                type: "text",
                placeholder: 'Select due date...',
                required: false
              }
            ]}
            onSubmit={handleCreateTask}
            submitButtonText="Create Task"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            icon={<Plus className="h-4 w-4" />}
          />
        }
      />

      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-muted/50 border-0 rounded-xl focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="p-2 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Filter className="h-4 w-4" />
          Filter
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Tag className="h-4 w-4" />
          Labels
        </Button>
      </div>

      {/* Tasks List */}
      <ScrollArea className="flex-1 px-1">
        <div className="py-2 pb-6">
          {/* Active Tasks Section */}
          <div className="mb-4">
            <button
              onClick={() => toggleSection('tasks')}
              className="flex items-center gap-1 px-1.5 py-1.5 w-64 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors rounded-lg"
            >
              {expandedSections.tasks ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <CheckSquare className="h-3.5 w-3.5" />
              <span>Active Tasks</span>
              <span className="ml-auto text-[10px] bg-muted/50 px-1.5 py-0.5 rounded-full">
                {filteredTasks.filter(t => t.status !== 'Completed').length}
              </span>
            </button>

            {expandedSections.tasks && (
              <div className="mt-0.5 space-y-0.5 animate-fade-in">
                {filteredTasks
                  .filter(task => task.status !== 'Completed')
                  .map(task => (
                    <TaskItem key={task.id} task={task} />
                  ))}
              </div>
            )}
          </div>

          {/* Completed Tasks Section */}
          <div>
            <button
              onClick={() => toggleSection('archived')}
              className="flex items-center gap-1 px-1.5 py-1.5 w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors rounded-lg"
            >
              {expandedSections.archived ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <Archive className="h-3.5 w-3.5" />
              <span>Completed</span>
              <span className="ml-auto text-[10px] bg-muted/50 px-1.5 py-0.5 rounded-full">
                {filteredTasks.filter(t => t.status === 'Completed').length}
              </span>
            </button>

            {expandedSections.archived && (
              <div className="mt-0.5 space-y-0.5 animate-fade-in">
                {filteredTasks
                  .filter(task => task.status === 'Completed')
                  .map(task => (
                    <TaskItem key={task.id} task={task} />
                  ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default TaskSidebar;
