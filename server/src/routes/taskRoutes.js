import { Router } from 'express';
import { listTasks, createTask, updateTask, deleteTask } from '../controllers/taskController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';
import { validate } from '../middlewares/validate.js';
import { createTaskSchema, updateTaskSchema } from '../validations/taskValidation.js';

const taskRouter = Router();
taskRouter.use(protect('admin'), restrictTo('ADMIN'));
taskRouter.get('/', listTasks);
taskRouter.post('/', validate(createTaskSchema), createTask);
taskRouter.patch('/:id', validate(updateTaskSchema), updateTask);
taskRouter.delete('/:id', deleteTask);

export default taskRouter;
