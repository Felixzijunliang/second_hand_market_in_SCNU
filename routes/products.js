const express = require('express');
const multer = require('multer');
const Product = require('../models/ProductModel');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // 引入 UUID 库生成唯一标识符

const router = express.Router();

// 配置 multer 来处理文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '../uploads'); // 上传路径
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // 给文件名加时间戳
  },
});

const upload = multer({ storage: storage });

// 上传商品信息和图片接口
router.post('/newproduct', upload.single('image'), async (req, res) => {
  try {
    console.log('Received request body:', req.body);
    console.log('Received file:', req.file);

    const { 
      title, 
      description, 
      price, 
      status, 
      userid, 
      username,
      email,
      address 
    } = req.body;

    // 验证必要字段
    if (!title || !description || !price || !userid || !req.file) {
      return res.status(400).json({ 
        message: 'Missing required fields' 
      });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    const id = uuidv4();

    // 创建商品
    const newProduct = new Product({
      id,
      title,
      description,
      price: Number(price), // 确保价格是数字类型
      imageUrl,
      status: status || 'unsold', // 设置默认值
      userid,
      username,
      email: email || '',
      address: address || '',
    });

    // 保存商品信息到数据库
    await newProduct.save();

    res.json({ 
      message: 'Product uploaded successfully',
      productId: newProduct.id,
      imageUrl: newProduct.imageUrl 
    });
  } catch (err) {
    console.error('Error in /newproduct:', err);
    res.status(500).json({ 
      message: 'Error uploading product',
      error: err.message 
    });
  }
});

router.get('/getproduct', async (req, res) => {
  console.log('getproduct 接口被调用');
  console.log('查询参数:', req.query);
  
  const { userID } = req.query;

  if (!userID) {
    return res.status(400).json({ message: 'userID is required' });
  }

  try {
    const products = await Product.find({ userid: userID });

    // 构建响应格式
    const response = products.map(product => ({
      productID: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      status: product.status,
      createdAt: product.createdAt,
      imageUrl: `${req.protocol}://${req.get('host')}${product.imageUrl}`, // 生成完整的 URL
    }));

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching products' });
  }
});

router.delete('/deleteproduct', async (req, res) => {
  const { productID } = req.body;

  if (!productID) {
    return res.status(400).json({ message: 'productID is required' });
  }

  try {
    const product = await Product.findOneAndUpdate(
      { id: productID },
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product deleted (set to inactive) successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting product' });
  }
});
router.put('/updateproduct', async (req, res) => {
  const { productID, title, description, price } = req.body;

  if (!productID || !title || !description || !price) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const product = await Product.findOneAndUpdate(
      { id: productID, isActive: true },
      { title, description, price },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found or is inactive' });
    }

    res.json({ message: 'Product updated successfully', product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating product' });
  }
});

router.get('/userproducts', async (req, res) => {
  const { userID } = req.query;  // 改为 userID 以匹配前端
  console.log(`Received userID: ${userID}`);

  if (!userID) {
    return res.status(400).json({
      success: false,
      message: '用户ID是必填的',
    });
  }

  try {
    const products = await Product.find({ userid: userID });

    if (products.length === 0) {
      return res.status(200).json({  // 改为 200，因为空列表是正常情况
        success: true,
        data: [],
        message: '暂无商品',
      });
    }

    // 返回商品列表
    const response = {
      success: true,
      data: products.map(product => ({
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        imageUrl: `${req.protocol}://${req.get('host')}${product.imageUrl}`,
        status: product.status,
        createdAt: product.createdAt,
        //userid: product.userid  // 添加 userid 字段
      })),
    };

    res.json(response);
  } catch (err) {
    console.error('获取商品列表错误:', err);
    res.status(500).json({
      success: false,
      message: '获取商品列表时发生错误',
    });
  }
});

// 获取所有活跃商品接口
router.get('/getallproducts', async (req, res) => {
  try {
    // 查找所有 isActive 为 true 的商品
    const products = await Product.find({ isActive: true });

    if (products.length === 0) {
      return res.status(404).json({ message: 'No active products found' });
    }

    // 构建响应格式
    const response = products.map((product) => ({
      productID: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      status: product.status,
      createdAt: product.createdAt,
      imageUrl: `${req.protocol}://${req.get('host')}${product.imageUrl}`, // 生成完整的 URL
    }));

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching active products' });
  }
});

module.exports = router;
