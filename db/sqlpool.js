const mysql = require('mysql2');
// 创建连接池abdnqweasd
const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'abdnqweasd', // 数据库密码
  database: 'abdCE'
});

function query(sql, params) {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting connection:', err);
        reject(err);
        return;
      }
      connection.query(sql, params, (queryErr, results) => {
        connection.release();
        if (queryErr) {
          console.error('Error executing query:', queryErr);
          reject(queryErr);
          return;
        }
        resolve(results);
      }
      )
    })
  })
}

// 导出连接池
module.exports = {
  query,
  pool
}