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
    const { title, description, price } = req.body;
    const imageUrl = `/uploads/${req.file.filename}`;
    const id = uuidv4();
    

    // 创建商品
    const newProduct = new Product({
      title,
      description,
      price,
      imageUrl,
      id,
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
      imageUrl: `${req.protocol}://${req.get('host')}${product.imageUrl}`, // 生成完整的 URL
    };

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching product' });
  }
});


module.exports = router;
