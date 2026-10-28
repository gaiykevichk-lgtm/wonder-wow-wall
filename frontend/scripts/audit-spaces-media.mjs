import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../public/', import.meta.url));
const scenes = JSON.parse(readFileSync(root + 'content/spaces.json', 'utf8'));
const hashes = new Map();
const issues = [];
for (const scene of scenes) {
 const path = root + scene.image.replace(/^\//, '');
 if (!existsSync(path)) { issues.push({ code: 'missing_image', id: scene.id }); continue; }
 const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
 const ids = hashes.get(hash) || [];
 ids.push(scene.id); hashes.set(hash, ids);
 if (!scene.renders?.length) issues.push({ code: 'missing_renders', id: scene.id });
 if (!scene.catalogBindings?.length) issues.push({ code: 'missing_catalog_bindings', id: scene.id });
}
for (const ids of hashes.values()) if (ids.length > 1) issues.push({ code: 'duplicate_scene_bytes', ids });
console.log(JSON.stringify({ scenes: scenes.length, uniqueImages: hashes.size, issues }, null, 2));
process.exitCode = issues.length ? 1 : 0;
