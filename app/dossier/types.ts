export type Profile = { name: string; school: string; major: string; bio: string; avatar: string };
export type Social = { id: string; label: string; url: string };
export type Education = { id: string; school: string; program: string; period: string; detail: string };
export type ProjectFile = { path: string; url: string; type: string; size: number };
export type Project = { id: string; title: string; period: string; role: string; stack: string; summary: string; detail?: string; url: string; files?: ProjectFile[]; readme?: string; cover?: string };
export type Experience = { id: string; organization: string; role: string; period: string; detail: string };
export type Award = { id: string; title: string; organizer: string; date: string; detail: string };
export type Node = { id: string; date: string; category: string; title: string; summary: string; detail: string };
export type Skill = { id: string; name: string; group: string; level: number; description?: string };
export type Dossier = { profile: Profile; socials: Social[]; experience: Experience[]; education: Education[]; projects: Project[]; awards: Award[]; skillItems: Skill[]; categories: string[]; nodes: Node[] };
export type DetailKind = "project" | "skill" | "experience" | "education" | "award" | "node";

export const dossierStorageKey = "lyrebird-dossier";
export const detailHref = (kind: DetailKind, id: string) => `/dossier/${kind}/${encodeURIComponent(id)}`;
