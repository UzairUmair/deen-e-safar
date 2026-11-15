import { exportGuestData } from "../guest/guestStorage";
import { backendRequest } from "./backendClient";
import { hydrateAccount } from "./accountStore";
export function guestImportPreview() {
  const raw = exportGuestData();
  const read = (key: string, envelope = false) => {
    try { const value = JSON.parse(raw[key] || "null"); return envelope ? value?.v === 1 ? value.data : null : value; } catch { return null; }
  };
  const saved = read("deen-v2:guest:bookmarks", true);
  const bookmarks = [
    ...(Array.isArray(saved?.quran) ? saved.quran.filter(b => Number.isInteger(b.surah) && Number.isInteger(b.ayah)).map(b => ({ contentType: "quran", contentRef: `${b.surah}:${b.ayah}` })) : []),
    ...(Array.isArray(saved?.duas) ? saved.duas.filter(b => typeof b.id === "string").map(b => ({ contentType: "dua", contentRef: b.id })) : []),
    ...(Array.isArray(read("deen-library-saved")) ? read("deen-library-saved").filter(id => typeof id === "string" && id.startsWith("hadith:")).map(id => ({ contentType: "hadith", contentRef: id.slice(7) })) : []),
  ];
  const position = read("deen-v2:guest:reading-progress", true);
  const done = read("deen-lessons"), notes = read("deen-notes");
  const ids = new Set([...(Array.isArray(done) ? done.filter(id => typeof id === "string") : []), ...Object.keys(notes && typeof notes === "object" && !Array.isArray(notes) ? notes : {})]);
  const lessons = [...ids].map(lessonId => ({ lessonId, completed: Array.isArray(done) && done.includes(lessonId), ...(typeof notes?.[lessonId] === "string" ? { note: notes[lessonId] } : {}) }));
  return { consent: true as const, bookmarks, reading: position ? [{ surah: position.surah, ayah: position.ayah }] : [], lessons };
}
export async function importGuestWithConsent(consent: boolean) {
  if (!consent) throw new Error("Consent is required.");
  const result = await backendRequest("/api/users/me/guest-import", { method: "POST", body: guestImportPreview() });
  await hydrateAccount();
  // No local keys are erased, including after a confirmed successful import.
  return result.data;
}
