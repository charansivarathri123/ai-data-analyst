"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
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
  Flame,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { InfoModalType } from "./InfoModals";
import {
  fadeUp,
  scaleIn,
  pressScale,
  usePrefersReducedMotion,
  safeVariants,
  duration,
  ease,
} from "@/lib/motion";

interface SidebarProps {
  onNewChat: () => void;
  onSelectProject?: (projectId: string) => void;
  onOpenInfoModal: (type: InfoModalType) => void;
}

type NavItemId = "agent-squad" | "architecture" | "powerbi";

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
  const [activeNavItem, setActiveNavItem] = useState<NavItemId | null>(null);
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();

  const handleSelectProjectItem = (proj: { id: string; name: string; dataset_id?: string | null }) => {
    setActiveProjectId(proj.id);
    if (onSelectProject) onSelectProject(proj.id);

    // If project has dataset attached, sync it to active_dataset so workspace loads it
    if (proj.dataset_id) {
      try {
        localStorage.setItem(
          "active_dataset",
          JSON.stringify({
            dataset_id: proj.dataset_id,
            filename: proj.name,
            row_count: 0,
            column_count: 0,
            recommended_questions: [],
          })
        );
        window.dispatchEvent(new Event("active_dataset_updated"));
      } catch {
        // ignore
      }
    }

    // Redirect to workspace with all data
    router.push("/dashboard");
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    let currentDatasetId: string | null = null;
    try {
      const stored = localStorage.getItem("active_dataset");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.dataset_id) currentDatasetId = parsed.dataset_id;
      }
    } catch {
      // ignore
    }

    await createProject(newProjectName.trim(), newProjectDesc.trim(), currentDatasetId);
    setNewProjectName("");
    setNewProjectDesc("");
    setIsNewProjectModalOpen(false);

    // Redirect to workspace
    router.push("/dashboard");
  };

  const handleNavClick = (id: NavItemId) => {
    setActiveNavItem(id);
    onOpenInfoModal(id);
  };

  const navItems: { id: NavItemId; label: string; icon: typeof Cpu }[] = [
    { id: "agent-squad", label: "Agent Squad", icon: Cpu },
    { id: "architecture", label: "Architecture", icon: Layers },
    { id: "powerbi", label: "Power BI & TMDL", icon: BarChart3 },
  ];

  return (
    <>
      {/* Sidebar Container — animated width */}
      <motion.aside
        animate={{ width: isCollapsed ? 64 : 288 }}
        transition={{ duration: duration.normal, ease: ease.out }}
        className="relative z-40 flex flex-col h-screen bg-canvas text-t-primary border-r border-b-subtle shrink-0 select-none overflow-hidden"
      >
        {/* Top Header: Brand Name + Logo */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-8 w-8 shrink-0 rounded-lg object-contain"
            />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: duration.fast }}
                  className="font-bold text-base tracking-tight text-t-primary truncate whitespace-nowrap font-display"
                >
                  DataAnalyst.Ai
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            whileTap={pressScale.whileTap}
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md text-t-tertiary hover:text-t-primary hover:bg-surface-2 transition-colors hidden sm:block"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </motion.button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {/* Primary Action Button: "Studio" */}
          <div className="space-y-2">
            <Link
              href="/dashboard"
              className={`flex items-center ${
                isCollapsed ? "justify-center px-2" : "justify-between px-3.5"
              } py-2.5 rounded-xl bg-accent text-canvas font-semibold text-xs hover:bg-accent/90 transition-all group`}
              title="Launch Studio Workspace"
            >
              <div className="flex items-center gap-2.5">
                <Flame className="h-4 w-4 shrink-0" />
                {!isCollapsed && <span>Studio</span>}
              </div>
              {!isCollapsed && (
                <span className="text-micro font-mono px-1.5 py-0.5 rounded bg-canvas/10 text-canvas/70 font-bold group-hover:bg-canvas/20 transition-colors">
                  Workspace
                </span>
              )}
            </Link>

            {/* "+ New Chat" button */}
            <motion.button
              whileTap={pressScale.whileTap}
              onClick={onNewChat}
              className={`w-full flex items-center ${
                isCollapsed ? "justify-center px-2" : "px-3.5"
              } py-2 rounded-xl bg-surface-2 border border-b-subtle text-t-secondary hover:bg-surface-3 hover:text-t-primary text-xs font-medium transition-all gap-2.5 group`}
              title="Start New Chat Session"
            >
              <Plus className="h-4 w-4 text-accent shrink-0 group-hover:rotate-90 transition-transform" />
              {!isCollapsed && <span>+ New Chat</span>}
            </motion.button>
          </div>

          {/* Nav links with sliding active indicator */}
          <div className="pt-2 border-t border-b-subtle space-y-1">
            {!isCollapsed && (
              <p className="px-2 pb-1 text-micro font-mono uppercase tracking-wider text-t-tertiary">
                Explore Engine
              </p>
            )}

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNavItem === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`relative w-full flex items-center ${
                    isCollapsed ? "justify-center" : "px-2.5"
                  } py-2 rounded-lg text-xs font-medium transition-colors gap-2.5`}
                  title={item.label}
                >
                  {/* Sliding active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-nav-indicator"
                      className="absolute inset-0 bg-surface-2 rounded-lg border border-b-subtle"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon className={`h-4 w-4 shrink-0 relative z-10 ${isActive ? "text-accent" : "text-t-tertiary"}`} />
                  {!isCollapsed && (
                    <span className={`relative z-10 ${isActive ? "text-t-primary" : "text-t-secondary hover:text-t-primary"}`}>
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Projects section */}
          <div className="pt-3 border-t border-b-subtle">
            <div className="flex items-center justify-between px-2 pb-2">
              <button
                onClick={() => setIsProjectsOpen(!isProjectsOpen)}
                className="flex items-center gap-1.5 text-micro font-mono uppercase tracking-wider text-t-tertiary hover:text-t-secondary transition-colors"
              >
                {!isCollapsed && <span>Projects ({projects.length})</span>}
                {isProjectsOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>

              {!isCollapsed && (
                <button
                  onClick={() => setIsNewProjectModalOpen(true)}
                  className="flex items-center gap-1 text-[11px] text-accent hover:text-t-primary transition-colors font-medium"
                  title="Create new project"
                >
                  <Plus className="h-3 w-3" />
                  <span>New</span>
                </button>
              )}
            </div>

            <AnimatePresence>
              {isProjectsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: duration.normal, ease: ease.out }}
                  className="overflow-hidden space-y-1"
                >
                  {projects.map((proj) => {
                    const isActive = activeProjectId === proj.id;
                    return (
                      <div
                        key={proj.id}
                        className={`group flex items-center justify-between ${
                          isCollapsed ? "justify-center px-1" : "px-2.5"
                        } py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          isActive
                            ? "bg-surface-3 text-t-primary font-semibold"
                            : "text-t-secondary hover:text-t-primary hover:bg-surface-2"
                        }`}
                        onClick={() => handleSelectProjectItem(proj)}
                        title={proj.name}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Folder
                            className={`h-3.5 w-3.5 shrink-0 ${
                              isActive ? "text-accent" : "text-t-tertiary"
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
                            className="opacity-0 group-hover:opacity-100 p-1 text-t-tertiary hover:text-status-error transition-opacity"
                            title="Delete Project"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {projects.length === 0 && !isCollapsed && (
                    <motion.p
                      variants={safeVariants(fadeUp, reducedMotion)}
                      initial="hidden"
                      animate="visible"
                      className="px-3 py-2 text-[11px] text-t-tertiary italic"
                    >
                      No projects yet. Click + New to create.
                    </motion.p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom User Session / Auth Profile Bar */}
        <div className="p-3 border-t border-b-subtle bg-surface-1">
          {isAuthenticated && user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="h-7 w-7 rounded-full bg-accent-violet/30 border border-accent-violet/50 flex items-center justify-center font-bold text-xs text-t-primary shrink-0">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                {!isCollapsed && (
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-t-primary truncate leading-tight">
                      {user.name}
                    </p>
                    <p className="text-micro text-t-tertiary truncate">
                      {user.identifier}
                    </p>
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <div className="flex items-center gap-1">
                  <motion.button
                    whileTap={pressScale.whileTap}
                    onClick={logout}
                    className="p-1.5 rounded-lg text-t-tertiary hover:text-status-error hover:bg-surface-2 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="h-4 w-4" />
                  </motion.button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <motion.button
                whileTap={pressScale.whileTap}
                onClick={openAuthModal}
                className={`w-full flex items-center ${
                  isCollapsed ? "justify-center" : "justify-center gap-2"
                } py-2 rounded-xl bg-accent text-canvas font-semibold text-xs hover:bg-accent/90 transition-all`}
                title="Sign In / Register"
              >
                <User className="h-3.5 w-3.5 shrink-0" />
                {!isCollapsed && <span>Sign In / Sign Up</span>}
              </motion.button>
            </div>
          )}
        </div>
      </motion.aside>

      {/* New Project Modal Dialog */}
      <AnimatePresence>
        {isNewProjectModalOpen && (
          <motion.div
            variants={safeVariants(scaleIn, reducedMotion)}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm rounded-2xl bg-surface-1 p-6 shadow-elevated border border-b-subtle text-t-primary"
            >
              <h3 className="text-sm font-bold text-t-primary mb-1 flex items-center gap-2">
                <FolderPlus className="h-4 w-4 text-accent-violet" />
                <span>Create New Project Workspace</span>
              </h3>
              <p className="text-xs text-t-secondary mb-4">
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
                    className="w-full rounded-xl border border-b-subtle px-3 py-2 text-xs focus:border-accent focus:outline-none bg-canvas text-t-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Description (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Brief analytical objective..."
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    className="w-full rounded-xl border border-b-subtle px-3 py-2 text-xs focus:border-accent focus:outline-none bg-canvas text-t-primary"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsNewProjectModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-medium text-t-secondary hover:bg-surface-2 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-canvas hover:bg-accent/90 transition-colors"
                  >
                    Create Project
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
