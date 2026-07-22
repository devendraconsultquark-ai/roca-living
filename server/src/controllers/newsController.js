import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';

// Admin-curated "Legislation & News" items shown on the admin dashboard.

const formatItem = (n) => ({
  ...n,
  published_on: n.published_on ? new Date(n.published_on).toISOString().split('T')[0] : null,
  created_at: n.created_at ? new Date(n.created_at).toISOString() : null,
  updated_at: n.updated_at ? new Date(n.updated_at).toISOString() : null
});

const validateFields = ({ title, url, published_on }, { partial }) => {
  if (!partial || title !== undefined) {
    if (!title || !String(title).trim()) {
      throw new ApiError(400, 'title is required');
    }
    if (String(title).trim().length > 255) {
      throw new ApiError(400, 'title must be 255 characters or fewer');
    }
  }
  if (url !== undefined && url !== null && url !== '') {
    if (!/^https?:\/\/\S+$/i.test(String(url))) {
      throw new ApiError(400, 'url must be a valid http(s) link');
    }
  }
  if (!partial || published_on !== undefined) {
    if (!published_on || isNaN(new Date(published_on).getTime())) {
      throw new ApiError(400, 'published_on must be a valid date');
    }
  }
};

export const getNewsItems = catchAsync(async (req, res, next) => {
  const { status } = req.query;
  let query = db('news_items').orderBy('published_on', 'desc').orderBy('id', 'desc');
  if (status) {
    if (!['active', 'archived'].includes(status)) {
      throw new ApiError(400, 'status filter must be active or archived');
    }
    query = query.where('status', status);
  }
  const items = await query;
  res.json({ success: true, data: items.map(formatItem) });
});

export const createNewsItem = catchAsync(async (req, res, next) => {
  const { title, url, published_on } = req.body;
  validateFields({ title, url, published_on }, { partial: false });

  const [id] = await db('news_items').insert({
    title: String(title).trim(),
    url: url ? String(url).trim() : null,
    published_on,
    status: 'active',
    created_by: req.user.id
  });

  await db('audit_log').insert({
    actor_id: req.user.id,
    actor_role: req.user.role,
    action: 'NEWS_ITEM_CREATED',
    entity_type: 'news_item',
    entity_id: id,
    meta: JSON.stringify({ title: String(title).trim() }),
    ip_address: req.ip || null
  });

  const item = await db('news_items').where('id', id).first();
  res.status(201).json({ success: true, data: formatItem(item) });
});

export const updateNewsItem = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { title, url, published_on, status } = req.body;

  const existing = await db('news_items').where('id', id).first();
  if (!existing) {
    throw new ApiError(404, 'News item not found');
  }

  validateFields({ title, url, published_on }, { partial: true });
  if (status !== undefined && !['active', 'archived'].includes(status)) {
    throw new ApiError(400, 'status must be active or archived');
  }

  const updates = {};
  if (title !== undefined) updates.title = String(title).trim();
  if (url !== undefined) updates.url = url ? String(url).trim() : null;
  if (published_on !== undefined) updates.published_on = published_on;
  if (status !== undefined) updates.status = status;

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'No valid news item fields to update');
  }

  await db('news_items').where('id', id).update(updates);

  await db('audit_log').insert({
    actor_id: req.user.id,
    actor_role: req.user.role,
    action: 'NEWS_ITEM_UPDATED',
    entity_type: 'news_item',
    entity_id: id,
    meta: JSON.stringify(updates),
    ip_address: req.ip || null
  });

  const item = await db('news_items').where('id', id).first();
  res.json({ success: true, data: formatItem(item) });
});

export const deleteNewsItem = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const existing = await db('news_items').where('id', id).first();
  if (!existing) {
    throw new ApiError(404, 'News item not found');
  }

  await db('news_items').where('id', id).delete();

  await db('audit_log').insert({
    actor_id: req.user.id,
    actor_role: req.user.role,
    action: 'NEWS_ITEM_DELETED',
    entity_type: 'news_item',
    entity_id: id,
    meta: JSON.stringify({ title: existing.title }),
    ip_address: req.ip || null
  });

  res.json({ success: true, data: null });
});
