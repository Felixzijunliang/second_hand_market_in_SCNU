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
    const { title, description, price,status,username } = req.body;
    const imageUrl = `/uploads/${req.file.filename}`;
    const id = uuidv4();
    

    // 创建商品
    const newProduct = new Product({
      title,
      description,
      price,
      imageUrl,
      id,
      status,
      username,
    });

    // 保存商品信息到数据库
    await newProduct.save();

    res.json({ message: 'Product uploaded successfully',productID:newProduct.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error uploading product' });
  }
});
router.get('/getproduct', async (req, res) => {
  const { userID, productID } = req.query;

  if (!userID || !productID) {
    return res.status(400).json({ message: 'userID and productID are required' });
  }

  try {
    const product = await Product.findOne({ id: productID });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // 构建响应格式
    const response = {
      productID: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      status : product.status,
      createdAt: product.createdAt,
      imageUrl: `${req.protocol}://${req.get('host')}${product.imageUrl}`, // 生成完整的 URL
    };

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching product' });
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
  const { userId } = req.query;  // 获取请求中的用户ID
  console.log(`Received userId: ${userId}`);

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: '用户ID是必填的',
    });
  }

  try {
    // 查找所有符合用户ID的商品
    const products = await Product.find({ username: userId });

    if (products.length === 0) {
      return res.status(405).json({
        success: false,
        message: '没有找到该用户的商品',
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
        imageUrl: `${req.protocol}://${req.get('host')}${product.imageUrl}`, // 生成完整的图片 URL
        status: product.status,
        createdAt: product.createdAt,
      })),
    };

    res.json(response);
  } catch (err) {
    console.error(err);
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
