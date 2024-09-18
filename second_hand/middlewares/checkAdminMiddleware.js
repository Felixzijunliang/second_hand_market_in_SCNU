const sql = require('../db/sqlpool.js').pool;

module.exports = (req, res, next) => {
  const userID = req.query.ID;
  // 使用userID查userinfo表的权限
  // 如果权限不够则返回 statsID: -1，够则不做操作
  sql.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection:', err);
      res.json({
        statusID: -1,
        msg: '数据库连接错误',
      });
      return;
    }

    // 执行查询
    connection.query('SELECT * FROM userinfo WHERE userID = ?', [userID], (queryErr, results) => {
      // 释放连接
      connection.release();

      if (queryErr) {
        console.error('Error executing query:', queryErr);
        res.json({
          statusID: -1,
          msg: '数据库查询错误',
        });
        return;
      }
      if (results.length <= 0) {
        res.json({
          statusID: -1,
          msg: 'userID不存在',
        });
        connection.release();
        return;
      }
      permlevel = results[0].permlevel
      // 如果权限不匹配
      if (permlevel == 0) {
        res.json({
          statusID: -1,
          msg: '权限不匹配'
        })
        return;
      }
      next()
    });
  })
}
