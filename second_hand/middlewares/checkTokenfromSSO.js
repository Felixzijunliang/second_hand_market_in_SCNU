const sql = require('../db/sqlpool.js').pool;
const axios = require('axios');

// 检测token的中间件
module.exports = async (req, res, next) => {
  const username = req.headers['username'];
  const password = req.headers['password'];
  const token = req.query.t;

  if (!username || !password) {
    return res.json({
      statusID: -1,
      msg: '缺少用户名或密码',
    });
  }

  try {
    // 创建数据库连接
    const connection = await sql.getConnection();

    try {
      // 验证用户名和密码
      const [userResults] = await connection.query('SELECT * FROM `users` WHERE username = ? AND password = ?', [username, password]);

      if (userResults.length <= 0) {
        res.json({
          statusID: -1,
          msg: '用户名或密码不正确',
        });
        connection.release();
        return;
      }

      // 验证token
      const [tokenResults] = await connection.query('SELECT * FROM `token` WHERE token = ?', [token]);

      if (tokenResults.length <= 0) {
        res.json({
          statusID: -1,
          msg: '没有对应token',
        });
        connection.release();
        return;
      }

      if (tokenResults[0].userID != req.query.ID) {
        res.json({
          statusID: -1,
          msg: 'token与用户名不符',
        });
        connection.release();
        return;
      }

      var exptime = tokenResults[0].expireTime;
      var currentTimeStampInSeconds = Math.floor(Date.now() / 1000);

      if (currentTimeStampInSeconds < exptime) {
        exptime = currentTimeStampInSeconds + 3600; // 计算新的过期时间

        // 更新token过期时间
        await connection.query('UPDATE `token` SET `expireTime` = ? WHERE token = ?', [exptime, token]);

        // 检查token是否需要刷新
        const refreshToken = req.headers['x-refresh-token'];
        if (refreshToken) {
          try {
            // 调用SSO系统的接口来刷新token
            const response = await axios.post('http://sso.abdn.kirisame.cc/ce/api/token_refresh/', {
              refresh: refreshToken
            });

            if (response.status === 200) {
              const newToken = response.data.access;
              res.setHeader('x-new-access-token', newToken);
            }
          } catch (err) {
            console.error('Error refreshing token:', err);
            res.json({
              statusID: -1,
              msg: 'Token刷新失败',
            });
            connection.release();
            return;
          }
        }

        connection.release(); // 释放连接
        next(); // 放行请求

      } else {
        res.json({
          statusID: -1,
          msg: 'token失效',
        });
        connection.release();
      }
    } catch (queryErr) {
      console.error('Error executing query:', queryErr);
      res.json({
        statusID: -1,
        msg: '数据库查询错误',
      });
      connection.release();
    }
  } catch (err) {
    console.error('Error getting connection:', err);
    res.json({
      statusID: -1,
      msg: '数据库连接错误',
    });
  }
};
