// Implementação real (Supabase + servidor no Render).
// O mockApi.js implementa exatamente a mesma interface para o modo demonstração.
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import { env } from '../lib/env';
import { AppError, toAppError } from '../lib/errors';
import { compressImage, uid as newId } from '../lib/image';

const unwrap = ({ data, error }) => {
  if (error) throw toAppError(error);
  return data;
};

async function session() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new AppError('AUTH_REQUIRED');
  return data.session;
}
const myId = async () => (await session()).user.id;

async function server(path, body) {
  const s = await session();
  const res = await fetch(env.API_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
    body: JSON.stringify(body || {}),
  }).catch(() => {
    throw new AppError('NETWORK');
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw toAppError(json.error || `HTTP ${res.status}`);
  return json;
}

async function uploadTo(bucket, path, file, opts) {
  const blob = file.type?.startsWith('image/') ? await compressImage(file, opts) : file;
  unwrap(await supabase.storage.from(bucket).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false }));
  return bucket === 'photos' || bucket === 'posts' ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null;
}

const signedCache = new Map();
async function signed(bucket, paths, ttl = 3600) {
  const missing = paths.filter((p) => !signedCache.has(bucket + p) || signedCache.get(bucket + p).exp < Date.now());
  if (missing.length) {
    const data = unwrap(await supabase.storage.from(bucket).createSignedUrls(missing, ttl));
    data.forEach((d) => d.signedUrl && signedCache.set(bucket + d.path, { url: d.signedUrl, exp: Date.now() + (ttl - 60) * 1000 }));
  }
  return paths.map((p) => signedCache.get(bucket + p)?.url || null);
}

