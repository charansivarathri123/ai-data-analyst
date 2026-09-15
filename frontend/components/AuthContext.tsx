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
  createProject: (name: string, description?: string) => Promise<ProjectItem | null>;
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

  // Load persisted session on initial mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_KEY_USER);
      const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
      if (storedUser && storedToken) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setToken(storedToken);
        loadUserProjects(parsedUser.id);
      } else {
        // Provide starter projects for guest exploration
        const defaultProjects: ProjectItem[] = [
          {
            id: "proj_sample_churn",
            user_id: "guest",
            name: "Customer Churn & Retention",
            description: "Root-cause driver analysis on subscription drop-off",
            created_at: new Date().toISOString(),
            status: "active",
          },
          {
            id: "proj_sample_retail",
            user_id: "guest",
            name: "Omnichannel Retail Star Schema",
            description: "DuckDB facts & dimensions modeling with verified DAX",
            created_at: new Date().toISOString(),
            status: "active",
          },
        ];
        setProjects(defaultProjects);
        setActiveProjectId(defaultProjects[0].id);
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
        setProjects(data);
        if (data.length > 0 && !activeProjectId) {
          setActiveProjectId(data[0].id);
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

  const createProject = async (name: string, description?: string): Promise<ProjectItem | null> => {
    const userId = user ? user.id : "guest";
    try {
      const res = await fetch(`${API_BASE}/api/auth/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, name, description: description || "" }),
      });
      if (res.ok) {
        const newProj = await res.json();
        setProjects((prev) => [newProj, ...prev]);
        setActiveProjectId(newProj.id);
        return newProj;
      }
    } catch (e) {
      console.warn("Using local project creation fallback:", e);
    }

    // Local fallback
    const fallbackProj: ProjectItem = {
      id: `proj_${Date.now()}`,
      user_id: userId,
      name,
      description: description || "",
      created_at: new Date().toISOString(),
      status: "active",
    };
    setProjects((prev) => [fallbackProj, ...prev]);
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
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProjectId === id) {
      const remaining = projects.filter((p) => p.id !== id);
      setActiveProjectId(remaining.length > 0 ? remaining[0].id : null);
    }
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
