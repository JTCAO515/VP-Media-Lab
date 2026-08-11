import { StoryboardV1Schema, type StoryboardV1 } from '@visepanda/media-lab-domain';
import type { MediaLabDatabase } from './database';

export interface CreateProjectWithStoryboardInput {
  id: string;
  title: string;
  createdAt: string;
  storyboard: StoryboardV1;
}

export interface StoredProject {
  id: string;
  title: string;
  createdAt: string;
  storyboard: StoryboardV1;
}

export function createProjectWithStoryboard(database: MediaLabDatabase, input: CreateProjectWithStoryboardInput): StoredProject {
  const storyboard = StoryboardV1Schema.parse(input.storyboard);
  if (storyboard.projectId !== input.id) throw new Error('PROJECT_STORYBOARD_MISMATCH');
  database.run('INSERT INTO projects (id, title, created_at) VALUES (?, ?, ?);', [input.id, input.title, input.createdAt]);
  database.run(
    'INSERT INTO storyboards (project_id, id, schema_version, payload, updated_at) VALUES (?, ?, ?, ?, ?);',
    [input.id, storyboard.id, storyboard.schemaVersion, JSON.stringify(storyboard), input.createdAt]
  );
  return { id: input.id, title: input.title, createdAt: input.createdAt, storyboard };
}

export function getProjectWithStoryboard(database: MediaLabDatabase, projectId: string): StoredProject | null {
  const row = database.all(
    'SELECT projects.id, projects.title, projects.created_at, storyboards.payload FROM projects JOIN storyboards ON storyboards.project_id = projects.id WHERE projects.id = ?;',
    [projectId]
  )[0];
  if (!row) return null;
  return {
    id: String(row.id), title: String(row.title), createdAt: String(row.created_at),
    storyboard: StoryboardV1Schema.parse(JSON.parse(String(row.payload)))
  };
}