// ===================================================================
export const api = {
  demo: false,

  // ---------------- Autenticação ----------------
  auth: {
    async getSession() {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
    onChange(cb) {
      const { data } = supabase.auth.onAuthStateChange((_e, s) => cb(s));
      return () => data.subscription.unsubscribe();
    },
    async signIn(provider) {
      const native = Capacitor.isNativePlatform();
      const redirectTo = native ? env.DEEP_LINK : `${window.location.origin}/auth/callback`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: native, scopes: provider === 'apple' ? 'name email' : undefined },
      });
      if (error) throw toAppError(error);
      if (native) {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: data.url, presentationStyle: 'popover' });
      }
    },
    // iOS: o OAuth volta por deep link basher://auth/callback?code=...
    async handleDeepLink(url) {
      if (!url?.startsWith(env.DEEP_LINK)) return false;
      const code = new URL(url.replace('basher://', 'https://x/')).searchParams.get('code');
      if (code) unwrap(await supabase.auth.exchangeCodeForSession(code));
      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.close();
      } catch { /* já fechado */ }
      return true;
    },
    async signOut() {
      await supabase.auth.signOut();
    },
    async deleteAccount() {
      await server('/account/delete');
      await supabase.auth.signOut();
    },
  },

  // ---------------- Eu ----------------
  async getMe() {
    const s = await session();
    const id = s.user.id;
    const [profile, priv, status, photos] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single().then(unwrap),
      supabase.from('profile_private').select('birthdate,age_verified_at,incognito,hide_distance,hide_age,on_prep,last_tested,show_health,accepted_terms_at,sensitive_consent_at').eq('id', id).single().then(unwrap),
      supabase.rpc('my_status').then(unwrap),
      supabase.from('photos').select('id,url,path,sort').eq('user_id', id).order('sort').then(unwrap),
    ]);
    return {
      id,
      email: s.user.email,
      provider: s.user.app_metadata?.provider,
      profile,
      private: priv,
      photos,
      status,
    };
  },
  async myStatus() {
    return unwrap(await supabase.rpc('my_status'));
  },
  async updateProfile(patch) {
    const id = await myId();
    return unwrap(await supabase.from('profiles').update(patch).eq('id', id).select('*').single());
  },
  async updatePrivate(patch) {
    const id = await myId();
    return unwrap(await supabase.from('profile_private').update(patch).eq('id', id).select('birthdate,age_verified_at,incognito,hide_distance,hide_age,on_prep,last_tested,show_health,accepted_terms_at,sensitive_consent_at').single());
  },
  async recordAgeSignal(lower, source) {
    return unwrap(await supabase.rpc('record_age_signal', { p_lower: lower, p_source: source }));
  },
  async completeOnboarding() {
    return unwrap(await supabase.rpc('complete_onboarding'));
  },
  async updateLocation(lat, lng) {
    unwrap(await supabase.rpc('update_my_location', { p_lat: lat, p_lng: lng }));
  },

  // ---------------- Fotos do perfil ----------------
  async uploadPhoto(file, sort = 0) {
    const id = await myId();
    const path = `${id}/${newId()}.jpg`;
    const url = await uploadTo('photos', path, file);
    return unwrap(await supabase.from('photos').insert({ user_id: id, path, url, sort }).select('id,url,path,sort').single());
  },
  async deletePhoto(photo) {
    unwrap(await supabase.from('photos').delete().eq('id', photo.id));
    await supabase.storage.from('photos').remove([photo.path]);
  },
  async reorderPhotos(photos) {
    await Promise.all(photos.map((p, i) => supabase.from('photos').update({ sort: i }).eq('id', p.id)));
  },

  // ---------------- Descoberta ----------------
  async nearby({ filters = {}, offset = 0, limit = 60, explore = null } = {}) {
    return unwrap(
      await supabase.rpc('nearby_profiles', {
        p_lat: explore?.lat ?? null,
        p_lng: explore?.lng ?? null,
        p_filters: filters,
        p_limit: limit,
        p_offset: offset,
      }),
    );
  },
  async getProfile(id) {
    const p = unwrap(await supabase.rpc('get_profile', { p_id: id }));
    if (!p) throw new AppError('NOT_FOUND');
    return p;
  },
  async myViewers() {
    return unwrap(await supabase.rpc('my_viewers'));
  },
  async sendTap(to, kind) {
    unwrap(await supabase.rpc('send_tap', { p_to: to, p_kind: kind }));
  },
  async myTaps() {
    return unwrap(await supabase.rpc('my_taps'));
  },
  async markTapsSeen() {
    await supabase.rpc('mark_taps_seen');
  },

  // ---------------- Álbuns privados ----------------
  async myAlbums() {
    const id = await myId();
    const rows = unwrap(
      await supabase.from('albums').select('id,title,created_at,album_items(id,path)').eq('owner_id', id).order('created_at'),
    );
    return Promise.all(
      rows.map(async (a) => {
        const cover = a.album_items?.[0]?.path;
        return { id: a.id, title: a.title, created_at: a.created_at, count: a.album_items?.length || 0, cover: cover ? (await signed('albums', [cover]))[0] : null };
      }),
    );
  },
  async createAlbum(title) {
    const id = await myId();
    return unwrap(await supabase.from('albums').insert({ owner_id: id, title }).select('id,title,created_at').single());
  },
  async renameAlbum(albumId, title) {
    unwrap(await supabase.from('albums').update({ title }).eq('id', albumId));
  },
  async deleteAlbum(albumId) {
    const id = await myId();
    const items = unwrap(await supabase.from('album_items').select('path').eq('album_id', albumId));
    if (items.length) await supabase.storage.from('albums').remove(items.map((i) => i.path));
    unwrap(await supabase.from('albums').delete().eq('id', albumId).eq('owner_id', id));
  },
  async albumItems(albumId) {
    const items = unwrap(await supabase.from('album_items').select('id,path,media_type,created_at').eq('album_id', albumId).order('created_at'));
    const urls = await signed('albums', items.map((i) => i.path));
    return items.map((i, k) => ({ ...i, url: urls[k] }));
  },
  async albumMeta(albumId) {
    return unwrap(await supabase.from('albums').select('id,title,owner_id').eq('id', albumId).single());
  },
  async addAlbumItem(albumId, file) {
    const id = await myId();
    const isVideo = file.type?.startsWith('video/');
    const path = `${id}/${albumId}/${newId()}.${isVideo ? 'mp4' : 'jpg'}`;
    await uploadTo('albums', path, file);
    return unwrap(await supabase.from('album_items').insert({ album_id: albumId, owner_id: id, path, media_type: isVideo ? 'video' : 'image' }).select('id,path,media_type').single());
  },
  async deleteAlbumItem(item) {
    unwrap(await supabase.from('album_items').delete().eq('id', item.id));
    await supabase.storage.from('albums').remove([item.path]);
  },
  async albumShares(albumId) {
    const rows = unwrap(
      await supabase.from('album_shares')
        .select('id,created_at,expires_at,revoked_at,recipient:profiles!album_shares_recipient_id_fkey(id,display_name,avatar_url)')
        .eq('album_id', albumId).is('revoked_at', null).order('created_at', { ascending: false }),
    );
    return rows.filter((r) => !r.expires_at || new Date(r.expires_at) > new Date());
  },
  async shareAlbum(albumId, to, hours) {
    return unwrap(await supabase.rpc('share_album', { p_album: albumId, p_recipient: to, p_expires_hours: hours }));
  },
  async revokeShare(shareId) {
    unwrap(await supabase.rpc('revoke_album_share', { p_share: shareId }));
  },
  async requestAlbum(owner) {
    return unwrap(await supabase.rpc('request_album', { p_owner: owner }));
  },
  async myAlbumRequests() {
    return unwrap(await supabase.rpc('my_album_requests'));
  },
  async declineAlbumRequest(id) {
    unwrap(await supabase.rpc('decline_album_request', { p_request: id }));
  },

  // ---------------- Conversas ----------------
  async conversations() {
    return unwrap(await supabase.rpc('my_conversations'));
  },
  async openDirect(userId) {
    return unwrap(await supabase.rpc('get_or_create_direct', { p_other: userId }));
  },
  async conversation(convId) {
    const me = await myId();
    const conv = unwrap(await supabase.from('conversations').select('*').eq('id', convId).single());
    const members = unwrap(
      await supabase.from('conversation_members')
        .select('role,user_id,profile:profiles(id,display_name,avatar_url,last_active)')
        .eq('conversation_id', convId),
    );
    const other = conv.is_group ? null : members.find((m) => m.user_id !== me)?.profile;
    return { ...conv, members, other, myRole: members.find((m) => m.user_id === me)?.role };
  },
  async messages(convId, before = null) {
    let q = supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: false }).limit(50);
    if (before) q = q.lt('created_at', before);
    const rows = unwrap(await q).reverse();
    return hydrateImages(rows);
  },
  async send(convId, { kind = 'text', body = '', meta = {} }) {
    const me = await myId();
    const row = unwrap(await supabase.from('messages').insert({ conversation_id: convId, sender_id: me, kind, body, meta }).select('*').single());
    return (await hydrateImages([row]))[0];
  },
  async sendImage(convId, file) {
    const path = `${convId}/${newId()}.jpg`;
    await uploadTo('chat', path, file, { max: 1280 });
    return api.send(convId, { kind: 'image', meta: { path } });
  },
  async unsend(messageId) {
    unwrap(await supabase.rpc('unsend_message', { p_message: messageId }));
  },
  async markRead(convId) {
    await supabase.rpc('mark_read', { p_conv: convId });
  },
  subscribeConversation(convId, { onMessage, onUpdate, onTyping }) {
    // mensagens: canal próprio desta tela (nome único evita colisão ao reabrir a conversa)
    const db = supabase
      .channel(`msgs:${convId}:${newId()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        async (p) => onMessage?.((await hydrateImages([p.new]))[0]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        (p) => onUpdate?.(p.new))
      .subscribe();
    // "digitando…": canal broadcast compartilhado pelos dois lados da conversa
    const live = supabase
      .channel(`typing:${convId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, (p) => onTyping?.(p.payload))
      .subscribe();
    return {
      typing: (payload) => live.send({ type: 'broadcast', event: 'typing', payload }).catch(() => {}),
      close: () => {
        supabase.removeChannel(db);
        supabase.removeChannel(live);
      },
    };
  },
  subscribeInbox(onEvent) {
    const ch = supabase
      .channel(`inbox:${newId()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => onEvent({ type: 'message', row: p.new }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taps' }, (p) => onEvent({ type: 'tap', row: p.new }))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'album_requests' }, (p) => onEvent({ type: 'album_request', row: p.new }))
      .subscribe();
    return () => supabase.removeChannel(ch);
  },
  async createGroup(title, memberIds, description) {
    return unwrap(await supabase.rpc('create_group', { p_title: title, p_members: memberIds, p_description: description || null }));
  },
  async addGroupMembers(convId, ids) {
    return unwrap(await supabase.rpc('add_group_members', { p_conv: convId, p_members: ids }));
  },
  async removeGroupMember(convId, userId) {
    unwrap(await supabase.rpc('remove_group_member', { p_conv: convId, p_user: userId }));
  },
  async joinGroup(code) {
    return unwrap(await supabase.rpc('join_group', { p_code: code.trim() }));
  },
  async leaveConversation(convId) {
    const me = await myId();
    unwrap(await supabase.from('conversation_members').delete().eq('conversation_id', convId).eq('user_id', me));
  },
  async setMuted(convId, muted) {
    const me = await myId();
    unwrap(await supabase.from('conversation_members').update({ muted }).eq('conversation_id', convId).eq('user_id', me));
  },

  // ---------------- Feed, Agora e Stories ----------------
  async posts(kind) {
    const rows = unwrap(await supabase.rpc('nearby_posts', { p_kind: kind, p_limit: 40 }));
    return rows;
  },
  async createPost({ kind, body, file }) {
    const me = await myId();
    let media_url = null;
    let media_path = null;
    if (file) {
      media_path = `${me}/${newId()}.jpg`;
      media_url = await uploadTo('posts', media_path, file);
    }
    return unwrap(await supabase.from('posts').insert({ author_id: me, kind, body, media_url, media_path }).select('id').single());
  },
  async deletePost(post) {
    unwrap(await supabase.from('posts').delete().eq('id', post.id));
  },
  async like(postId, on) {
    const me = await myId();
    if (on) unwrap(await supabase.from('post_likes').upsert({ post_id: postId, user_id: me }, { ignoreDuplicates: true }));
    else unwrap(await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', me));
  },
  async comments(postId) {
    return unwrap(await supabase.rpc('post_comments_list', { p_post: postId }));
  },
  async addComment(postId, body) {
    const me = await myId();
    unwrap(await supabase.from('post_comments').insert({ post_id: postId, author_id: me, body }));
  },
  async storiesTray() {
    return unwrap(await supabase.rpc('stories_tray'));
  },
  async storiesOf(authorId) {
    const rows = unwrap(
      await supabase.from('stories').select('id,author_id,media_url,caption,created_at,expires_at')
        .eq('author_id', authorId).gt('expires_at', new Date().toISOString()).order('created_at'),
    );
    const author = unwrap(await supabase.from('profiles').select('id,display_name,avatar_url').eq('id', authorId).single());
    return { author, stories: rows };
  },
  async createStory(file, caption = '') {
    const me = await myId();
    const media_path = `${me}/story-${newId()}.jpg`;
    const media_url = await uploadTo('posts', media_path, file, { max: 1600 });
    unwrap(await supabase.from('stories').insert({ author_id: me, media_url, media_path, caption }));
  },
  async viewStory(storyId) {
    const me = await myId();
    await supabase.from('story_views').upsert({ story_id: storyId, viewer_id: me }, { ignoreDuplicates: true });
  },
  async deleteStory(storyId) {
    unwrap(await supabase.from('stories').delete().eq('id', storyId));
  },

  // ---------------- Segurança ----------------
  async block(userId) {
    const me = await myId();
    unwrap(await supabase.from('blocks').upsert({ blocker_id: me, blocked_id: userId }, { ignoreDuplicates: true }));
  },
  async unblock(userId) {
    const me = await myId();
    unwrap(await supabase.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', userId));
  },
  async blocked() {
    return unwrap(await supabase.rpc('my_blocked'));
  },
  async report(userId, reason, details, block = true) {
    unwrap(await supabase.rpc('report_user', { p_user: userId, p_reason: reason, p_details: details, p_block: block }));
  },

  // ---------------- Compras (validação no servidor) ----------------
  async verifyAppleTransaction(payload) {
    return server('/iap/apple/verify', payload);
  },
};

async function hydrateImages(rows) {
  const paths = rows.filter((r) => r.kind === 'image' && r.meta?.path && !r.deleted_at).map((r) => r.meta.path);
  if (!paths.length) return rows;
  const urls = await signed('chat', paths);
  const map = Object.fromEntries(paths.map((p, i) => [p, urls[i]]));
  return rows.map((r) => (r.kind === 'image' && r.meta?.path ? { ...r, meta: { ...r.meta, url: map[r.meta.path] } } : r));
}
