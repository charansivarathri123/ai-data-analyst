"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { API_BASE } from "../lib/config";

export interface UserProfile {
  id: string;
  name: string;
  identifier: string;
  auth_type: string;
  avatar_url?: string | null;
  created_at: string;
}

export interface ProjectItem {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
  dataset_id?: string | null;
  status?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  projects: ProjectItem[];
  activeProjectId: string | null;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: (user: UserProfile, token: string) => void;
  logout: () => void;
  createProject: (name: string, description?: string, dataset_id?: string | null) => Promise<ProjectItem | null>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProjectId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = "bi_studio_user";
const STORAGE_KEY_TOKEN = "bi_studio_token";
const STORAGE_KEY_PROJECTS = "bi_studio_projects";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Save projects array to localStorage
  const saveProjectsToStorage = (updated: ProjectItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to persist user projects to localStorage:", e);
    }
  };

  // Load persisted session and user projects on initial mount
  useEffect(() => {
    try {
      // 1. Load user's previous projects from localStorage
      const storedProjects = localStorage.getItem(STORAGE_KEY_PROJECTS);
      if (storedProjects) {
        try {
          const parsed = JSON.parse(storedProjects);
          // Strictly remove legacy sample/demo projects so only user's real projects are shown
          const userOnlyProjects = Array.isArray(parsed)
            ? parsed.filter(
                (p: ProjectItem) =>
                  p &&
                  p.id !== "proj_sample_churn" &&
                  p.id !== "proj_sample_retail" &&
                  p.name !== "Customer Churn & Retention" &&
                  p.name !== "Omnichannel Retail Star Schema"
              )
            : [];
          setProjects(userOnlyProjects);
          saveProjectsToStorage(userOnlyProjects);
          if (userOnlyProjects.length > 0) {
            setActiveProjectId(userOnlyProjects[0].id);
          }
        } catch (e) {
          console.error("Failed to parse stored projects:", e);
        }
      } else {
        // No previous projects: start clean with empty array
        setProjects([]);
      }

      // 2. Load authenticated session if present
      const storedUser = localStorage.getItem(STORAGE_KEY_USER);
      const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
      if (storedUser && storedToken) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setToken(storedToken);
        loadUserProjects(parsedUser.id);
      }
    } catch (e) {
      console.error("Failed to load stored auth session:", e);
    }
  }, []);

  const loadUserProjects = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/projects?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        const userOnlyProjects = Array.isArray(data)
          ? data.filter(
              (p: ProjectItem) =>
                p &&
                p.id !== "proj_sample_churn" &&
                p.id !== "proj_sample_retail" &&
                p.name !== "Customer Churn & Retention" &&
                p.name !== "Omnichannel Retail Star Schema"
            )
          : [];
        setProjects(userOnlyProjects);
        saveProjectsToStorage(userOnlyProjects);
        if (userOnlyProjects.length > 0 && !activeProjectId) {
          setActiveProjectId(userOnlyProjects[0].id);
        }
      }
    } catch (err) {
      console.warn("Could not fetch remote user projects, fallback to local:", err);
    }
  };

  const login = (newUser: UserProfile, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
      localStorage.setItem(STORAGE_KEY_TOKEN, newToken);
    } catch (e) {
      console.error("Failed to save auth to localStorage", e);
    }
    loadUserProjects(newUser.id);
    setIsAuthModalOpen(false);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setActiveProjectId(null);
    try {
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    } catch (e) {
      console.error("Failed to clear auth from localStorage", e);
    }
  };

  const createProject = async (
    name: string,
    description?: string,
    dataset_id?: string | null
  ): Promise<ProjectItem | null> => {
    const userId = user ? user.id : "guest";

    try {
      const res = await fetch(`${API_BASE}/api/auth/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          name,
          description: description || "",
          dataset_id: dataset_id || null,
        }),
      });
      if (res.ok) {
        const newProj = await res.json();
        setProjects((prev) => {
          const updated = [newProj, ...prev];
          saveProjectsToStorage(updated);
          return updated;
        });
        setActiveProjectId(newProj.id);
        return newProj;
      }
    } catch (e) {
      console.warn("Using local project creation fallback:", e);
    }

    // Local fallback project
    const fallbackProj: ProjectItem = {
      id: `proj_${Date.now()}`,
      user_id: userId,
      name,
      description: description || "",
      created_at: new Date().toISOString(),
      dataset_id: dataset_id || null,
      status: "active",
    };
    setProjects((prev) => {
      const updated = [fallbackProj, ...prev];
      saveProjectsToStorage(updated);
      return updated;
    });
    setActiveProjectId(fallbackProj.id);
    return fallbackProj;
  };

  const deleteProject = async (id: string) => {
    const userId = user ? user.id : "guest";
    try {
      await fetch(`${API_BASE}/api/auth/projects/${id}?user_id=${userId}`, { method: "DELETE" });
    } catch (e) {
      console.warn("Could not delete remote project:", e);
    }

    setProjects((prev) => {
      const remaining = prev.filter((p) => p.id !== id);
      saveProjectsToStorage(remaining);
      if (activeProjectId === id) {
        setActiveProjectId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isAuthModalOpen,
        projects,
        activeProjectId,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        login,
        logout,
        createProject,
        deleteProject,
        setActiveProjectId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthProvider;
