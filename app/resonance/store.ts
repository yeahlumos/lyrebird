export type Member = "self" | "other";
export type RelationshipKind = "partner" | "friend";
export type Reply = { id: string; author: Member; text: string; createdAt: string };
export type Post = { id: string; date: string; author: Member; text: string; images: string[]; createdAt: string; updatedAt?: string; replies: Reply[] };
export type Milestone = { id: string; title: string; date: string; time: string; yearly: boolean; headerColor?: string; background?: string; notified?: string };
export type Wish = { id: string; title: string; createdAt: string; completedAt?: string; diaryDate?: string; postId?: string };
export type Relationship = { id: string; kind: RelationshipKind; createdAt: string; posts: Post[]; cardBackground?: string; avatars?: Partial<Record<Member, string>>; milestones?: Milestone[]; wishes?: Wish[]; pet?: { name: string; fedOn?: string; feeds: number } };
export type Invite = { kind: RelationshipKind; createdAt: string; relationshipId?: string; avatars?: Partial<Record<Member, string>> };
export type Store = { version: 1; relationships: Relationship[]; invites: Record<string, Invite> };
export type Commit = (change: (store: Store) => void) => boolean;

export function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(fromKey(value)) === value; }

export function milestoneOccurrence(item: Milestone, now = new Date()) {
  const date = fromKey(item.date);
  if (item.yearly) {
    date.setFullYear(Math.max(now.getFullYear(), Number(item.date.slice(0, 4))));
    // Leap-day anniversaries fall on the last day of February in non-leap years.
    if (date.getMonth() !== Number(item.date.slice(5, 7)) - 1) date.setDate(0);
  }
  const [hour, minute] = item.time.split(":").map(Number);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export const storageKey = "lyrebird-resonance-v1";
export const draftPrefix = "lyrebird-resonance-draft:";
export const kindName = (kind: RelationshipKind) => kind === "partner" ? "伴侣" : "朋友";
export const memberName = (member: Member) => member === "self" ? "我" : "对方";
const isMember = (value: unknown): value is Member => value === "self" || value === "other";
const isKind = (value: unknown): value is RelationshipKind => value === "partner" || value === "friend";
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const validAvatars = (value: unknown) => value === undefined || (isRecord(value) && Object.entries(value).every(([key, src]) => isMember(key) && typeof src === "string" && /^data:image\/(webp|png|jpeg);base64,/.test(src)));
function validReply(value: unknown): value is Reply {
  return isRecord(value) && typeof value.id === "string" && isMember(value.author) && typeof value.text === "string" && typeof value.createdAt === "string";
}
function validPost(value: unknown): value is Post {
  return isRecord(value) && typeof value.id === "string" && typeof value.date === "string" && isMember(value.author) && typeof value.text === "string" && typeof value.createdAt === "string" && Array.isArray(value.images) && value.images.every((id) => typeof id === "string") && Array.isArray(value.replies) && value.replies.every(validReply);
}

export function readStore(): Store {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return { version: 1, relationships: [], invites: {} };
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.relationships) || !value.relationships.every((item) => isRecord(item) && typeof item.id === "string" && isKind(item.kind) && typeof item.createdAt === "string" && Array.isArray(item.posts) && item.posts.every(validPost)) || !isRecord(value.invites) || !Object.values(value.invites).every((item) => isRecord(item) && isKind(item.kind) && typeof item.createdAt === "string" && (item.relationshipId === undefined || typeof item.relationshipId === "string"))) {
    throw new Error("共鸣数据读取失败，原记录已保留，请勿清除网站数据。");
  }
  for (const relationship of value.relationships as Relationship[]) {
    if (!validAvatars(relationship.avatars)) throw new Error("头像数据读取失败，原记录已保留。");
    if (relationship.cardBackground !== undefined && (typeof relationship.cardBackground !== "string" || !/^data:image\/(webp|png|jpeg);base64,/.test(relationship.cardBackground))) throw new Error("卡片背景读取失败，原记录已保留。");
    if ((relationship.milestones !== undefined && (!Array.isArray(relationship.milestones) || !relationship.milestones.every((item) => isRecord(item) && typeof item.id === "string" && typeof item.title === "string" && typeof item.date === "string" && validDate(item.date) && typeof item.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time) && typeof item.yearly === "boolean" && (item.headerColor === undefined || (typeof item.headerColor === "string" && /^#[0-9a-fA-F]{6}$/.test(item.headerColor))) && (item.background === undefined || (typeof item.background === "string" && /^data:image\/(webp|png|jpeg);base64,/.test(item.background))) && (item.notified === undefined || typeof item.notified === "string")))) ||
      (relationship.wishes !== undefined && (!Array.isArray(relationship.wishes) || !relationship.wishes.every((item) => isRecord(item) && typeof item.id === "string" && typeof item.title === "string" && typeof item.createdAt === "string" && [item.completedAt, item.diaryDate, item.postId].every((field) => field === undefined || typeof field === "string")))) ||
      (relationship.pet !== undefined && (!isRecord(relationship.pet) || typeof relationship.pet.name !== "string" || !Number.isSafeInteger(relationship.pet.feeds) || relationship.pet.feeds < 0 || (relationship.pet.fedOn !== undefined && typeof relationship.pet.fedOn !== "string")))) throw new Error("小助手数据读取失败，原记录已保留。");
  }
  if (!Object.values(value.invites).every((invite) => isRecord(invite) && validAvatars(invite.avatars))) throw new Error("邀请头像读取失败，原记录已保留。");
  return value as Store;
}

export function completeWish(relationship: Relationship, id: string, date: string, author: Member, linkDiary: boolean, note: string) {
  if (!validDate(date)) throw new Error("请选择有效的完成日期。");
  const wish = relationship.wishes?.find((item) => item.id === id);
  if (!wish) throw new Error("这条心愿已被删除。");
  if (wish.completedAt) return;
  wish.completedAt = date;
  if (linkDiary) {
    const post: Post = { id: crypto.randomUUID(), date, author, text: `一起完成了心愿：${wish.title}${note.trim() ? `\n\n${note.trim()}` : ""}`, images: [], replies: [], createdAt: new Date().toISOString() };
    relationship.posts.push(post);
    wish.diaryDate = date;
    wish.postId = post.id;
  }
}

export function createInvite(store: Store, kind: RelationshipKind): string {
  let code: string;
  do { code = `LYRE-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`; } while (store.invites[code]);
  store.invites[code] = { kind, createdAt: new Date().toISOString() };
  return code;
}

export function acceptInvite(store: Store, rawCode: string, kind: RelationshipKind): Relationship {
  const code = rawCode.trim().toUpperCase();
  const invite = Object.hasOwn(store.invites, code) ? store.invites[code] : undefined;
  if (invite?.relationshipId) throw new Error("这个邀请码已经使用，请生成新的邀请码。");
  if (!invite && code !== "LYRE2026") throw new Error("邀请码无效。测试可输入 LYRE2026，或使用本浏览器生成的邀请码。");
  if (invite && invite.kind !== kind) throw new Error(`这份邀请的关系是${kindName(invite.kind)}，请选择对应关系。`);
  const relationship: Relationship = { id: crypto.randomUUID(), kind, createdAt: new Date().toISOString(), posts: [], ...(invite?.avatars ? { avatars: { ...invite.avatars } } : {}) };
  store.relationships.unshift(relationship);
  store.invites[code] = { ...(invite ?? { kind, createdAt: relationship.createdAt }), relationshipId: relationship.id };
  return relationship;
}

export function findRelationship(store: Store, id: string): Relationship {
  const relationship = store.relationships.find((item) => item.id === id);
  if (!relationship) throw new Error("这张关系卡片已被删除，请返回共鸣列表。");
  return relationship;
}

export function ownPost(relationship: Relationship, postId: string, actor: Member): Post {
  const post = relationship.posts.find((item) => item.id === postId);
  if (!post) throw new Error("这条日记已被删除。");
  if (post.author !== actor) throw new Error("只能编辑或删除自己写的日记。");
  return post;
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function fromKey(value: string) { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d); }
export function timeLabel(value: string) { return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }); }
