"use client";

import { createContext } from "react";
import type { ArticleTemplateKey } from "@/server/articles/templates";

/**
 * Opens "Create new article" preset to a template. Provided by
 * ArticlesManager so every ArticleView can offer "Add new X" without each
 * template component passing it down.
 */
export const CreateArticleContext = createContext<((template: ArticleTemplateKey) => void) | null>(null);
