"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Plus,
  FolderPlus,
  Folder,
  ChevronDown,
  ChevronRight,
  Layers,
  Cpu,
  BarChart3,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
  ExternalLink,
  MessageSquare,
  Flame,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { InfoModalType } from "./InfoModals";

interface SidebarProps {
  onNewChat: () => void;
  onSelectProject?: (projectId: string) => void;
  onOpenInfoModal: (type: InfoModalType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onNewChat,
  onSelectProject,
  onOpenInfoModal,
}) => {
  const {
    user,
    isAuthenticated,
    openAuthModal,
    logout,
    projects,
    activeProjectId,
    setActiveProjectId,
    createProject,
    deleteProject,
  } = useAuth();

  const [isProjectsOpen, setIsProjectsOpen] = useState(true);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    await createProject(newProjectName.trim(), newProjectDesc.trim());
    setNewProjectName("");
    setNewProjectDesc("");
    setIsNewProjectModalOpen(false);
  };

  return (
    <>
      {/* Sidebar Container */}
      <aside
        className={`relative z-40 flex flex-col h-screen bg-dark text-white border-r border-white/10 transition-all duration-300 ${
          isCollapsed ? "w-16" : "w-64 sm:w-72"
        } shrink-0 select-none`}
      >
        {/* Top Header: Brand Name + Logo (Item 1) */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-8 w-8 shrink-0 rounded-lg object-contain"
            />
            {!isCollapsed && (
              <span className="font-bold text-base tracking-tight text-white truncate">
                DataAnalyst.Ai
              </span>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors hidden sm:block"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
          {/* Item 2: Primary Action Button: "Studio" */}
          <div className="space-y-2">
            <Link
              href="/dashboard"
              className={`flex items-center ${
                isCollapsed ? "justify-center px-2" : "justify-between px-3.5"
              } py-2.5 rounded-xl bg-white text-dark font-semibold text-xs shadow-md hover:bg-white/90 hover:scale-[1.01] transition-all group`}
              title="Launch Studio Workspace"
            >
              <div className="flex items-center gap-2.5">
                <Flame className="h-4 w-4 text-accent-violet shrink-0" />
                {!isCollapsed && <span>Studio</span>}
              </div>
              {!isCollapsed && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-dark/10 text-dark/70 font-bold group-hover:bg-dark group-hover:text-white transition-colors">
                  Workspace
                </span>
              )}
            </Link>

            {/* Item 3: "+ New Chat" button */}
            <button
              onClick={onNewChat}
              className={`w-full flex items-center ${
                isCollapsed ? "justify-center px-2" : "px-3.5"
              } py-2 rounded-xl bg-white/5 border border-white/10 text-white/90 hover:bg-white/10 hover:text-white text-xs font-medium transition-all gap-2.5 group`}
              title="Start New Chat Session"
            >
              <Plus className="h-4 w-4 text-accent-lime shrink-0 group-hover:rotate-90 transition-transform" />
              {!isCollapsed && <span>+ New Chat</span>}
            </button>
          </div>

          {/* Item 4: Nav links, stacked vertically */}
          <div className="pt-2 border-t border-white/10 space-y-1">
            {!isCollapsed && (
              <p className="px-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-white/40">
                Explore Engine
              </p>
            )}

            <button
              onClick={() => onOpenInfoModal("agent-squad")}
              className={`w-full flex items-center ${
                isCollapsed ? "justify-center" : "px-2.5"
              } py-2 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors gap-2.5`}
              title="Agent Squad"
            >
              <Cpu className="h-4 w-4 text-accent-lime shrink-0" />
              {!isCollapsed && <span>Agent Squad</span>}
            </button>

            <button
              onClick={() => onOpenInfoModal("architecture")}
              className={`w-full flex items-center ${
                isCollapsed ? "justify-center" : "px-2.5"
              } py-2 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors gap-2.5`}
              title="Architecture"
            >
              <Layers className="h-4 w-4 text-accent-violet shrink-0" />
              {!isCollapsed && <span>Architecture</span>}
            </button>

            <button
              onClick={() => onOpenInfoModal("powerbi")}
              className={`w-full flex items-center ${
                isCollapsed ? "justify-center" : "px-2.5"
              } py-2 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors gap-2.5`}
              title="Power BI & TMDL"
            >
              <BarChart3 className="h-4 w-4 text-yellow-400 shrink-0" />
              {!isCollapsed && <span>Power BI & TMDL</span>}
            </button>
          </div>

          {/* Item 5 & 6: Projects section (Collapsible list + New Project button) */}
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center justify-between px-2 pb-2">
              <button
                onClick={() => setIsProjectsOpen(!isProjectsOpen)}
                className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white/40 hover:text-white/80 transition-colors"
              >
                {!isCollapsed && <span>Projects ({projects.length})</span>}
                {isProjectsOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>

              {/* Item 6: + New Project button/link */}
              {!isCollapsed && (
                <button
                  onClick={() => setIsNewProjectModalOpen(true)}
                  className="flex items-center gap-1 text-[11px] text-accent-lime hover:text-white transition-colors font-medium"
                  title="Create new project"
                >
                  <Plus className="h-3 w-3" />
                  <span>New</span>
                </button>
              )}
            </div>

            {isProjectsOpen && (
              <div className="space-y-1 mt-1">
                {projects.map((proj) => {
                  const isActive = activeProjectId === proj.id;
                  return (
                    <div
                      key={proj.id}
                      className={`group flex items-center justify-between ${
                        isCollapsed ? "justify-center px-1" : "px-2.5"
                      } py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        isActive
                          ? "bg-white/15 text-white font-semibold"
                          : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                      onClick={() => {
                        setActiveProjectId(proj.id);
                        if (onSelectProject) onSelectProject(proj.id);
                      }}
                      title={proj.name}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder
                          className={`h-3.5 w-3.5 shrink-0 ${
                            isActive ? "text-accent-lime" : "text-white/40"
                          }`}
                        />
                        {!isCollapsed && (
                          <span className="truncate text-xs">{proj.name}</span>
                        )}
                      </div>

                      {!isCollapsed && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProject(proj.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-red-400 transition-opacity"
                          title="Delete Project"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {projects.length === 0 && !isCollapsed && (
                  <p className="px-3 py-2 text-[11px] text-white/30 italic">
                    No projects yet. Click + New to create.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom User Session / Auth Profile Bar */}
        <div className="p-3 border-t border-white/10 bg-black/20">
          {isAuthenticated && user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="h-7 w-7 rounded-full bg-accent-violet/30 border border-accent-violet/50 flex items-center justify-center font-bold text-xs text-white shrink-0">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                {!isCollapsed && (
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-white truncate leading-tight">
                      {user.name}
                    </p>
                    <p className="text-[10px] text-white/50 truncate">
                      {user.identifier}
                    </p>
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={logout}
                    className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <button
                onClick={openAuthModal}
                className={`w-full flex items-center ${
                  isCollapsed ? "justify-center" : "justify-center gap-2"
                } py-2 rounded-xl bg-accent-lime text-dark font-semibold text-xs shadow hover:bg-accent-lime/90 transition-all`}
                title="Sign In / Register"
              >
                <User className="h-3.5 w-3.5 shrink-0" />
                {!isCollapsed && <span>Sign In / Sign Up</span>}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* New Project Modal Dialog */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-subtleBorder dark:border-zinc-800 text-primaryText">
            <h3 className="text-sm font-bold text-primaryText mb-1 flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-accent-violet" />
              <span>Create New Project Workspace</span>
            </h3>
            <p className="text-xs text-mutedText mb-4">
              Group your datasets, DuckDB queries, and Power BI models.
            </p>

            <form onSubmit={handleCreateProjectSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Sales Variance Analysis"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full rounded-xl border border-subtleBorder dark:border-zinc-700 px-3 py-2 text-xs focus:border-dark dark:focus:border-accent-violet focus:outline-none bg-canvas dark:bg-zinc-800 text-primaryText"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brief analytical objective..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full rounded-xl border border-subtleBorder px-3 py-2 text-xs focus:border-dark focus:outline-none bg-canvas"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-medium text-mutedText hover:bg-canvas transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-dark px-4 py-2 text-xs font-semibold text-white hover:bg-dark/90 transition-colors"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
