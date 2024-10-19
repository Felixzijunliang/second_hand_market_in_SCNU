const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/UserModel'); // 引用上面定义的UserModel
const authenticateJWT = require('../middlewares/authenticateJWT'); // 引入JWT认证中间件

const router = express.Router();

// 注册接口
router.post('/register', async (req, res) => {
  try {
    const { username, password, realName, phoneNumber, email } = req.body;

    // 检查必填字段是否存在
    if (!username || !password || !realName || !phoneNumber || !email) {
      return res.status(400).json({
        message: 'All fields are required'
      });
    }

    // 检查用户是否已经存在
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        message: 'Username already exists'
      });
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建新用户
    const newUser = new User({
      username,
      password: hashedPassword,
      realName,
      phoneNumber,
      email
    });

    // 保存用户到数据库
    await newUser.save();

    res.status(201).json({
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Server error'
    });
  }
});

// JWT secret
const JWT_SECRET = 'your_jwt_secret'; // 替换为你的密钥

// 用户登录接口
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // 查找用户
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: '用户名或密码错误' });
    }

    // 检查密码是否匹配
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: '用户名或密码错误' });
    }

    // 生成 JWT
    const token = jwt.sign(
      { userID: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '1h' } // 设置 token 的过期时间
    );

    // 返回 token
    res.json({ token });
  } catch (error) {
    console.error('登录错误: ', error);
    res.status(500).json({ message: '服务器错误' });
  }
});
// 获取用户信息接口
router.get('/user', authenticateJWT, async (req, res) => {
    try {
      // 通过 JWT 解析的用户 ID 查找用户信息
      const user = await User.findById(req.user.userID, '-password'); // 排除密码字段
  
      if (!user) {
        return res.status(404).json({ message: '用户未找到' });
      }
  
      // 返回用户信息
      res.json({
        userID: user._id,
        username: user.username,
        realName: user.realName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        isVerified: true // 假设所有用户都通过验证，如果有验证字段，可以替换成 user.isVerified
      });
    } catch (error) {
      console.error('获取用户信息错误: ', error);
      res.status(500).json({ message: '服务器错误' });
    }
  });

module.exports = router;
