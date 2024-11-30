const sql = require('../db/sqlpool.js').pool;
// 检测token的中间件
module.exports = (req, res, next) => {
  //创建连接
  sql.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection:', err);
      res.json({
        statusID: -1,
        msg: '数据库连接错误',
      });
      return;
    }
    const token = req.query.t;
    // console.log(req)
    connection.query('SELECT * FROM `token` WHERE token = ?', [token], (queryErr, results) => {

      if (queryErr) {
        console.error('Error executing query:', queryErr);
        connection.release();
        res.json({
          statusID: -1,
          msg: '数据库查询错误',
        });
        return;
      }
      //console.log(results[0].expireTime)
      //console.log(results.length)
      if (results.length <= 0) {
        // console.log("fail9")
        res.json({
          statusID: -1,
          msg: '没有对应token',
        });
        connection.release();
        return;
      }
      if (results[0].userID != req.query.ID) {
        console.log("fail1")
        res.json({
          statusID: -1,
          msg: 'token与用户名不符',
        });
        return;
      }

      var exptime = results[0].expireTime
      var currentTimeStampInSeconds = Math.floor(Date.now() / 1000)
      if (currentTimeStampInSeconds < exptime) {
        exptime = currentTimeStampInSeconds + 3600; // 计算新的过期时间
        // 操作数据库续期token
        connection.query('UPDATE `token` set `expireTime` = ? where token = ?', [exptime, token], (queryErr, results) => {
          if (queryErr) {
            connection.release();
            // console.log("fail2")
            res.json({
              statusID: -1,
              msg: '更新token限期失败',
            });
            return;
          }
          // console.log(results) // 打印更新数据库信息
          connection.release(); // 释放连接
        })
        next();
      } else {
        // console.log("fail3")
        res.json({
          statusID: -1,
          msg: 'token失效',
        });
        connection.release();
      }
    })
  });
}

