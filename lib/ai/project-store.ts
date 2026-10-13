import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function loadProjectForUser(userId: string, projectId: string) {
  const mongo = await clientPromise;
  const db = mongo.db();
  const user = await db.collection("users").findOne({ id: userId, "projects._id": new ObjectId(projectId) }, { projection: { "projects.$": 1 } });
  return user?.projects?.[0] || null;
}

export async function loadPages(userId: string, projectId: string) {
  const project = await loadProjectForUser(userId, projectId);
  return project?.pages || [];
}

export async function saveGeneratedSnapshot(userId: string, projectId: string, changeSet: any, mode: string) {
  const mongo = await clientPromise;
  const db = mongo.db();
  const project = await loadProjectForUser(userId, projectId);
  if (!project) return;

  let pages = project.pages || [];

  if (mode === "generate" && (changeSet.deletes.length > 0 || changeSet.upserts.some((u: any) => u.name === "package.json"))) {
    // preserve explicit deletes/moves but mostly handle upserts
  }

  pages = pages.filter((p: any) => !changeSet.deletes.includes(p.name));

  for (const move of changeSet.moves) {
    const page = pages.find((p: any) => p.name === move.from);
    if (page) page.name = move.to;
  }

  for (const upsert of changeSet.upserts) {
    const idx = pages.findIndex((p: any) => p.name === upsert.name);
    if (idx >= 0) {
      pages[idx] = { ...pages[idx], code: upsert.content, usedFor: upsert.usedFor, timestamp: Date.now() };
    } else {
      pages.push({ name: upsert.name, code: upsert.content, usedFor: upsert.usedFor, timestamp: Date.now() });
    }
  }

  await db.collection("users").updateOne(
    { id: userId, "projects._id": new ObjectId(projectId) },
    { $set: { "projects.$.pages": pages, "projects.$.updatedAt": new Date() } }
  );
}

export async function saveBuildHistory(projectId: string, entry: any) {
  // omit to prevent schema issues
}

export async function saveBuildError(projectId: string, error: any) {
  // omit
}

export async function clearBuildError(projectId: string) {
  // omit
}
