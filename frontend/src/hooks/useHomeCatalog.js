import { useCallback, useEffect, useMemo, useState } from "react";

import { getCategories } from "../api/categories";
import { getProjects } from "../api/projects";
import { toList } from "../utils/catalog";

function normalizeProject(project) {
  if (!project || typeof project !== "object") {
    return project;
  }

  const imageUrl =
    project.image_url ||
    project.imageUrl ||
    null;

  return {
    ...project,
    image_url: imageUrl,
    category: project.category || null,
    is_iot:
      project.is_iot === true ||
      project.is_iot === 1 ||
      project.is_iot === "1",
  };
}

export function useHomeCatalog() {
  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("");

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [projectData, categoryData] = await Promise.all([
        getProjects(),
        getCategories(),
      ]);

      const normalizedProjects = toList(projectData)
        .map(normalizeProject)
        .filter(Boolean);

      const normalizedCategories = toList(categoryData);

      setProjects(normalizedProjects);
      setCategories(normalizedCategories);
    } catch (err) {
      console.error("Home catalog loading failed:", err);
      setError("Unable to load software.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [projectData, categoryData] = await Promise.all([
          getProjects(),
          getCategories(),
        ]);

        if (cancelled) return;

        setProjects(
          toList(projectData)
            .map(normalizeProject)
            .filter(Boolean),
        );

        setCategories(toList(categoryData));
        setError("");
      } catch (err) {
        console.error("Home catalog loading failed:", err);

        if (!cancelled) {
          setError("Unable to load software.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const totals = {};
    let iot = 0;

    projects.forEach((project) => {
      const slug = project.category?.slug;

      if (slug) {
        totals[slug] = (totals[slug] || 0) + 1;
      }

      if (project.is_iot) {
        iot += 1;
      }
    });

    return {
      ...totals,
      totalProjects: projects.length,
      totalCategories: categories.length,
      iotProjects: iot,
    };
  }, [projects, categories]);

  const filtered = useMemo(() => {
    const normalizedSearch = query.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesCategory =
        !activeCategory ||
        project.category?.slug === activeCategory;

      if (!matchesCategory) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        project.title,
        project.abstract,
        project.category?.name,
        project.category?.slug,
        project.is_iot ? "iot" : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [projects, activeCategory, query]);

  const search = useCallback((value) => {
    setQuery(value ?? "");
  }, []);

  const selectCategory = useCallback((category) => {
    setActiveCategory(category?.slug ?? category ?? "");
  }, []);

  const clearFilters = useCallback(() => {
    setQuery("");
    setActiveCategory("");
  }, []);

  return {
    projects,
    categories,
    counts,
    filtered,
    loading,
    error,
    query,
    activeCategory,
    search,
    selectCategory,
    clearFilters,
    refresh: loadCatalog,
  };
}

export default useHomeCatalog;