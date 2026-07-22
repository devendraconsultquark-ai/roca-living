import { Router } from 'express';
import {
  getNewsItems,
  createNewsItem,
  updateNewsItem,
  deleteNewsItem
} from '../controllers/newsController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const newsRouter = Router();

// Admin-only: news items are curated and consumed inside the admin portal.
newsRouter.use(protect('admin'), restrictTo('ADMIN'));

newsRouter.route('/')
  .get(getNewsItems)
  .post(createNewsItem);

newsRouter.route('/:id')
  .patch(updateNewsItem)
  .delete(deleteNewsItem);

export default newsRouter;
