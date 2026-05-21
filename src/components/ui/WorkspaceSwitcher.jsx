import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Plus, User, Users } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToast } from './use-toast';

export default function WorkspaceSwitcher({
  activeLibrary,
  setActiveLibrary,
  team,
  showPersonalSpace = true,
  className
}) {
  const { toast } = useToast();

  const handleCreateNew = () => {
    toast({
      title: "Coming Soon",
      description: "Creating additional workspaces will be available soon.",
    });
  };

  const getActiveLabel = () => {
    if (activeLibrary === 'personal') return 'Personal Space';
    if (activeLibrary === team?.id) return team?.name || 'Team Workspace';
    return 'Workspace';
  };

  const getActiveIcon = () => {
    if (activeLibrary === 'personal') return <User size={16} />;
    return <Users size={16} />;
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={cn(
        "group flex items-center justify-center xl:justify-start gap-2 h-11 w-11 xl:w-full xl:px-3 mx-auto xl:mx-0 rounded-lg cursor-pointer transition-colors duration-200 border-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-teal-600)] data-[state=open]:bg-[var(--ds-teal-100)] data-[state=open]:text-[var(--ds-teal-900)]",
        "xl:text-left xl:hover:bg-[var(--ds-gray-200)] xl:bg-transparent",
        "bg-transparent hover:bg-[var(--ds-gray-200)] text-[var(--ds-gray-700)]",
        className
      )}>
        <div className="flex items-center justify-center xl:hidden w-9 h-9 rounded-full bg-[var(--ds-gray-300)] group-hover:bg-[var(--ds-gray-400)] group-data-[state=open]:bg-[var(--ds-teal-200)] text-[var(--ds-gray-1000)] group-data-[state=open]:text-[var(--ds-teal-900)] shrink-0 transition-colors">
          {getActiveIcon()}
        </div>
        <div className="hidden xl:flex items-center justify-between w-full overflow-hidden">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--ds-gray-300)] text-[var(--ds-gray-700)]">
              {getActiveIcon()}
            </div>
            <span className="truncate text-[var(--ds-gray-1000)] text-label-14 font-medium">{getActiveLabel()}</span>
          </div>
          <ChevronDown size={16} className="shrink-0 text-[var(--ds-gray-500)]" />
        </div>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="z-50 min-w-[240px] overflow-hidden rounded-xl border border-[var(--ds-gray-200)] bg-[var(--ds-background-100)] p-1.5 shadow-xl animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-label-12 font-semibold text-[var(--ds-gray-500)] uppercase tracking-wider">
            Workspaces
          </DropdownMenu.Label>

          {showPersonalSpace && (
            <DropdownMenu.Item
              onSelect={() => setActiveLibrary('personal')}
              className={cn(
                "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-label-14 outline-none transition-colors data-[highlighted]:bg-[var(--ds-gray-100)]",
                activeLibrary === 'personal' ? "text-[var(--ds-gray-1000)] bg-[var(--ds-gray-100)] font-medium" : "text-[var(--ds-gray-700)]"
              )}
            >
              <User size={16} />
              <span className="flex-1 truncate">Personal Space</span>
              {activeLibrary === 'personal' && (
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--ds-teal-600)]" />
              )}
            </DropdownMenu.Item>
          )}

          {team && (
            <DropdownMenu.Item
              onSelect={() => setActiveLibrary(team.id)}
              className={cn(
                "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-label-14 outline-none transition-colors data-[highlighted]:bg-[var(--ds-gray-100)]",
                activeLibrary === team.id ? "text-[var(--ds-gray-1000)] bg-[var(--ds-gray-100)] font-medium" : "text-[var(--ds-gray-700)]"
              )}
            >
              <Users size={16} />
              <span className="flex-1 truncate">{team.name}</span>
              {activeLibrary === team.id && (
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--ds-teal-600)]" />
              )}
            </DropdownMenu.Item>
          )}

          <DropdownMenu.Separator className="my-1.5 -mx-1.5 h-px bg-[var(--ds-gray-200)]" />

          <DropdownMenu.Item
            onSelect={handleCreateNew}
            className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-label-14 text-[var(--ds-gray-600)] outline-none transition-colors data-[highlighted]:bg-[var(--ds-gray-100)] data-[highlighted]:text-[var(--ds-gray-900)]"
          >
            <Plus size={16} />
            <span>Create new workspace...</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
