"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ArticleFolder, FolderItem } from "./folder-tree";

/**
 * The Articles page's folders (GET /api/article-folders) and every change to
 * them. Each change resolves an error message, or null once saved and
 * reloaded. Nothing here touches an article itself.
 */
export interface ArticleFolderStore {
  folders: ArticleFolder[];
  items: FolderItem[];
  refresh: () => Promise<void>;
  createFolder: (name: string, parentId: string | null) => Promise<{ error: string | null; folder?: ArticleFolder }>;
  patchFolder: (id: string, body: { name?: string; color?: string | null; parentId?: string | null }) => Promise<string | null>;
  deleteFolder: (id: string) => Promise<string | null>;
  addArticles: (folderId: string, articleIds: string[]) => Promise<string | null>;
  removeArticles: (folderId: string, articleIds: string[]) => Promise<string | null>;
  moveArticle: (articleId: string, from: string, to: string) => Promise<string | null>;
}

async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { error: "Could not reach the server. Try again." } };
  }
}

const errorOf = (data: Record<string, unknown>, fallback: string) => (typeof data.error === "string" ? data.error : fallback);

export function useArticleFolderStore(): ArticleFolderStore {
  const [data, setData] = useState<{ folders: ArticleFolder[]; items: FolderItem[] }>({ folders: [], items: [] });

  const refresh = useCallback(async () => {
    const res = await send("/api/article-folders", "GET");
    if (res.ok) setData({ folders: (res.data.folders as ArticleFolder[]) ?? [], items: (res.data.items as FolderItem[]) ?? [] });
  }, []);

  /** Runs a change, then reloads; resolves the error message, or null. */
  const change = useCallback(
    async (url: string, method: string, body: unknown, fallback: string) => {
      const res = await send(url, method, body);
      if (!res.ok) return errorOf(res.data, fallback);
      await refresh();
      return null;
    },
    [refresh],
  );

  return useMemo(
    () => ({
      ...data,
      refresh,
      createFolder: async (name, parentId) => {
        const res = await send("/api/article-folders", "POST", { name, parentId });
        if (!res.ok) return { error: errorOf(res.data, "Could not create the folder.") };
        await refresh();
        return { error: null, folder: res.data.folder as ArticleFolder };
      },
      patchFolder: (id, body) => change(`/api/article-folders/${id}`, "PATCH", body, "Could not save the folder."),
      deleteFolder: (id) => change(`/api/article-folders/${id}`, "DELETE", undefined, "Could not delete the folder."),
      addArticles: (folderId, articleIds) => change(`/api/article-folders/${folderId}/items`, "POST", { articleIds }, "Could not add to the folder."),
      removeArticles: (folderId, articleIds) => change(`/api/article-folders/${folderId}/items`, "DELETE", { articleIds }, "Could not remove from the folder."),
      moveArticle: (articleId, from, to) => change("/api/article-folders/move", "POST", { articleId, from, to }, "Could not move the article."),
    }),
    [data, refresh, change],
  );
}

/** For the article page's Folders control, deep inside each article component. */
export const ArticleFoldersContext = createContext<ArticleFolderStore | null>(null);

export const useArticleFolders = () => useContext(ArticleFoldersContext);
