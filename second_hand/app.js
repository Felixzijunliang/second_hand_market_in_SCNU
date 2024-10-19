const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');

const indexRouter = require('./routes/index');
const recordRouter = require('./routes/record');
const userRouter = require('./routes/user');
const corsOptions = require('./config/corsconfig');
const productsRouter = require('./routes/products');
const orderRouter = require('./routes/order');

const checkTokenMiddleware = require('./middlewares/checkTokenMiddleware');


const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, './uploads')));


app.use(cors(corsOptions));
app.use('/record', recordRouter)
app.use('/products', productsRouter)
app.use('/order', orderRouter)
app.use('/user', userRouter)
app.use('/', indexRouter);


// 异常处理
app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
