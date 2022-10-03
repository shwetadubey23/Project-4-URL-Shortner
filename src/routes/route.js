const express = require('express');
const urlController = require('../controllers/urlController')
const router = express.Router();

router.post('/url/shorten',urlController.createUrl);

router.get('/:urlCode',urlController.getUrl)

//router.get('/:urlCode', urlController.getUrl);
router.all('/*',(req,res)=>{return res.status(400).send({status : false , message : "Endpoint Is Incorrect"})})


module.exports = router;
