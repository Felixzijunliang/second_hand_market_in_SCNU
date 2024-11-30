const jwt = require('jsonwebtoken');
const JWT_SECRET = 'your_jwt_secret'; // 替换为你的密钥

// JWT 验证中间件
const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // 解析 Bearer token

  if (!token) {
    return res.status(401).json({ message: '认证失败，未提供 token' });
  }

  // 验证 token
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'token 无效或已过期' });
    }

    // 将解析后的用户信息添加到请求对象中
    req.user = user;
    next();
  });
};

module.exports = authenticateJWT;
