const express = require('express');
const router = express.Router();
const sql = require('../db/sqlpool.js').pool;
const mongo = require('../db/mongodb.js');
const { v4: uuidv4 } = require('uuid');
const checkTokenMiddleware = require('../middlewares/checkTokenMiddleware');


router.post('/login', (req, res) => {
  // console.log(req,'学生登录') //后台登记
  const userID = req.query.ID //学号开变量
  //获取当前时间以及计算过期时间
  var currentTimeStampInSeconds = Math.floor(Date.now() / 1000)
  var ExpireTimeStamp = currentTimeStampInSeconds + 3600
  //获取请求IP，记录溯源
  const IP = req.ip

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
      if (results.length == 0) {
        console.error('Error executing query:', queryErr);
        res.json({
          statusID: -1,
          msg: '学号不存在',
        });
        return;
      }

      // console.log('Query results:', results);
      passwd = results[0].password
      Permission = results[0].permlevel
      Name = results[0].Name
      Cls = results[0].Class
            // 考虑到学号唯一性，这里直接选择记录0
      console.log(results)
      if (passwd != req.query.pass) {
        res.json({
          statusID: -1,
          msg: '密码错误',
        });
        return
      } else {
        const token = uuidv4()
        // 生成token，写入数据库
        connection.query('INSERT INTO `abdnce`.`token` (`userID`, `generateTime`, `expireTime`, `IP`, `token`) VALUES (?, ?, ?, ?, ?)', [userID, currentTimeStampInSeconds, ExpireTimeStamp, IP, token], (queryErr, results) => {
          connection.release();
        })
        // 构造返回json
        res.json({
          statusID: 0,
          msg: '登录成功',
          data: {
            expireTime: ExpireTimeStamp,
            Token: token,
            Permission,
            Name,
            Cls
          }
        });
      }
    });
  });

});



router.post('/register', (req, res) => {
  var userID = req.query.ID
  var username = decodeURIComponent(req.query.n)
  console.log(username)
  var telnumber = req.query.tel
  var pass = req.query.pass
  var IP = req.ip
  // console.log(userID,'在',IP,'尝试注册')
  sql.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection:', err);
      res.json({
        statusID: -1,
        msg: '数据库连接错误',
      });
      return;
    }
    connection.query('SELECT * FROM `userinfo` WHERE userID = ?', [userID], (queryErr, results) => {
      connection.release();

      if (queryErr) {
        console.error('Error executing query:', queryErr);
        res.json({
          statusID: -1,
          msg: '数据库查询错误',
        });
        return;
      }
      console.log(results)
      if (results.length <= 0) {
        res.send({
          statusID: -1,
          msg: '查无此人'
        })
        return
      } else if (results[0].Name != username || telnumber != results[0].phone) {
        res.send({
          statusID: -1,
          msg: '姓名或电话不匹配'
        })
        return
      } else if (results[0].regstatus == 1) {
        res.send({
          statusID: -2,
          msg: '该账号已注册！'
        })
        return
      } else {
        connection.query('UPDATE `userinfo` set `password` = ?, `regstatus` = ? where userID = ?', [pass, 1, userID], (queryErr, results) => {
          connection.release();
          if (queryErr) {
            console.log(queryErr)
            res.json({
              statusID: -1,
              msg: '注册失败',
            });
            return
          }
          res.send({
            statusID: 0,
            msg: '注册成功'
          });
        })
      }
    })
  })
});

// router.get('/getInfo', checkTokenMiddleware, (req, res) => {
//   const userID = req.query.ID //学号开变量
//   sql.getConnection((err, connection) => {
//     if (err) {
//       console.error('Error getting connection:', err);
//       res.json({
//         statusID: -1,
//         msg: '数据库连接错误',
//       });
//       return;
//     }

//     // 执行查询
//     connection.query('SELECT * FROM userinfo WHERE userID = ?', [userID], (queryErr, results) => {
//       // 释放连接
//       connection.release();

//       if (queryErr) {
//         console.error('Error executing query:', queryErr);
//         res.json({
//           statusID: -1,
//           msg: '数据库查询错误',
//         });
//         return;
//       }

//       if (results.length == 0) {
//         console.error('Error executing query:', queryErr);
//         res.json({
//           statusID: -1,
//           msg: '学号不存在',
//         });
//         return;
//       }

//       console.log('Query results:', results);
//       // 构造返回json
//       res.json({
//         statusID: 0,
//         msg:"成功获取",
//         data:{
//           name: results[0].Name,
//           year: results[0].Year,
//           class: results[0].Class
//         }
//       });
//     }
//     );
//   });
// });



module.exports = router;