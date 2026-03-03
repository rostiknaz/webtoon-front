/**
 * Categories Service
 *
 * Category listing queries for feed filtering
 */

import { asc } from 'drizzle-orm';
import { categories } from '../../../db/schema';
import type { DB } from '../index';

/**
 * Category item returned by the API
 */
export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

/**
 * Get all categories ordered by sortOrder
 */
export async function getAllCategories(db: DB): Promise<CategoryItem[]> {
  const results = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder));

  return results;
}
